import asyncio
import json
import os
import uuid
import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from ai_engine import analyze_scan_results, get_mode_recommendation, chat_with_ai
from loot_parser import collect_loot_summary, extract_findings_from_nmap, list_workspaces, get_workspace_dir
from database import get_db, init_db, row_to_dict

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SNIPER_LOOT_DIR = os.environ.get("SNIPER_LOOT_DIR", "/usr/share/sniper/loot")
LOG_DIR = "/tmp/sniper_logs"
os.makedirs(LOG_DIR, exist_ok=True)

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


# ────────────── DEMO OUTPUT ──────────────

DEMO_LINES = [
    "[*] Loaded configuration from sniper.conf                             [OK]",
    "[*] Checking for active internet connection                           [OK]",
    "====================================================================================[{ts}]",
    "[!] GATHERING DNS INFO",
    "====================================================================================",
    "{target} has address 44.228.249.3",
    "{target} mail is handled by 10 mail.vulnweb.com.",
    "",
    "====================================================================================[{ts}]",
    "[!] CHECKING FOR SUBDOMAIN HIJACKING",
    "====================================================================================",
    "[*] No subdomain takeover vectors detected.",
    "",
    "[!] PINGING HOST",
    "====================================================================================",
    "PING {target}: 56 data bytes",
    "64 bytes from {target}: icmp_seq=0 ttl=51 time=12.4 ms",
    "[+] Host is UP!",
    "",
    "====================================================================================[{ts}]",
    "[!] RUNNING TCP PORT SCAN",
    "====================================================================================",
    "Starting Nmap 7.94SVN ( https://nmap.org )",
    "Nmap scan report for {target}",
    "PORT     STATE SERVICE     VERSION",
    "21/tcp   open  ftp         vsftpd 2.0.8",
    "22/tcp   open  ssh         OpenSSH 8.2p1 Ubuntu",
    "80/tcp   open  http        Apache httpd 2.4.41 ((Ubuntu))",
    "3306/tcp open  mysql       MySQL 5.7.32-0ubuntu0",
    "8080/tcp open  http-proxy  Squid http proxy 4.10",
    "",
    "====================================================================================[{ts}]",
    "[!] RUNNING INTRUSIVE SCANS",
    "====================================================================================",
    "[+] Port 21 opened... running tests...",
    "| ftp-anon: Anonymous FTP login allowed (FTP code 230)",
    "| -rw-r--r--  1 ftp  ftp  4096 Jan 8 2024 readme.txt",
    "| _drwxr-xr-x  2 ftp  ftp  4096 Nov 12 2023 uploads",
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
    "====================================================================================[{ts}]",
    "[!] RUNNING METASPLOIT MODULES",
    "====================================================================================",
    "[*] Running vsftpd 2.3.4 backdoor check...",
    "[+] {target}:21 - FTP anonymous access allowed",
    "[*] MySQL version detection...",
    "[+] {target}:3306 - MySQL 5.7.32 detected",
    "[!] POTENTIAL VULNERABILITY: MySQL heap-buffer-overflow (CVE-2021-27928)",
    "",
    "====================================================================================[{ts}]",
    "[!] SCANNING ALL HTTP PORTS",
    "====================================================================================",
    "[*] Running nikto on port 80...",
    "[+] /admin/: Admin login page found.",
    "[+] /phpinfo.php: phpinfo() page exposed.",
    "[+] /database/: Directory listing enabled.",
    "[+] /backup/: Backup directory accessible.",
    "[!] SQL injection vectors detected in parameter 'id'",
    "[!] Cross-Site Scripting (XSS) detected in 'searchFor' parameter",
    "",
    "====================================================================================[{ts}]",
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
    "====================================================================================[{ts}]",
    "[!] SCAN COMPLETE!",
    "====================================================================================",
    "[*] Generating reports...",
    "[+] 5 open ports discovered",
    "[+] 2 critical vulnerabilities identified",
    "[+] Anonymous FTP access confirmed",
    "[+] SQL injection confirmed on /listproducts.php",
    "[+] XSS confirmed on search functionality",
]

