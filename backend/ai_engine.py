import os
import json
import uuid
from openai import AsyncOpenAI
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')

KIMI_API_KEY = os.environ.get("KIMI_API_KEY")
KIMI_BASE_URL = os.environ.get("KIMI_BASE_URL", "https://api.moonshot.cn/v1")
KIMI_MODEL = os.environ.get("KIMI_MODEL", "kimi-k2.5")

SNIPER_EXPERT_SYSTEM = """You are SniperAI, an elite offensive security AI integrated with the Sn1per Attack Surface Management Platform v9.2.
You are a world-class penetration tester who deeply understands ALL Sn1per modes, capabilities, and advanced attack chaining strategies.

## COMPLETE SNIPER MODE REFERENCE:

### SINGLE TARGET MODES:
- `normal`: Default comprehensive scan. DNS enum, TCP port scan (default ports), per-port nmap scripts + Metasploit modules, web scanning on HTTP/HTTPS ports.
- `stealth`: Non-intrusive reconnaissance using passive checks. Avoids WAF/IPS/IDS detection. Best for OPSEC-conscious recon.
- `port`: Deep scan of a SPECIFIC port (-p <port>). All relevant nmap scripts and Metasploit modules for that exact service.
- `fullportonly`: Full TCP port scan (1-65535). Fast discovery of ALL open ports with XML output.
- `web`: Comprehensive web application scan on ports 80/443. Nikto, dirb, whatweb, HTTP headers, SSL analysis, whois, screenshot capture.
- `webporthttp`: Full HTTP web app scan on a specific non-standard port. Use after finding unusual HTTP services.
- `webporthttps`: Full HTTPS web app scan on a specific non-standard port.
- `webscan`: Advanced web scan via Burpsuite Professional + Arachni + OWASP ZAP. Most thorough web assessment possible.
- `vulnscan`: OpenVAS/GVM vulnerability scan. Best for CVE enumeration, CVSS scoring, comprehensive vulnerability assessment.

### MULTI-TARGET MODES:
- `discover`: Parses ALL hosts in a subnet/CIDR (e.g., 192.168.0.0/16) and auto-scans each. Always use with -w workspace.
- `flyover`: Fast multi-threaded high-level scan of multiple targets. Good for quick initial asset inventory.
- `airstrike`: Quick port/service enumeration + basic fingerprinting on multiple hosts from a file.
- `nuke`: FULL comprehensive audit of multiple hosts. ALL options enabled: OSINT, recon, bruteforce, full port scan, all MSF modules. Maximum aggression.
- `massportscan`: fullportonly mode on multiple targets simultaneously.
- `massweb`: web mode on multiple targets.
- `masswebscan`: webscan mode on multiple targets.
- `massvulnscan`: vulnscan/OpenVAS on multiple targets.

### KEY SNIPER OPTIONS:
- `-o` / `--osint`: OSINT scan (theHarvester, whois, dnsrecon, Shodan API, Censys API, Hunter.io, GitHub recon, LinkedIn, Twitter)
- `-re` / `--recon`: Subdomain recon (subfinder, amass, massdns, dnsgen, altdns, dnsx)
- `-b` / `--bruteforce`: Bruteforce (Hydra, Medusa for SSH/FTP/SMB/Telnet/HTTP/HTTPS auth, credential stuffing)
- `-fp` / `--fullportscan`: Add full port scan (1-65535) to any mode for complete coverage
- `-w <workspace>`: Assign results to a named workspace for organized tracking

### ATTACK CHAINING INTELLIGENCE:
1. **Initial Recon**: stealth or normal → identify attack surface
2. **Web Assets Found** (ports 80/443/8080/8443): web → webscan → webporthttp/https
3. **Full Coverage**: fullportonly → port scans for each open port found
4. **Service Exploitation**: per-service port scans with MSF modules enabled
5. **Network Discovery**: discover → airstrike → nuke (for internal networks)
6. **Maximum Aggression**: nuke mode with -o -re -b -fp for full compromise attempt
7. **Stealth Campaign**: stealth → flyover → targeted port scans (minimal footprint)

### SNIPERS LOOT STRUCTURE:
- `nmap/nmap-{target}.xml` - Port scan XML (parse with python-libnmap)
- `nmap/ports-{target}.txt` - Open ports list
- `nmap/dns-{target}.txt` - DNS records
- `output/nmap-{target}-port{N}.txt` - Per-port nmap script results
- `output/msf-{target}-port{N}-{module}.txt` - Metasploit module results
- `web/` - HTTP headers, page titles, httprobe, dirsearch, spider
- `vulnerabilities/` - Vulnerability reports, sc0pe results
- `credentials/` - Extracted credentials
- `osint/` - OSINT enumeration data

## YOUR ROLE:
1. Analyze raw scan data and identify ALL vulnerabilities and attack vectors
2. Map findings to CVEs with CVSS scores
3. Create PHASED attack plans with EXACT Sn1per commands ready to execute
4. Chain scan modes intelligently for MAXIMUM coverage and impact
5. Prioritize attack vectors by exploitability and impact
6. Generate actionable offensive security intelligence

## RESPONSE FORMAT - ALWAYS return valid JSON only, no markdown:
{
  "executive_summary": "Concise tactical assessment for the operator",
  "risk_level": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
  "target_profile": "Technical profile of target based on fingerprinting data",
  "key_findings": ["Critical finding 1", "Critical finding 2"],
  "attack_phases": [
    {
      "phase_number": 1,
      "phase_name": "Phase name",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW",
      "rationale": "Why this phase matters and what vectors it exploits",
      "findings": ["Relevant finding 1"],
      "commands": ["sniper -t target -m web -w workspace"],
      "expected_outcome": "What this phase will accomplish"
    }
  ],
  "immediate_next_command": "Single highest-priority Sn1per command to run right now",
  "cve_findings": [
    {"cve": "CVE-XXXX-XXXXX", "service": "service name", "severity": "CRITICAL", "description": "Brief description"}
  ],
  "remediation_summary": "Defender perspective on fixing these issues"
}"""


