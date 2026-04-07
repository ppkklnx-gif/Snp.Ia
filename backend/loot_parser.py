import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

SNIPER_LOOT_DIR = os.environ.get("SNIPER_LOOT_DIR", "/usr/share/sniper/loot")


def get_workspace_dir(workspace: str) -> str:
    return os.path.join(SNIPER_LOOT_DIR, "workspace", workspace)


def parse_nmap_xml(xml_path: str) -> Dict:
    """Parse nmap XML output and extract open ports/services."""
    results = {"ports": [], "os_detection": None, "scan_stats": {}}

    if not os.path.exists(xml_path):
        return results

    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()

        for host in root.findall("host"):
            for port_elem in host.findall(".//port"):
                state = port_elem.find("state")
                if state is not None and state.get("state") == "open":
                    port_info = {
                        "port": int(port_elem.get("portid", 0)),
                        "protocol": port_elem.get("protocol", "tcp"),
                        "state": "open",
                        "service": None,
                        "version": None,
                        "product": None,
                        "scripts": []
                    }
                    svc = port_elem.find("service")
                    if svc is not None:
                        port_info["service"] = svc.get("name")
                        port_info["product"] = svc.get("product")
                        port_info["version"] = svc.get("version")
                    for script in port_elem.findall("script"):
                        port_info["scripts"].append({
                            "id": script.get("id"),
                            "output": script.get("output", "")[:500]
                        })
                    results["ports"].append(port_info)

            os_elem = host.find(".//osmatch")
            if os_elem is not None:
                results["os_detection"] = {
                    "name": os_elem.get("name"),
                    "accuracy": os_elem.get("accuracy")
                }

    except Exception as e:
        logger.warning(f"Failed to parse nmap XML {xml_path}: {e}")

    return results


def collect_loot_summary(workspace: str, target: str) -> str:
    """Collect all relevant loot files into a single string for AI analysis."""
    loot_dir = get_workspace_dir(workspace)
    summary_parts = []

    # Nmap port list
    ports_file = os.path.join(loot_dir, "nmap", f"ports-{target}.txt")
    if os.path.exists(ports_file):
        content = Path(ports_file).read_text(errors="replace")
        summary_parts.append(f"### OPEN PORTS:\n{content}")

    # Nmap main scan
    nmap_txt = os.path.join(loot_dir, "nmap", f"nmap-{target}.txt")
    if os.path.exists(nmap_txt):
        content = Path(nmap_txt).read_text(errors="replace")[:5000]
        summary_parts.append(f"### NMAP SCAN OUTPUT:\n{content}")

    # DNS info
    dns_file = os.path.join(loot_dir, "nmap", f"dns-{target}.txt")
    if os.path.exists(dns_file):
        content = Path(dns_file).read_text(errors="replace")
        summary_parts.append(f"### DNS RECORDS:\n{content}")

    # Per-port nmap output
    output_dir = os.path.join(loot_dir, "output")
    if os.path.exists(output_dir):
        for fname in sorted(os.listdir(output_dir)):
            if fname.startswith(f"nmap-{target}") or fname.startswith(f"msf-{target}"):
                fpath = os.path.join(output_dir, fname)
                try:
                    content = Path(fpath).read_text(errors="replace")[:2000]
                    summary_parts.append(f"### {fname.upper()}:\n{content}")
                except Exception:
                    pass

    # Web findings
    web_dir = os.path.join(loot_dir, "web")
    if os.path.exists(web_dir):
        for fname in sorted(os.listdir(web_dir)):
            if target in fname:
                fpath = os.path.join(web_dir, fname)
                try:
                    content = Path(fpath).read_text(errors="replace")[:2000]
                    summary_parts.append(f"### WEB/{fname}:\n{content}")
                except Exception:
                    pass

    # Vulnerability reports
    vuln_dir = os.path.join(loot_dir, "vulnerabilities")
    if os.path.exists(vuln_dir):
        for fname in sorted(os.listdir(vuln_dir)):
            fpath = os.path.join(vuln_dir, fname)
            try:
                content = Path(fpath).read_text(errors="replace")[:3000]
                summary_parts.append(f"### VULN/{fname}:\n{content}")
            except Exception:
                pass

    # OSINT
    osint_dir = os.path.join(loot_dir, "osint")
    if os.path.exists(osint_dir):
        for fname in sorted(os.listdir(osint_dir)):
            fpath = os.path.join(osint_dir, fname)
            try:
                content = Path(fpath).read_text(errors="replace")[:2000]
                summary_parts.append(f"### OSINT/{fname}:\n{content}")
            except Exception:
                pass

    return "\n\n".join(summary_parts) if summary_parts else "No loot files found yet."