DEMO_FINDINGS = [
    {"type": "open_port", "severity": "HIGH", "title": "Port 21/tcp - vsftpd 2.0.8 (Anonymous FTP)", "port": 21, "service": "ftp", "product": "vsftpd", "version": "2.0.8", "description": "FTP service with anonymous access enabled.", "cve": None},
    {"type": "open_port", "severity": "MEDIUM", "title": "Port 22/tcp - OpenSSH 8.2p1", "port": 22, "service": "ssh", "product": "OpenSSH", "version": "8.2p1", "description": "SSH service running.", "cve": None},
    {"type": "open_port", "severity": "MEDIUM", "title": "Port 80/tcp - Apache 2.4.41", "port": 80, "service": "http", "product": "Apache httpd", "version": "2.4.41", "description": "HTTP web server.", "cve": None},
    {"type": "open_port", "severity": "HIGH", "title": "Port 3306/tcp - MySQL 5.7.32", "port": 3306, "service": "mysql", "product": "MySQL", "version": "5.7.32", "description": "MySQL database server exposed.", "cve": None},
    {"type": "vulnerability", "severity": "CRITICAL", "title": "SQL Injection - /listproducts.php", "port": 80, "service": "http", "description": "SQL injection in 'cat' parameter. Full DB access possible.", "cve": "CVE-2024-1234"},
    {"type": "vulnerability", "severity": "HIGH", "title": "XSS - Search Parameter", "port": 80, "service": "http", "description": "Reflected XSS in searchFor parameter.", "cve": None},
    {"type": "vulnerability", "severity": "CRITICAL", "title": "Anonymous FTP Access", "port": 21, "service": "ftp", "description": "Anonymous FTP login allowed with directory listing and upload.", "cve": None},
    {"type": "vulnerability", "severity": "HIGH", "title": "MySQL CVE-2021-27928 - Heap Buffer Overflow", "port": 3306, "service": "mysql", "description": "MySQL 5.7.32 vulnerable to heap-buffer-overflow. Privilege escalation possible.", "cve": "CVE-2021-27928"},
    {"type": "web_finding", "severity": "HIGH", "title": "Admin Panel Exposed - /admin/", "port": 80, "service": "http", "description": "Admin login panel accessible without redirect.", "cve": None},
    {"type": "web_finding", "severity": "MEDIUM", "title": "phpinfo() Disclosure", "port": 80, "service": "http", "description": "phpinfo() exposed at /phpinfo.php revealing server config.", "cve": None},
]

# ────────────── HELPERS ──────────────

def is_sniper_available() -> bool:
    try:
        result = subprocess.run(["which", "sniper"], capture_output=True, timeout=3)
        return result.returncode == 0
    except Exception:
        return False


def build_sniper_command(scan: dict) -> list:
    options = scan.get("options", {})
    if isinstance(options, str):
        options = json.loads(options)
    cmd = ["sniper", "-t", scan["target"], "-m", scan.get("mode", "normal"), "-w", scan.get("workspace", "default")]
    if options.get("osint"):   cmd.append("-o")
    if options.get("recon"):   cmd.append("-re")
    if options.get("bruteforce"): cmd.append("-b")
    if options.get("full_port"):  cmd.append("-fp")
    return cmd


def now_iso():
    return datetime.now(timezone.utc).isoformat()


async def insert_finding(scan_id: str, workspace: str, host: str, f: dict):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO findings (id, scan_id, workspace, type, severity, title, description, host, port, service, product, version, cve, raw, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), scan_id, workspace, f.get("type"), f.get("severity"), f.get("title"), f.get("description"),
             host, f.get("port"), f.get("service"), f.get("product"), f.get("version"), f.get("cve"),
             json.dumps(f.get("raw", {})), now_iso())
        )
        await db.commit()
    finally:
        await db.close()


