import asyncio
import os
import uuid
import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any, Annotated

from fastapi import FastAPI, APIRouter, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator
from bson import ObjectId
from dotenv import load_dotenv

from ai_engine import analyze_scan_results, get_mode_recommendation, chat_with_ai
from loot_parser import collect_loot_summary, extract_findings_from_nmap, list_workspaces, get_workspace_dir

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
SNIPER_LOOT_DIR = os.environ.get("SNIPER_LOOT_DIR", "/usr/share/sniper/loot")
LOG_DIR = "/tmp/sniper_logs"
os.makedirs(LOG_DIR, exist_ok=True)

client_db = AsyncIOMotorClient(MONGO_URL)
db = client_db[DB_NAME]

app = FastAPI(title="SniperAI API")
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ────────────── MODELS ──────────────

PyObjectId = Annotated[str, BeforeValidator(str)]


class ScanCreate(BaseModel):
    target: str
    mode: str = "normal"
    workspace: str = ""
    options: Dict[str, bool] = {}


class ChatMessage(BaseModel):
    message: str
    scan_id: Optional[str] = None


class RecommendRequest(BaseModel):
    target: str
    context: str = ""


# ────────────── DEMO SCAN DATA ──────────────

DEMO_LINES = [
    "[*] Loaded configuration from sniper.conf                             [OK]",
    "[*] Checking for active internet connection                           [OK]",
    "====================================================================================[2024-01-15 10:30]",
    "[!] GATHERING DNS INFO",
    "====================================================================================",
    "testphp.vulnweb.com has address 44.228.249.3",
    "testphp.vulnweb.com mail is handled by 10 mail.vulnweb.com.",
    "",
    "====================================================================================[2024-01-15 10:30]",
    "[!] CHECKING FOR SUBDOMAIN HIJACKING",
    "====================================================================================",
    "[*] No subdomain takeover vectors detected.",
    "",
    "====================================================================================[2024-01-15 10:31]",
    "[!] PINGING HOST",
    "====================================================================================",
    "PING 44.228.249.3 (44.228.249.3): 56 data bytes",
    "64 bytes from 44.228.249.3: icmp_seq=0 ttl=51 time=12.4 ms",
    "[+] Host is UP!",
    "",
    "====================================================================================[2024-01-15 10:31]",
    "[!] RUNNING TCP PORT SCAN",
    "====================================================================================",
    "Starting Nmap 7.94SVN ( https://nmap.org )",
    "Nmap scan report for testphp.vulnweb.com (44.228.249.3)",
    "PORT     STATE SERVICE     VERSION",
    "21/tcp   open  ftp         vsftpd 2.0.8",
    "22/tcp   open  ssh         OpenSSH 8.2p1 Ubuntu 4ubuntu0.11",
    "80/tcp   open  http        Apache httpd 2.4.41 ((Ubuntu))",
    "3306/tcp open  mysql       MySQL 5.7.32-0ubuntu0.18.04.1",
    "8080/tcp open  http-proxy  Squid http proxy 4.10",
    "",
    "====================================================================================[2024-01-15 10:33]",
    "[!] RUNNING INTRUSIVE SCANS",
    "====================================================================================",
    "[+] Port 21 opened... running tests...",
    "| ftp-anon: Anonymous FTP login allowed (FTP code 230)",
    "| -rw-r--r--    1 ftp      ftp          4096 Jan  8  2024 readme.txt",
    "| _drwxr-xr-x   2 ftp      ftp          4096 Nov 12  2023 uploads",
    "",
    "[+] Port 22 opened... running tests...",
    "| ssh-hostkey: 3072 RSA key present",
    "| ssh-auth-methods: publickey,password",
    "",
    "[+] Port 80 opened... running tests...",
    "| http-title: Home of Acme! | Vulnerable Web Application",
    "| http-server-header: Apache/2.4.41 (Ubuntu)",
    "| http-robots.txt: 4 disallowed entries",
    "|   /admin/ /backup/ /config/ /database/",
    "",
    "====================================================================================[2024-01-15 10:40]",
    "[!] RUNNING METASPLOIT MODULES",
    "====================================================================================",
    "[*] Running vsftpd 2.3.4 backdoor check...",
    "[+] 44.228.249.3:21 - FTP anonymous access allowed",
    "[*] MySQL version detection...",
    "[+] 44.228.249.3:3306 - MySQL 5.7.32 detected - checking for CVE-2021-27928",
    "[!] POTENTIAL VULNERABILITY: MySQL heap-buffer-overflow (CVE-2021-27928)",
    "",
    "====================================================================================[2024-01-15 10:45]",
    "[!] SCANNING ALL HTTP PORTS",
    "====================================================================================",
    "[*] Running nikto on port 80...",
    "+ /admin/: Admin login page found.",
    "+ /phpinfo.php: Output from the phpinfo() was found.",
    "+ /database/: Directory listing enabled.",
    "+ /backup/: Backup directory accessible.",
    "+ SQL injection vectors detected in parameter 'id'",
    "+ Cross-Site Scripting (XSS) vulnerability detected in 'searchFor' parameter",
    "",
    "====================================================================================[2024-01-15 10:55]",
    "[!] RUNNING DIRSEARCH",
    "====================================================================================",
    "[200] /admin/",
    "[200] /admin/login.php",
    "[200] /phpinfo.php",
    "[200] /database/",
    "[200] /backup/",
    "[403] /config/",
    "[200] /listproducts.php?cat=1",
    "[200] /showimage.php?file=1.jpg",
    "",
    "====================================================================================[2024-01-15 11:00]",
    "[!] SCAN COMPLETE!",
    "====================================================================================",
    "[*] Generating reports...",
    "[*] Loot saved to /usr/share/sniper/loot/workspace/vulnhunter/",
    "[+] 5 open ports discovered",
    "[+] 2 critical vulnerabilities identified",
    "[+] Anonymous FTP access confirmed",
    "[+] SQL injection confirmed on /listproducts.php",
    "[+] XSS confirmed on search functionality",
    "[*] Run 'sniper -t testphp.vulnweb.com -m web -w vulnhunter' for deeper web assessment",
]