def extract_findings_from_nmap(xml_path: str, scan_id: str, workspace: str, target: str) -> List[Dict]:
    """Extract structured findings from nmap XML."""
    findings = []
    nmap_data = parse_nmap_xml(xml_path)

    for port_info in nmap_data["ports"]:
        finding = {
            "scan_id": scan_id,
            "workspace": workspace,
            "type": "open_port",
            "severity": _port_severity(port_info["port"], port_info.get("service")),
            "title": f"Open Port {port_info['port']}/{port_info['protocol']} - {port_info.get('service', 'unknown')}",
            "description": _build_port_description(port_info),
            "host": target,
            "port": port_info["port"],
            "service": port_info.get("service"),
            "product": port_info.get("product"),
            "version": port_info.get("version"),
            "cve": None,
            "raw": port_info
        }
        findings.append(finding)

        # Check scripts for vulnerabilities
        for script in port_info.get("scripts", []):
            if any(kw in script.get("output", "").lower() for kw in ["vuln", "cve-", "vulnerable", "exploit"]):
                cve_match = re.search(r"CVE-\d{4}-\d+", script.get("output", ""))
                findings.append({
                    "scan_id": scan_id,
                    "workspace": workspace,
                    "type": "vulnerability",
                    "severity": "HIGH",
                    "title": f"{script['id']} on port {port_info['port']}",
                    "description": script.get("output", "")[:500],
                    "host": target,
                    "port": port_info["port"],
                    "service": port_info.get("service"),
                    "cve": cve_match.group(0) if cve_match else None,
                    "raw": script
                })

    return findings


def _port_severity(port: int, service: Optional[str]) -> str:
    high_risk = [21, 23, 25, 69, 79, 111, 137, 139, 445, 512, 513, 514, 623, 1099, 1524, 2049, 5900, 6667, 27017]
    medium_risk = [22, 80, 110, 135, 389, 443, 1433, 2181, 3128, 3306, 3389, 5432, 5984, 8080, 8443, 9200]
    if port in high_risk:
        return "HIGH"
    if port in medium_risk:
        return "MEDIUM"
    return "LOW"


def _build_port_description(port_info: Dict) -> str:
    parts = [f"Port {port_info['port']}/{port_info['protocol']} is open."]
    if port_info.get("product"):
        parts.append(f"Service: {port_info['product']} {port_info.get('version', '')}")
    if port_info.get("service"):
        parts.append(f"Protocol: {port_info['service']}")
    return " ".join(parts)


def list_workspaces() -> List[Dict]:
    """List all Sn1per workspaces from loot directory."""
    workspace_base = os.path.join(SNIPER_LOOT_DIR, "workspace")
    workspaces = []

    if not os.path.exists(workspace_base):
        return []

    for name in os.listdir(workspace_base):
        ws_path = os.path.join(workspace_base, name)
        if os.path.isdir(ws_path):
            targets_file = os.path.join(ws_path, "domains", "targets.txt")
            target_count = 0
            if os.path.exists(targets_file):
                with open(targets_file) as f:
                    target_count = len([l for l in f.read().splitlines() if l.strip()])

            workspaces.append({
                "name": name,
                "path": ws_path,
                "target_count": target_count,
                "last_modified": os.path.getmtime(ws_path)
            })

    return sorted(workspaces, key=lambda x: x["last_modified"], reverse=True)