async def run_real_scan(scan_id: str, scan_doc: dict):
    log_file = f"{LOG_DIR}/{scan_id}.log"
    cmd = build_sniper_command(scan_doc)
    db = await get_db()
    try:
        await db.execute("UPDATE scans SET status='running', started_at=?, log_file=? WHERE id=?",
                         (now_iso(), log_file, scan_id))
        await db.commit()
    finally:
        await db.close()

    try:
        with open(log_file, "w") as lf:
            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
            db2 = await get_db()
            await db2.execute("UPDATE scans SET pid=? WHERE id=?", (process.pid, scan_id))
            await db2.commit()
            await db2.close()

            async for line in process.stdout:
                lf.write(line.decode("utf-8", errors="replace"))
                lf.flush()
            await process.wait()
            rc = process.returncode

        status = "completed" if rc == 0 else "failed"
        db3 = await get_db()
        await db3.execute("UPDATE scans SET status=?, completed_at=? WHERE id=?", (status, now_iso(), scan_id))
        await db3.commit()
        await db3.close()

        workspace = scan_doc.get("workspace", scan_doc["target"])
        xml_path = os.path.join(get_workspace_dir(workspace), "nmap", f"nmap-{scan_doc['target']}.xml")
        if os.path.exists(xml_path):
            findings = extract_findings_from_nmap(xml_path, scan_id, workspace, scan_doc["target"])
            for f in findings:
                await insert_finding(scan_id, workspace, scan_doc["target"], f)
    except Exception as e:
        logger.error(f"Scan {scan_id} error: {e}")
        db4 = await get_db()
        await db4.execute("UPDATE scans SET status='failed', error=? WHERE id=?", (str(e), scan_id))
        await db4.commit()
        await db4.close()


async def run_demo_scan(scan_id: str, target: str, workspace: str):
    log_file = f"{LOG_DIR}/{scan_id}.log"
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")

    db = await get_db()
    await db.execute("UPDATE scans SET status='running', started_at=?, log_file=?, demo=1 WHERE id=?",
                     (now_iso(), log_file, scan_id))
    await db.commit()
    await db.close()

    with open(log_file, "w") as lf:
        for line in DEMO_LINES:
            out = line.replace("{target}", target).replace("{ts}", ts) + "\n"
            lf.write(out)
            lf.flush()
            await asyncio.sleep(0.15)

    for f in DEMO_FINDINGS:
        await insert_finding(scan_id, workspace, target, f)

    db2 = await get_db()
    await db2.execute("UPDATE scans SET status='completed', completed_at=? WHERE id=?", (now_iso(), scan_id))
    await db2.commit()
    await db2.close()


async def do_ai_analysis(scan_id: str, scan: dict, loot_data: str):
    try:
        plan = await analyze_scan_results(scan, loot_data)
        db = await get_db()
        await db.execute(
            "INSERT OR REPLACE INTO attack_plans (id, scan_id, target, workspace, executive_summary, risk_level, target_profile, key_findings, attack_phases, immediate_next_command, cve_findings, remediation_summary, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (str(uuid.uuid4()), scan_id, scan.get("target"), scan.get("workspace"),
             plan.get("executive_summary", ""), plan.get("risk_level", "UNKNOWN"),
             plan.get("target_profile", ""),
             json.dumps(plan.get("key_findings", [])),
             json.dumps(plan.get("attack_phases", [])),
             plan.get("immediate_next_command", ""),
             json.dumps(plan.get("cve_findings", [])),
             plan.get("remediation_summary", ""),
             now_iso())
        )
        await db.execute("UPDATE scans SET has_plan=1 WHERE id=?", (scan_id,))
        await db.commit()
        await db.close()
    except Exception as e:
        logger.error(f"AI analysis failed {scan_id}: {e}")


# ────────────── CHAIN ATTACK ──────────────

CHAIN_STRATEGY = {
    "web": ["web", "webscan"],
    "ssh": ["port"],
    "ftp": ["port"],
    "mysql": ["port"],
    "mssql": ["port"],
    "rdp": ["port"],
    "smb": ["port"],
}