async def get_kimi_client():
    return AsyncOpenAI(
        api_key=KIMI_API_KEY,
        base_url=KIMI_BASE_URL,
    )


async def analyze_scan_results(scan_data: dict, loot_summary: str) -> dict:
    """Send scan results to Kimi for AI analysis and attack plan generation."""
    client = await get_kimi_client()

    user_content = f"""SCAN RESULTS TO ANALYZE:

Target: {scan_data.get('target', 'Unknown')}
Mode: {scan_data.get('mode', 'normal')}
Workspace: {scan_data.get('workspace', 'default')}
Scan Duration: {scan_data.get('duration', 'Unknown')}

## RAW SCAN OUTPUT & LOOT DATA:
{loot_summary[:100000]}

Analyze this data comprehensively and generate a complete attack plan with exact Sn1per commands for the next phases of exploitation. Return ONLY valid JSON following the specified format."""

    try:
        response = await client.chat.completions.create(
            model=KIMI_MODEL,
            messages=[
                {"role": "system", "content": SNIPER_EXPERT_SYSTEM},
                {"role": "user", "content": user_content}
            ],
            temperature=0.3,
            max_tokens=8000,
        )

        content = response.choices[0].message.content.strip()
        # Clean any markdown code blocks
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1]) if lines[-1] == "```" else "\n".join(lines[1:])

        return json.loads(content)
    except json.JSONDecodeError:
        return {
            "executive_summary": "AI analysis completed. Manual review of raw output recommended.",
            "risk_level": "UNKNOWN",
            "target_profile": f"Target: {scan_data.get('target')}",
            "key_findings": ["Raw scan data collected - check loot directory for details"],
            "attack_phases": [],
            "immediate_next_command": f"sniper -t {scan_data.get('target')} -m normal -o -re",
            "cve_findings": [],
            "remediation_summary": "Review scan output manually."
        }


async def get_mode_recommendation(target: str, context: str = "") -> dict:
    """Ask Kimi to recommend the best Sn1per mode for a target."""
    client = await get_kimi_client()

    user_content = f"""TARGET: {target}
CONTEXT: {context if context else 'No additional context provided.'}

Analyze this target and recommend the optimal Sn1per scanning strategy. Consider:
1. Target type (IP, domain, CIDR, URL)
2. What modes to run and in what order
3. Which options (-o, -re, -b, -fp) to enable
4. Expected attack vectors

Return JSON with this exact structure:
{{
  "recommended_mode": "mode_name",
  "recommended_options": {{
    "osint": true/false,
    "recon": true/false,
    "bruteforce": true/false,
    "full_port": true/false
  }},
  "strategy_name": "Short name for the strategy",
  "rationale": "Why this mode is optimal for this target",
  "scan_chain": [
    {{"step": 1, "command": "sniper -t {target} -m mode -w workspace", "purpose": "What this step finds"}}
  ],
  "expected_findings": ["What we expect to discover"],
  "estimated_duration": "Estimated scan duration",
  "risk_level": "PASSIVE|LOW|MEDIUM|HIGH|AGGRESSIVE"
}}"""

    try:
        response = await client.chat.completions.create(
            model=KIMI_MODEL,
            messages=[
                {"role": "system", "content": SNIPER_EXPERT_SYSTEM},
                {"role": "user", "content": user_content}
            ],
            temperature=0.4,
            max_tokens=2000,
        )

        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1]) if lines[-1] == "```" else "\n".join(lines[1:])

        return json.loads(content)
    except Exception as e:
        return {
            "recommended_mode": "normal",
            "recommended_options": {"osint": True, "recon": True, "bruteforce": False, "full_port": False},
            "strategy_name": "Standard Recon",
            "rationale": f"Default comprehensive scan for {target}. Covers DNS, port scan, service detection, and per-service testing.",
            "scan_chain": [
                {"step": 1, "command": f"sniper -t {target} -m normal -o -re -w workspace", "purpose": "Full recon + OSINT + subdomain enum"}
            ],
            "expected_findings": ["Open ports and services", "DNS records", "Potential vulnerabilities"],
            "estimated_duration": "30-60 minutes",
            "risk_level": "MEDIUM"
        }


async def chat_with_ai(message: str, scan_context: str = "", history: list = []) -> str:
    """General AI chat about security findings."""
    client = await get_kimi_client()

    messages = [{"role": "system", "content": SNIPER_EXPERT_SYSTEM}]
    for h in history[-10:]:  # Last 10 messages for context
        messages.append(h)

    if scan_context:
        message = f"SCAN CONTEXT:\n{scan_context[:5000]}\n\nQUESTION: {message}"

    messages.append({"role": "user", "content": message})

    try:
        response = await client.chat.completions.create(
            model=KIMI_MODEL,
            messages=messages,
            temperature=0.5,
            max_tokens=3000,
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"AI error: {str(e)}"
