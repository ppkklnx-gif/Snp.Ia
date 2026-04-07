"""
AI Engine para SniperAI
Estrategia de carga:
  1. Si está disponible → usa emergentintegrations (Emergent cloud, key incluida)
  2. Si no → usa openai SDK estándar con AI_API_KEY del .env
     Soporta OpenAI, Anthropic (vía openai-compatible), etc.
"""
import os, json, uuid, logging
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')
logger = logging.getLogger(__name__)

AI_API_KEY  = os.environ.get("AI_API_KEY") or os.environ.get("OPENAI_API_KEY", "")
AI_MODEL    = os.environ.get("AI_MODEL", "gpt-4o")
AI_BASE_URL = os.environ.get("AI_BASE_URL", None)

# ── Lógica de backend AI ──
# Si hay AI_BASE_URL (= Kimi u otro proveedor externo) → SIEMPRE openai SDK directo
# Si NO hay AI_BASE_URL → intentar emergentintegrations (Emergent cloud)
USE_EMERGENT = False

if AI_BASE_URL:
    # Kimi u otro proveedor con endpoint personalizado → nunca usar emergentintegrations
    from openai import AsyncOpenAI
    logger.info(f"Kimi/custom: openai SDK → {AI_BASE_URL} modelo={AI_MODEL}")
else:
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
        if EMERGENT_KEY:
            USE_EMERGENT = True
            logger.info("Emergent cloud: usando emergentintegrations")
        else:
            from openai import AsyncOpenAI
            logger.info("openai SDK directo (sin EMERGENT_LLM_KEY)")
    except ImportError:
        from openai import AsyncOpenAI
        logger.info("openai SDK directo (emergentintegrations no instalado)")

# ──────────────────────────────────────────────
SNIPER_SYSTEM = """You are SniperAI, an elite offensive security AI for the Sn1per Attack Surface Management Platform v9.2.
You are a world-class penetration tester who knows ALL Sn1per modes and attack chaining strategies.

## ALL SNIPER MODES (VULNSCAN ELIMINADO):
SINGLE: normal, stealth, port, fullportonly, web, webporthttp, webporthttps, webscan
MULTI:  discover, flyover, airstrike, nuke, massportscan, massweb, masswebscan
OPTIONS: -o(OSINT) -re(Recon) -b(Bruteforce) -fp(Full 65535 ports) -w(Workspace)

## METASPLOIT INTEGRATION (ACTIVADO EN CONF):
Sn1per corre con METASPLOIT_EXPLOIT=1 que activa exploits reales por puerto:
- Puerto 21 vsftpd 2.3.4  → exploit/unix/ftp/vsftpd_234_backdoor
- Puerto 22 libssh        → scanner/ssh/libssh_auth_bypass
- Puerto 445 SMB          → exploit/windows/smb/ms17_010_eternalblue (EternalBlue)
- Puerto 3306 MySQL       → exploit/linux/mysql/mysql_yassl_getname
- Puerto 3389 RDP         → scanner/rdp/cve_2019_0708_bluekeep
- Puerto 5900 VNC         → auxiliary/scanner/vnc/vnc_none_auth
- Puerto 6667 IRC         → unix/irc/unreal_ircd_3281_backdoor
- Puerto 80/443 Web       → web exploits via nikto + dirb + whatweb

## ATTACK CHAIN STRATEGY (CON EXPLOTACIÓN REAL):
1. normal → descubrir superficie + exploits MSF automáticos por puerto
2. Si puerto 80/443: web → webscan → buscar SQLi/XSS/RCE
3. Si SMB 445: nuke -b (EternalBlue + bruteforce)
4. Si múltiples hosts: discover → airstrike → nuke
5. Máxima cobertura: nuke -o -re -b -fp (todo activado)

## YOUR ROLE:
Analyze scan data, map CVEs, create phased attack plans with EXACT sniper commands.

## RETURN ONLY VALID JSON (no markdown, no extra text):
{
  "executive_summary": "Operator-focused tactical summary",
  "risk_level": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
  "target_profile": "Technical fingerprint summary",
  "key_findings": ["Critical finding 1", "Critical finding 2"],
  "attack_phases": [
    {
      "phase_number": 1,
      "phase_name": "Phase Name",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW",
      "rationale": "Why this matters",
      "findings": ["Relevant finding"],
      "commands": ["sniper -t TARGET -m web -w WORKSPACE"],
      "expected_outcome": "What this accomplishes"
    }
  ],
  "immediate_next_command": "Single best next command",
  "cve_findings": [{"cve": "CVE-XXXX-XXXXX", "service": "svc", "severity": "HIGH", "description": "desc"}],
  "remediation_summary": "Defender perspective"
}"""
# ──────────────────────────────────────────────