async def run_chain_attack(chain_id: str, parent_scan_id: str, target: str, workspace: str):
    """Auto-chain attack: AI decides next scan after each step completes."""
    db = await get_db()
    chain_log = [f"[CHAIN] Starting auto chain attack on {target}"]
    scan_ids = [parent_scan_id]
    step = 1

    try:
        while step <= 5:  # Max 5 chained scans
            await asyncio.sleep(2)

            # Get current findings
            db = await get_db()
            rows = await db.execute_fetchall(
                "SELECT severity, title, service, port, type FROM findings WHERE scan_id=? ORDER BY severity DESC LIMIT 30",
                (parent_scan_id if step == 1 else scan_ids[-1],)
            )
            await db.close()

            if not rows:
                chain_log.append("[CHAIN] No findings yet, waiting...")
                await asyncio.sleep(5)
                continue

            findings_text = "\n".join([f"- {dict(r)['severity']} | {dict(r)['type']} | {dict(r)['title']} | port:{dict(r)['port']} | svc:{dict(r)['service']}" for r in rows])

            # Ask AI what to do next
            prompt = f"""Current findings on {target}:
{findings_text}

Steps already completed: {step}
Previous scan modes used: {[s for s in scan_ids]}

Based on these findings, what single Sn1per scan should be run next for maximum impact?
If there are no more high-value targets to scan, respond with: CHAIN_COMPLETE

Otherwise respond with ONLY one line in this exact format:
NEXT_SCAN: sniper -t {target} -m <mode> [options] -w {workspace}"""

            ai_response = await chat_with_ai(prompt)
            chain_log.append(f"[CHAIN STEP {step}] AI: {ai_response[:200]}")

            # Update chain log in DB
            db2 = await get_db()
            await db2.execute("UPDATE chain_runs SET log=?, scan_ids=?, step=? WHERE id=?",
                             ("\n".join(chain_log), json.dumps(scan_ids), step, chain_id))
            await db2.commit()
            await db2.close()

            if "CHAIN_COMPLETE" in ai_response or "chain_complete" in ai_response.lower():
                chain_log.append("[CHAIN] AI determined chain complete. All attack vectors covered.")
                break

            # Parse next command
            if "NEXT_SCAN:" in ai_response:
                cmd_line = ai_response.split("NEXT_SCAN:")[-1].strip().split("\n")[0]
                # Extract mode from command
                import re
                m = re.search(r"-m\s+(\S+)", cmd_line)
                mode = m.group(1) if m else "normal"
                # Extract options
                options = {
                    "osint": "-o" in cmd_line,
                    "recon": "-re" in cmd_line,
                    "bruteforce": "-b" in cmd_line,
                    "full_port": "-fp" in cmd_line,
                }

                new_scan_id = str(uuid.uuid4())
                db3 = await get_db()
                await db3.execute(
                    "INSERT INTO scans (id, target, mode, workspace, status, options, created_at) VALUES (?,?,?,?,?,?,?)",
                    (new_scan_id, target, mode, workspace, "pending", json.dumps(options), now_iso())
                )
                await db3.commit()
                await db3.close()

                scan_ids.append(new_scan_id)
                chain_log.append(f"[CHAIN STEP {step}] Launching: sniper -t {target} -m {mode} -w {workspace}")

                # Run scan
                if is_sniper_available():
                    scan_doc = {"target": target, "mode": mode, "workspace": workspace, "options": options}
                    await run_real_scan(new_scan_id, scan_doc)
                else:
                    await run_demo_scan(new_scan_id, target, workspace)

                # Wait for completion
                for _ in range(60):
                    await asyncio.sleep(3)
                    db4 = await get_db()
                    row = await (await db4.execute("SELECT status FROM scans WHERE id=?", (new_scan_id,))).fetchone()
                    await db4.close()
                    if row and row[0] in ("completed", "failed", "stopped"):
                        break

                # Auto-analyze
                scan_doc2 = {"target": target, "mode": mode, "workspace": workspace}
                log_file = f"{LOG_DIR}/{new_scan_id}.log"
                loot_data = ""
                if os.path.exists(log_file):
                    with open(log_file) as f:
                        loot_data = f.read()[:30000]
                await do_ai_analysis(new_scan_id, scan_doc2, loot_data)

                step += 1
            else:
                chain_log.append("[CHAIN] Could not parse AI command, stopping chain.")
                break

        # Mark chain complete
        db5 = await get_db()
        await db5.execute("UPDATE chain_runs SET status='completed', completed_at=?, log=?, scan_ids=?, step=? WHERE id=?",
                         (now_iso(), "\n".join(chain_log), json.dumps(scan_ids), step, chain_id))
        await db5.commit()
        await db5.close()

    except Exception as e:
        logger.error(f"Chain {chain_id} error: {e}")
        db6 = await get_db()
        await db6.execute("UPDATE chain_runs SET status='failed', log=? WHERE id=?",
                         ("\n".join(chain_log) + f"\n[ERROR] {e}", chain_id))
        await db6.commit()
        await db6.close()


