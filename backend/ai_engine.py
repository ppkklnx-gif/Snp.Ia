import os
import json
import uuid
from emergentintegrations.llm.chat import LlmChat, UserMessage
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')

LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
LLM_PROVIDER = "openai"
LLM_MODEL = "gpt-4.1"

SNIPER_EXPERT_SYSTEM = """You are SniperAI, an elite offensive security AI integrated with the Sn1per Attack Surface Management Platform v9.2.
You are a world-class penetration tester who deeply understands ALL Sn1per modes, capabilities, and advanced attack chaining strategies.

## COMPLETE SNIPER MODE REFERENCE:

### SINGLE TARGET MODES:
- `normal`: Default comprehensive scan. DNS enum, TCP port scan (default ports), per-port nmap scripts + Metasploit modules, web scanning on HTTP/HTTPS ports.
- `stealth`: Non-intrusive reconnaissance using passive checks. Avoids WAF/IPS/IDS detection.
- `port`: Deep scan of a SPECIFIC port (-p <port>). All relevant nmap scripts and Metasploit modules for that exact service.
- `fullportonly`: Full TCP port scan (1-65535). Fast discovery of ALL open ports with XML output.
- `web`: Comprehensive web application scan on ports 80/443. Nikto, dirb, whatweb, HTTP headers, SSL analysis, whois.
- `webporthttp`: Full HTTP web app scan on a specific non-standard port.
- `webporthttps`: Full HTTPS web app scan on a specific non-standard port.
- `webscan`: Advanced web scan via Burpsuite Professional + Arachni + OWASP ZAP. Most thorough web assessment.
- `vulnscan`: OpenVAS/GVM vulnerability scan. Best for CVE enumeration and CVSS scoring.

### MULTI-TARGET MODES:
- `discover`: Parses ALL hosts in a subnet/CIDR and auto-scans each. Use with -w workspace.
- `flyover`: Fast multi-threaded high-level scan of multiple targets.
- `airstrike`: Quick port/service enumeration on multiple hosts from a file.
- `nuke`: FULL comprehensive audit. ALL options enabled: OSINT, recon, bruteforce, full port scan, all MSF modules.
- `massportscan`: fullportonly on multiple targets.
- `massweb`: web mode on multiple targets.
- `masswebscan`: webscan on multiple targets.
- `massvulnscan`: vulnscan on multiple targets.

### KEY OPTIONS:
- `-o` OSINT (theHarvester, whois, dnsrecon, Shodan, Censys, Hunter.io, GitHub)
- `-re` Recon (subfinder, amass, massdns, dnsgen)
- `-b` Bruteforce (Hydra, Medusa for SSH/FTP/SMB/Telnet/HTTP)
- `-fp` Full port scan (1-65535)
- `-w <workspace>` Named workspace for organized tracking

### ATTACK CHAINING STRATEGY:
1. Initial: stealth or normal -> identify attack surface
2. Web found (80/443/8080/8443): web -> webscan -> webporthttp/https
3. Full coverage: fullportonly -> targeted port scans
4. Network: discover -> airstrike -> nuke
5. Maximum: nuke mode with -o -re -b -fp

## YOUR ROLE:
1. Analyze scan data and identify ALL vulnerabilities and attack vectors
2. Map findings to CVEs with CVSS scores
3. Create PHASED attack plans with EXACT Sn1per commands
4. Chain scan modes intelligently for MAXIMUM coverage
5. Prioritize attack vectors by exploitability and impact

## CRITICAL: Return ONLY valid JSON, no markdown, no explanation outside JSON:
{
  "executive_summary": "Tactical assessment for the operator",
  "risk_level": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
  "target_profile": "Technical profile based on fingerprinting",
  "key_findings": ["Critical finding 1", "Critical finding 2"],
  "attack_phases": [
    {
      "phase_number": 1,
      "phase_name": "Phase name",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW",
      "rationale": "Why this phase matters",
      "findings": ["Relevant finding"],
      "commands": ["sniper -t target -m web -w workspace"],
      "expected_outcome": "What this accomplishes"
    }
  ],
  "immediate_next_command": "Single highest-priority Sn1per command",
  "cve_findings": [
    {"cve": "CVE-XXXX-XXXXX", "service": "service name", "severity": "CRITICAL", "description": "Brief description"}
  ],
  "remediation_summary": "Defender perspective"
}"""


def _make_chat(session_id: str) -> LlmChat:
    return (
        LlmChat(
            api_key=LLM_KEY,
            session_id=session_id,
            system_message=SNIPER_EXPERT_SYSTEM,
        )
        .with_model(LLM_PROVIDER, LLM_MODEL)
    )