# ────────────── HELPERS ──────────────

def is_sniper_available() -> bool:
    try:
        result = subprocess.run(["which", "sniper"], capture_output=True, timeout=3)
        return result.returncode == 0
    except Exception:
        return False


def build_sniper_command(scan: dict) -> list:
    target = scan["target"]
    mode = scan.get("mode", "normal")
    workspace = scan.get("workspace", "default")
    options = scan.get("options", {})

    cmd = ["sniper", "-t", target, "-m", mode, "-w", workspace]
    if options.get("osint"):
        cmd.append("-o")
    if options.get("recon"):
        cmd.append("-re")
    if options.get("bruteforce"):
        cmd.append("-b")
    if options.get("full_port"):
        cmd.append("-fp")
    return cmd


async def run_real_scan(scan_id: str, scan_doc: dict):
    log_file = f"{LOG_DIR}/{scan_id}.log"
    cmd = build_sniper_command(scan_doc)

    try:
        await db.scans.update_one(
            {"id": scan_id},
            {"$set": {"status": "running", "started_at": datetime.now(timezone.utc).isoformat(), "log_file": log_file}}
        )

        with open(log_file, "w") as lf:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )

            await db.scans.update_one({"id": scan_id}, {"$set": {"pid": process.pid}})

            async for line in process.stdout:
                decoded = line.decode("utf-8", errors="replace")
                lf.write(decoded)
                lf.flush()

            await process.wait()
            rc = process.returncode

        status = "completed" if rc == 0 else "failed"
        await db.scans.update_one(
            {"id": scan_id},
            {"$set": {"status": status, "completed_at": datetime.now(timezone.utc).isoformat()}}
        )

        # Auto-parse findings
        workspace = scan_doc.get("workspace", scan_doc["target"])
        ws_dir = get_workspace_dir(workspace)
        xml_path = os.path.join(ws_dir, "nmap", f"nmap-{scan_doc['target']}.xml")
        if os.path.exists(xml_path):
            findings = extract_findings_from_nmap(xml_path, scan_id, workspace, scan_doc["target"])
            for f in findings:
                f["id"] = str(uuid.uuid4())
                f["created_at"] = datetime.now(timezone.utc).isoformat()
                await db.findings.insert_one(f)

    except Exception as e:
        logger.error(f"Scan {scan_id} failed: {e}")
        await db.scans.update_one({"id": scan_id}, {"$set": {"status": "failed", "error": str(e)}})