# ────────────── ROUTES ──────────────

@api_router.get("/")
async def root():
    return {"status": "SniperAI API online", "sniper_available": is_sniper_available(), "storage": "SQLite"}


@api_router.get("/stats")
async def get_stats():
    db = await get_db()
    try:
        total_scans = (await (await db.execute("SELECT COUNT(*) FROM scans")).fetchone())[0]
        active_scans = (await (await db.execute("SELECT COUNT(*) FROM scans WHERE status='running'")).fetchone())[0]
        completed_scans = (await (await db.execute("SELECT COUNT(*) FROM scans WHERE status='completed'")).fetchone())[0]
        total_findings = (await (await db.execute("SELECT COUNT(*) FROM findings")).fetchone())[0]
        critical_findings = (await (await db.execute("SELECT COUNT(*) FROM findings WHERE severity='CRITICAL'")).fetchone())[0]
        attack_plans = (await (await db.execute("SELECT COUNT(*) FROM attack_plans")).fetchone())[0]
        chain_runs = (await (await db.execute("SELECT COUNT(*) FROM chain_runs")).fetchone())[0]
    finally:
        await db.close()

    return {
        "total_scans": total_scans, "active_scans": active_scans, "completed_scans": completed_scans,
        "total_findings": total_findings, "critical_findings": critical_findings,
        "attack_plans": attack_plans, "chain_runs": chain_runs,
        "sniper_available": is_sniper_available(),
    }


@api_router.post("/scans")
async def create_scan(scan_in: ScanCreate, background_tasks: BackgroundTasks):
    scan_id = str(uuid.uuid4())
    # Limpiar target: quitar https://, http://, slashes finales
    import re as _re
    target = _re.sub(r'^https?://', '', scan_in.target.strip()).rstrip('/')
    workspace = scan_in.workspace.strip() or target.replace(".", "_").replace("/", "_")

    db = await get_db()
    await db.execute(
        "INSERT INTO scans (id, target, mode, workspace, status, options, created_at, log_file) VALUES (?,?,?,?,?,?,?,?)",
        (scan_id, target, scan_in.mode, workspace, "pending",
         json.dumps(scan_in.options), now_iso(), f"{LOG_DIR}/{scan_id}.log")
    )
    await db.commit()
    await db.close()

    scan_doc = {"id": scan_id, "target": target, "mode": scan_in.mode,
                "workspace": workspace, "options": scan_in.options}

    if is_sniper_available():
        background_tasks.add_task(run_real_scan, scan_id, scan_doc)
    else:
        background_tasks.add_task(run_demo_scan, scan_id, target, workspace)

    return {**scan_doc, "status": "pending", "demo": not is_sniper_available()}


@api_router.get("/scans")
async def list_scans():
    db = await get_db()
    rows = await db.execute_fetchall("SELECT * FROM scans ORDER BY created_at DESC LIMIT 100")
    await db.close()
    return [row_to_dict(r) for r in rows]


@api_router.get("/scans/{scan_id}")
async def get_scan(scan_id: str):
    db = await get_db()
    row = await (await db.execute("SELECT * FROM scans WHERE id=?", (scan_id,))).fetchone()
    await db.close()
    if not row:
        raise HTTPException(status_code=404, detail="Scan not found")
    return row_to_dict(row)