def _clean(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        end = -1 if lines[-1].strip() in ("```", "```json") else len(lines)
        text = "\n".join(lines[1:end])
    return text.strip()


async def _ask_emergent(prompt: str, session_id: str) -> str:
    chat = LlmChat(
        api_key=EMERGENT_KEY,
        session_id=session_id,
        system_message=SNIPER_SYSTEM,
    ).with_model("openai", "gpt-4.1")
    return await chat.send_message(UserMessage(text=prompt))


async def _ask_openai(prompt: str) -> str:
    kwargs = {"api_key": AI_API_KEY}
    if AI_BASE_URL:
        kwargs["base_url"] = AI_BASE_URL
    client = AsyncOpenAI(**kwargs)
    # kimi-k2.5 solo acepta temperature=1; otros modelos admiten variaciones
    temp = 1 if "kimi" in AI_MODEL.lower() or "moonshot" in AI_MODEL.lower() else 0.3
    resp = await client.chat.completions.create(
        model=AI_MODEL,
        messages=[
            {"role": "system", "content": SNIPER_SYSTEM},
            {"role": "user",   "content": prompt},
        ],
        temperature=temp,
        max_tokens=8000,
    )
    return resp.choices[0].message.content


async def _ask(prompt: str, session_id: str = None) -> str:
    if USE_EMERGENT:
        return await _ask_emergent(prompt, session_id or str(uuid.uuid4()))
    else:
        return await _ask_openai(prompt)


# ──────────────────────────────────────────────

async def analyze_scan_results(scan_data: dict, loot_summary: str) -> dict:
    prompt = f"""SCAN TO ANALYZE:
Target: {scan_data.get('target')}  Mode: {scan_data.get('mode')}  Workspace: {scan_data.get('workspace')}

## SCAN DATA:
{loot_summary[:80000]}

Return ONLY valid JSON attack plan."""
    try:
        raw = await _ask(prompt, f"analyze-{uuid.uuid4()}")
        return json.loads(_clean(raw))
    except Exception as e:
        err = str(e)
        logger.error(f"AI analyze error: {err}")
        if "401" in err or "Incorrect API key" in err or "Authentication" in err:
            return _key_error_plan(scan_data)
        return _fallback_plan(scan_data)


async def get_mode_recommendation(target: str, context: str = "") -> dict:
    prompt = f"""TARGET: {target}
CONTEXT: {context or 'None'}

Recommend optimal Sn1per strategy. Return ONLY this JSON:
{{
  "recommended_mode": "mode",
  "recommended_options": {{"osint": true, "recon": true, "bruteforce": false, "full_port": false}},
  "strategy_name": "Name",
  "rationale": "Why optimal for this target",
  "scan_chain": [{{"step": 1, "command": "sniper -t {target} -m mode -w ws", "purpose": "Purpose"}}],
  "expected_findings": ["Finding 1", "Finding 2"],
  "estimated_duration": "X min",
  "risk_level": "PASSIVE|LOW|MEDIUM|HIGH|AGGRESSIVE"
}}"""
    try:
        raw = await _ask(prompt, f"recommend-{uuid.uuid4()}")
        return json.loads(_clean(raw))
    except Exception:
        return _default_recommendation(target)


async def chat_with_ai(message: str, scan_context: str = "", history: list = []) -> str:
    if scan_context:
        message = f"SCAN CONTEXT:\n{scan_context[:5000]}\n\nQUESTION: {message}"
    try:
        return await _ask(message, f"chat-{uuid.uuid4()}")
    except Exception as e:
        err = str(e)
        if "401" in err or "Incorrect API key" in err or "Authentication" in err:
            return "SIN CREDITOS AI: Ve a Profile → Universal Key → Add Balance en Emergent, o configura AI_API_KEY en backend/.env con tu key de Kimi/OpenAI."
        return f"AI error: {err[:200]}"


def _key_error_plan(scan_data: dict) -> dict:
    t = scan_data.get("target", "target")
    w = scan_data.get("workspace", "default")
    return {
        "executive_summary": f"CREDITOS AI AGOTADOS — Recarga el balance de tu Universal Key en Emergent (Profile → Universal Key → Add Balance). Los hallazgos del scan siguen disponibles abajo.",
        "risk_level": "HIGH",
        "target_profile": f"Target: {t} — scan completado exitosamente",
        "key_findings": [
            "Scan ejecutado correctamente — hallazgos disponibles en panel de findings",
            "Para análisis IA: recarga balance en Emergent o configura tu key de Kimi en backend/.env"
        ],
        "attack_phases": [
            {
                "phase_number": 1, "phase_name": "Web Application Deep Scan",
                "priority": "HIGH",
                "rationale": "Puertos web detectados — escaneo web profundo recomendado",
                "findings": ["Puertos HTTP/HTTPS abiertos"],
                "commands": [f"sniper -t {t} -m web -w {w}", f"sniper -t {t} -m webscan -w {w}"],
                "expected_outcome": "Enumeración completa de vulnerabilidades web"
            },
            {
                "phase_number": 2, "phase_name": "Full Port Scan",
                "priority": "MEDIUM",
                "rationale": "Identificar todos los servicios expuestos",
                "findings": ["Posibles puertos ocultos"],
                "commands": [f"sniper -t {t} -m fullportonly -w {w}"],
                "expected_outcome": "Mapa completo de superficie de ataque"
            }
        ],
        "immediate_next_command": f"sniper -t {t} -m web -o -w {w}",
        "cve_findings": [],
        "remediation_summary": "Revisar los hallazgos del scan manualmente en el panel de findings."
    }


def _fallback_plan(scan_data: dict) -> dict:
    t = scan_data.get("target", "target")
    w = scan_data.get("workspace", "default")
    return {
        "executive_summary": f"Scan completed for {t}. Configure AI_API_KEY in backend/.env to enable AI analysis.",
        "risk_level": "HIGH",
        "target_profile": f"Target: {t}",
        "key_findings": ["Scan data collected — configure AI key for full analysis"],
        "attack_phases": [{
            "phase_number": 1, "phase_name": "Web Deep Scan",
            "priority": "HIGH",
            "rationale": "Standard follow-up for web assets found",
            "findings": ["Open web port"],
            "commands": [f"sniper -t {t} -m web -w {w}", f"sniper -t {t} -m webscan -w {w}"],
            "expected_outcome": "Full web vulnerability assessment"
        }],
        "immediate_next_command": f"sniper -t {t} -m web -w {w}",
        "cve_findings": [],
        "remediation_summary": "Patch exposed services and rotate any leaked credentials."
    }


def _default_recommendation(target: str) -> dict:
    return {
        "recommended_mode": "normal",
        "recommended_options": {"osint": True, "recon": True, "bruteforce": False, "full_port": False},
        "strategy_name": "Standard Comprehensive Recon",
        "rationale": f"DNS enum + port scan + per-service nmap/MSF for {target}",
        "scan_chain": [
            {"step": 1, "command": f"sniper -t {target} -m normal -o -re -w workspace", "purpose": "Full recon + OSINT"},
            {"step": 2, "command": f"sniper -t {target} -m web -w workspace", "purpose": "Web app assessment"},
        ],
        "expected_findings": ["Open ports and services", "DNS subdomains", "Web vulnerabilities"],
        "estimated_duration": "30-60 min",
        "risk_level": "MEDIUM"
    }