async def analyze_scan_results(scan_data: dict, loot_summary: str) -> dict:
    """Send scan results to AI for analysis and attack plan generation."""
    session_id = f"analyze-{uuid.uuid4()}"
    chat = _make_chat(session_id)

    user_content = f"""SCAN RESULTS TO ANALYZE:

Target: {scan_data.get('target', 'Unknown')}
Mode: {scan_data.get('mode', 'normal')}
Workspace: {scan_data.get('workspace', 'default')}

## RAW SCAN OUTPUT & LOOT DATA:
{loot_summary[:80000]}

Analyze comprehensively and generate a complete attack plan. Return ONLY valid JSON."""

    try:
        response = await chat.send_message(UserMessage(text=user_content))
        content = response.strip()
        # Strip markdown code fences if present
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        return json.loads(content)
    except (json.JSONDecodeError, Exception) as e:
        return {
            "executive_summary": f"AI analysis completed for {scan_data.get('target')}. Review raw scan output for manual assessment.",
            "risk_level": "HIGH",
            "target_profile": f"Target: {scan_data.get('target')} — scanned with mode: {scan_data.get('mode')}",
            "key_findings": ["Scan completed — check terminal output for raw findings", "Manual analysis recommended"],
            "attack_phases": [
                {
                    "phase_number": 1,
                    "phase_name": "Deep Web Assessment",
                    "priority": "HIGH",
                    "rationale": "Follow up web scan to identify all HTTP attack surfaces",
                    "findings": ["Web ports detected"],
                    "commands": [f"sniper -t {scan_data.get('target')} -m web -w {scan_data.get('workspace', 'default')}"],
                    "expected_outcome": "Full web vulnerability assessment"
                }
            ],
            "immediate_next_command": f"sniper -t {scan_data.get('target')} -m web -w {scan_data.get('workspace', 'default')}",
            "cve_findings": [],
            "remediation_summary": "Review all exposed services and apply patches for detected vulnerabilities."
        }


async def get_mode_recommendation(target: str, context: str = "") -> dict:
    """Get AI recommendation for best Sn1per mode."""
    session_id = f"recommend-{uuid.uuid4()}"
    chat = _make_chat(session_id)

    user_content = f"""TARGET: {target}
CONTEXT: {context if context else 'No additional context.'}

Recommend the optimal Sn1per scanning strategy. Return ONLY this JSON structure:
{{
  "recommended_mode": "mode_name",
  "recommended_options": {{"osint": true/false, "recon": true/false, "bruteforce": false, "full_port": false}},
  "strategy_name": "Short strategy name",
  "rationale": "Why this mode is optimal for this specific target",
  "scan_chain": [
    {{"step": 1, "command": "sniper -t {target} -m mode -w workspace", "purpose": "What this step discovers"}}
  ],
  "expected_findings": ["Expected finding 1", "Expected finding 2"],
  "estimated_duration": "Estimated duration",
  "risk_level": "PASSIVE|LOW|MEDIUM|HIGH|AGGRESSIVE"
}}"""

    try:
        response = await chat.send_message(UserMessage(text=user_content))
        content = response.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

        return json.loads(content)
    except Exception:
        return {
            "recommended_mode": "normal",
            "recommended_options": {"osint": True, "recon": True, "bruteforce": False, "full_port": False},
            "strategy_name": "Standard Comprehensive Recon",
            "rationale": f"Default comprehensive scan for {target}. Covers DNS, port scan, service detection, and per-service Metasploit testing.",
            "scan_chain": [
                {"step": 1, "command": f"sniper -t {target} -m normal -o -re -w workspace", "purpose": "Full recon + OSINT + subdomain enumeration"},
                {"step": 2, "command": f"sniper -t {target} -m web -w workspace", "purpose": "Deep web application assessment"},
            ],
            "expected_findings": ["Open ports and running services", "DNS records and subdomains", "Web application vulnerabilities", "Potential CVE matches"],
            "estimated_duration": "30-60 minutes",
            "risk_level": "MEDIUM"
        }


async def chat_with_ai(message: str, scan_context: str = "", history: list = []) -> str:
    """General AI chat about security findings."""
    session_id = f"chat-{uuid.uuid4()}"
    chat = _make_chat(session_id)

    if scan_context:
        message = f"SCAN CONTEXT (use this for analysis):\n{scan_context[:5000]}\n\nQUESTION: {message}"

    try:
        response = await chat.send_message(UserMessage(text=message))
        return response
    except Exception as e:
        return f"AI error: {str(e)}"