@api_router.delete("/scans/{scan_id}")
async def delete_scan(scan_id: str):
    db = await get_db()
    await db.execute("DELETE FROM scans WHERE id=?", (scan_id,))
    await db.execute("DELETE FROM findings WHERE scan_id=?", (scan_id,))
    await db.execute("DELETE FROM attack_plans WHERE scan_id=?", (scan_id,))
    await db.commit()
    await db.close()
    return {"deleted": scan_id}


@api_router.get("/scans/{scan_id}/output")
async def get_scan_output(scan_id: str, offset: int = 0):
    db = await get_db()
    row = await (await db.execute("SELECT log_file, status FROM scans WHERE id=?", (scan_id,))).fetchone()
    await db.close()
    if not row:
        raise HTTPException(status_code=404, detail="Scan not found")

    log_file = row[0] or f"{LOG_DIR}/{scan_id}.log"
    status = row[1]

    if not log_file or not os.path.exists(log_file):
        return {"lines": [], "offset": 0, "status": status}

    with open(log_file, "r", errors="replace") as f:
        all_lines = f.readlines()

    new_lines = all_lines[offset:]
    return {
        "lines": [l.rstrip("\n") for l in new_lines],
        "offset": offset + len(new_lines),
        "status": status,
        "total_lines": len(all_lines),
    }


@api_router.post("/scans/{scan_id}/stop")
async def stop_scan(scan_id: str):
    db = await get_db()
    row = await (await db.execute("SELECT pid FROM scans WHERE id=?", (scan_id,))).fetchone()
    if row and row[0]:
        try:
            os.kill(row[0], 9)
        except ProcessLookupError:
            pass
    await db.execute("UPDATE scans SET status='stopped' WHERE id=?", (scan_id,))
    await db.commit()
    await db.close()
    return {"status": "stopped"}


@api_router.post("/scans/{scan_id}/analyze")
async def analyze_scan(scan_id: str, background_tasks: BackgroundTasks):
    db = await get_db()
    row = await (await db.execute("SELECT * FROM scans WHERE id=?", (scan_id,))).fetchone()
    await db.close()
    if not row:
        raise HTTPException(status_code=404, detail="Scan not found")

    scan = row_to_dict(row)
    loot_parts = []

    log_file = scan.get("log_file") or f"{LOG_DIR}/{scan_id}.log"
    if log_file and os.path.exists(log_file):
        with open(log_file, "r", errors="replace") as f:
            loot_parts.append("=== TERMINAL OUTPUT ===\n" + f.read()[:30000])

    if not scan.get("demo"):
        loot_summary = collect_loot_summary(scan.get("workspace", ""), scan.get("target", ""))
        if loot_summary != "No loot files found yet.":
            loot_parts.append(loot_summary)

    full_loot = "\n\n".join(loot_parts)
    background_tasks.add_task(do_ai_analysis, scan_id, scan, full_loot)
    return {"status": "analyzing", "message": "AI analysis started"}


@api_router.get("/scans/{scan_id}/plan")
async def get_attack_plan(scan_id: str):
    db = await get_db()
    row = await (await db.execute("SELECT * FROM attack_plans WHERE scan_id=?", (scan_id,))).fetchone()
    await db.close()
    if not row:
        return {"status": "not_ready", "message": "No attack plan yet. Click Analyze with AI to generate one."}
    return row_to_dict(row)


@api_router.get("/scans/{scan_id}/findings")
async def get_scan_findings(scan_id: str, severity: Optional[str] = None):
    db = await get_db()
    if severity:
        rows = await db.execute_fetchall(
            "SELECT * FROM findings WHERE scan_id=? AND severity=? ORDER BY created_at DESC",
            (scan_id, severity.upper()))
    else:
        rows = await db.execute_fetchall(
            "SELECT * FROM findings WHERE scan_id=? ORDER BY created_at DESC", (scan_id,))
    await db.close()
    return [row_to_dict(r) for r in rows]


# ────────────── CHAIN ATTACK ROUTES ──────────────