async def run_demo_scan(scan_id: str, target: str, workspace: str = "demo"):
    log_file = f"{LOG_DIR}/{scan_id}.log"

    await db.scans.update_one(
        {"id": scan_id},
        {"$set": {"status": "running", "started_at": datetime.now(timezone.utc).isoformat(), "log_file": log_file, "demo": True}}
    )

    with open(log_file, "w") as lf:
        for line in DEMO_LINES:
            # Swap target name in demo output
            output_line = line.replace("testphp.vulnweb.com", target).replace("44.228.249.3", target) + "\n"
            lf.write(output_line)
            lf.flush()
            await asyncio.sleep(0.15)

    # Seed demo findings
    demo_findings = [
        {"type": "open_port", "severity": "HIGH", "title": f"Port 21/tcp - vsftpd 2.0.8 (Anonymous FTP)", "host": target, "port": 21, "service": "ftp", "product": "vsftpd", "version": "2.0.8", "cve": None},
        {"type": "open_port", "severity": "MEDIUM", "title": f"Port 22/tcp - OpenSSH 8.2p1", "host": target, "port": 22, "service": "ssh", "product": "OpenSSH", "version": "8.2p1", "cve": None},
        {"type": "open_port", "severity": "MEDIUM", "title": f"Port 80/tcp - Apache 2.4.41", "host": target, "port": 80, "service": "http", "product": "Apache httpd", "version": "2.4.41", "cve": None},
        {"type": "open_port", "severity": "HIGH", "title": f"Port 3306/tcp - MySQL 5.7.32", "host": target, "port": 3306, "service": "mysql", "product": "MySQL", "version": "5.7.32", "cve": None},
        {"type": "vulnerability", "severity": "CRITICAL", "title": "SQL Injection - /listproducts.php", "host": target, "port": 80, "service": "http", "description": "SQL injection detected in 'cat' parameter of /listproducts.php. Full database access possible.", "cve": "CVE-2024-1234"},
        {"type": "vulnerability", "severity": "HIGH", "title": "XSS - Search Parameter", "host": target, "port": 80, "service": "http", "description": "Reflected XSS in searchFor parameter. Session hijacking possible.", "cve": None},
        {"type": "vulnerability", "severity": "CRITICAL", "title": "Anonymous FTP Access", "host": target, "port": 21, "service": "ftp", "description": "Anonymous FTP login allowed. Directory listing and file upload enabled.", "cve": None},
        {"type": "vulnerability", "severity": "HIGH", "title": "MySQL CVE-2021-27928 - Heap Buffer Overflow", "host": target, "port": 3306, "service": "mysql", "description": "MySQL 5.7.32 is vulnerable to heap-buffer-overflow (CVE-2021-27928). Privilege escalation possible.", "cve": "CVE-2021-27928"},
        {"type": "web_finding", "severity": "HIGH", "title": "Admin Panel Exposed - /admin/", "host": target, "port": 80, "service": "http", "description": "Admin login panel accessible without authentication redirect.", "cve": None},
        {"type": "web_finding", "severity": "MEDIUM", "title": "phpinfo() Disclosure", "host": target, "port": 80, "service": "http", "description": "phpinfo() page exposed at /phpinfo.php revealing server configuration.", "cve": None},
    ]

    for f in demo_findings:
        f["id"] = str(uuid.uuid4())
        f["scan_id"] = scan_id
        f["workspace"] = workspace
        f["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.findings.insert_one(f)

    await db.scans.update_one(
        {"id": scan_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )


# ────────────── ROUTES ──────────────

@api_router.get("/")
async def root():
    return {"status": "SniperAI API online", "sniper_available": is_sniper_available()}


@api_router.get("/stats")
async def get_stats():
    total_scans = await db.scans.count_documents({})
    active_scans = await db.scans.count_documents({"status": "running"})
    total_findings = await db.findings.count_documents({})
    critical_findings = await db.findings.count_documents({"severity": "CRITICAL"})
    attack_plans = await db.attack_plans.count_documents({})
    completed_scans = await db.scans.count_documents({"status": "completed"})

    return {
        "total_scans": total_scans,
        "active_scans": active_scans,
        "completed_scans": completed_scans,
        "total_findings": total_findings,
        "critical_findings": critical_findings,
        "attack_plans": attack_plans,
        "sniper_available": is_sniper_available(),
    }


@api_router.post("/scans")
async def create_scan(scan_in: ScanCreate, background_tasks: BackgroundTasks):
    scan_id = str(uuid.uuid4())
    workspace = scan_in.workspace.strip() or scan_in.target.replace(".", "_").replace("/", "_")

    scan_doc = {
        "id": scan_id,
        "target": scan_in.target,
        "mode": scan_in.mode,
        "workspace": workspace,
        "options": scan_in.options,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "log_file": f"{LOG_DIR}/{scan_id}.log",
        "demo": False,
    }
    await db.scans.insert_one(scan_doc)

    if is_sniper_available():
        background_tasks.add_task(run_real_scan, scan_id, scan_doc)
    else:
        background_tasks.add_task(run_demo_scan, scan_id, scan_in.target, workspace)

    scan_doc.pop("_id", None)
    return scan_doc


@api_router.get("/scans")
async def list_scans():
    scans = await db.scans.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return scans


@api_router.get("/scans/{scan_id}")
async def get_scan(scan_id: str):
    scan = await db.scans.find_one({"id": scan_id}, {"_id": 0})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@api_router.delete("/scans/{scan_id}")
async def delete_scan(scan_id: str):
    await db.scans.delete_one({"id": scan_id})
    await db.findings.delete_many({"scan_id": scan_id})
    await db.attack_plans.delete_many({"scan_id": scan_id})
    return {"deleted": scan_id}


@api_router.get("/scans/{scan_id}/output")
async def get_scan_output(scan_id: str, offset: int = 0):
    scan = await db.scans.find_one({"id": scan_id}, {"_id": 0})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    log_file = scan.get("log_file", f"{LOG_DIR}/{scan_id}.log")
    if not os.path.exists(log_file):
        return {"lines": [], "offset": 0, "status": scan.get("status")}

    with open(log_file, "r", errors="replace") as f:
        all_lines = f.readlines()

    new_lines = all_lines[offset:]
    return {
        "lines": [l.rstrip("\n") for l in new_lines],
        "offset": offset + len(new_lines),
        "status": scan.get("status", "unknown"),
        "total_lines": len(all_lines),
    }


@api_router.post("/scans/{scan_id}/stop")
async def stop_scan(scan_id: str):
    scan = await db.scans.find_one({"id": scan_id}, {"_id": 0})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    pid = scan.get("pid")
    if pid:
        try:
            os.kill(pid, 9)
        except ProcessLookupError:
            pass
    await db.scans.update_one({"id": scan_id}, {"$set": {"status": "stopped"}})
    return {"status": "stopped"}


@api_router.post("/scans/{scan_id}/analyze")
async def analyze_scan(scan_id: str, background_tasks: BackgroundTasks):
    scan = await db.scans.find_one({"id": scan_id}, {"_id": 0})
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")

    # Collect loot + terminal output
    loot_parts = []

    # Terminal output
    log_file = scan.get("log_file", f"{LOG_DIR}/{scan_id}.log")
    if os.path.exists(log_file):
        with open(log_file, "r", errors="replace") as f:
            loot_parts.append("=== TERMINAL OUTPUT ===\n" + f.read()[:30000])

    # Loot files if sniper was real
    workspace = scan.get("workspace", "")
    target = scan.get("target", "")
    if workspace and not scan.get("demo"):
        loot_summary = collect_loot_summary(workspace, target)
        loot_parts.append(loot_summary)

    full_loot = "\n\n".join(loot_parts)

    # Run AI analysis in background
    background_tasks.add_task(_do_ai_analysis, scan_id, scan, full_loot)
    return {"status": "analyzing", "message": "AI analysis started"}


async def _do_ai_analysis(scan_id: str, scan: dict, loot_data: str):
    try:
        await db.attack_plans.delete_many({"scan_id": scan_id})
        plan = await analyze_scan_results(scan, loot_data)
        plan_doc = {
            "id": str(uuid.uuid4()),
            "scan_id": scan_id,
            "target": scan.get("target"),
            "workspace": scan.get("workspace"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            **plan
        }
        await db.attack_plans.insert_one(plan_doc)
        await db.scans.update_one({"id": scan_id}, {"$set": {"has_plan": True}})
    except Exception as e:
        logger.error(f"AI analysis failed for scan {scan_id}: {e}")


@api_router.get("/scans/{scan_id}/plan")
async def get_attack_plan(scan_id: str):
    plan = await db.attack_plans.find_one({"scan_id": scan_id}, {"_id": 0})
    if not plan:
        # Check if analysis is in progress or not started
        scan = await db.scans.find_one({"id": scan_id}, {"_id": 0})
        if not scan:
            raise HTTPException(status_code=404, detail="Scan not found")
        return {"status": "not_ready", "message": "No attack plan yet. Click 'Analyze with AI' to generate one."}
    return plan


@api_router.get("/scans/{scan_id}/findings")
async def get_scan_findings(scan_id: str, severity: Optional[str] = None):
    query = {"scan_id": scan_id}
    if severity:
        query["severity"] = severity.upper()
    findings = await db.findings.find(query, {"_id": 0}).sort("severity", -1).to_list(500)
    return findings


@api_router.post("/ai/recommend")
async def recommend_scan_mode(req: RecommendRequest):
    recommendation = await get_mode_recommendation(req.target, req.context)
    return recommendation


@api_router.post("/ai/chat")
async def ai_chat(msg: ChatMessage):
    scan_context = ""
    if msg.scan_id:
        log_file = f"{LOG_DIR}/{msg.scan_id}.log"
        if os.path.exists(log_file):
            with open(log_file, "r", errors="replace") as f:
                scan_context = f.read()[:8000]

    response = await chat_with_ai(msg.message, scan_context)
    chat_doc = {
        "id": str(uuid.uuid4()),
        "scan_id": msg.scan_id,
        "user_message": msg.message,
        "ai_response": response,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.chats.insert_one(chat_doc)
    return {"response": response}


@api_router.get("/workspaces")
async def get_workspaces():
    # Workspaces from DB scans
    pipeline = [
        {"$group": {"_id": "$workspace", "target": {"$first": "$target"}, "last_scan": {"$max": "$created_at"}, "scan_count": {"$sum": 1}}},
        {"$sort": {"last_scan": -1}}
    ]
    db_workspaces = await db.scans.aggregate(pipeline).to_list(100)

    result = []
    for ws in db_workspaces:
        critical_count = await db.findings.count_documents({"workspace": ws["_id"], "severity": "CRITICAL"})
        result.append({
            "name": ws["_id"],
            "target": ws["target"],
            "scan_count": ws["scan_count"],
            "last_scan": ws["last_scan"],
            "critical_findings": critical_count
        })

    # Also check file system workspaces
    fs_workspaces = list_workspaces()
    fs_names = {r["name"] for r in result}
    for ws in fs_workspaces:
        if ws["name"] not in fs_names:
            result.append({
                "name": ws["name"],
                "target": ws["name"],
                "scan_count": 0,
                "last_scan": None,
                "critical_findings": 0,
                "from_fs": True
            })

    return result


@api_router.get("/findings")
async def get_all_findings(severity: Optional[str] = None, limit: int = 100):
    query = {}
    if severity:
        query["severity"] = severity.upper()
    findings = await db.findings.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return findings


app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown():
    client_db.close()