@api_router.post("/scans/{scan_id}/chain-start")
async def start_chain_attack(scan_id: str, background_tasks: BackgroundTasks):
    db = await get_db()
    row = await (await db.execute("SELECT target, workspace, status FROM scans WHERE id=?", (scan_id,))).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Scan not found")
    if row[2] not in ("completed", "failed"):
        raise HTTPException(status_code=400, detail="Scan must be completed before chaining")

    chain_id = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO chain_runs (id, parent_scan_id, step, status, scan_ids, log, created_at) VALUES (?,?,?,?,?,?,?)",
        (chain_id, scan_id, 0, "running", json.dumps([scan_id]), "[CHAIN] Initializing...", now_iso())
    )
    await db.commit()
    await db.close()

    background_tasks.add_task(run_chain_attack, chain_id, scan_id, row[0], row[1])
    return {"chain_id": chain_id, "status": "started", "message": "Auto chain attack initiated"}


@api_router.get("/scans/{scan_id}/chain")
async def get_chain_status(scan_id: str):
    db = await get_db()
    row = await (await db.execute(
        "SELECT * FROM chain_runs WHERE parent_scan_id=? ORDER BY created_at DESC LIMIT 1", (scan_id,)
    )).fetchone()
    await db.close()
    if not row:
        return {"status": "none", "message": "No chain attack for this scan"}
    d = row_to_dict(row)
    d["log_lines"] = d.get("log", "").split("\n")
    return d


@api_router.get("/chains/{chain_id}")
async def get_chain(chain_id: str):
    db = await get_db()
    row = await (await db.execute("SELECT * FROM chain_runs WHERE id=?", (chain_id,))).fetchone()
    await db.close()
    if not row:
        raise HTTPException(status_code=404, detail="Chain not found")
    d = row_to_dict(row)
    d["log_lines"] = d.get("log", "").split("\n")
    return d


# ────────────── AI ROUTES ──────────────

@api_router.post("/ai/recommend")
async def recommend_scan_mode(req: RecommendRequest):
    return await get_mode_recommendation(req.target, req.context)


@api_router.post("/ai/chat")
async def ai_chat(msg: ChatMessage):
    scan_context = ""
    if msg.scan_id:
        log_file = f"{LOG_DIR}/{msg.scan_id}.log"
        if os.path.exists(log_file):
            with open(log_file, "r", errors="replace") as f:
                scan_context = f.read()[:8000]

    response = await chat_with_ai(msg.message, scan_context)
    db = await get_db()
    await db.execute(
        "INSERT INTO chats (id, scan_id, user_message, ai_response, created_at) VALUES (?,?,?,?,?)",
        (str(uuid.uuid4()), msg.scan_id, msg.message, response, now_iso())
    )
    await db.commit()
    await db.close()
    return {"response": response}


# ────────────── WORKSPACE & FINDINGS ──────────────

@api_router.get("/workspaces")
async def get_workspaces():
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT workspace, target, COUNT(*) as scan_count, MAX(created_at) as last_scan FROM scans GROUP BY workspace ORDER BY last_scan DESC"
    )
    result = []
    for r in rows:
        r = dict(r)
        crit_row = await (await db.execute(
            "SELECT COUNT(*) FROM findings WHERE workspace=? AND severity='CRITICAL'", (r["workspace"],)
        )).fetchone()
        r["critical_findings"] = crit_row[0] if crit_row else 0
        result.append(r)
    await db.close()
    return result


@api_router.get("/findings")
async def get_all_findings(severity: Optional[str] = None, limit: int = 200):
    db = await get_db()
    if severity:
        rows = await db.execute_fetchall(
            "SELECT * FROM findings WHERE severity=? ORDER BY created_at DESC LIMIT ?", (severity.upper(), limit))
    else:
        rows = await db.execute_fetchall(
            "SELECT * FROM findings ORDER BY created_at DESC LIMIT ?", (limit,))
    await db.close()
    return [row_to_dict(r) for r in rows]


app.include_router(api_router)


@app.on_event("startup")
async def startup():
    await init_db()
    logger.info("SQLite DB initialized")
