"""
Genera un sniper.conf con Metasploit exploitation activado.
Sn1per usa este conf para saber si debe correr módulos MSF por puerto.
"""
import os
import subprocess
from pathlib import Path

SNIPER_CONF_BASE = "/usr/share/sniper/sniper.conf"
SNIPERAI_CONF = "/tmp/sniperai_exploit.conf"


def build_exploit_conf(lhost: str = "0.0.0.0", lport: int = 4444) -> str:
    """Crea un conf personalizado con todas las opciones de explotación activas."""
    # Leer conf base si existe
    base = ""
    if os.path.exists(SNIPER_CONF_BASE):
        with open(SNIPER_CONF_BASE, "r") as f:
            base = f.read()
    elif os.path.exists("/root/.sniper.conf"):
        with open("/root/.sniper.conf", "r") as f:
            base = f.read()

    # Opciones de explotación que activamos
    exploit_overrides = {
        "METASPLOIT_EXPLOIT": "1",    # Ejecutar módulos MSF por puerto
        "NMAP_SCRIPTS": "1",          # Scripts NSE de nmap (incluyendo vuln)
        "MSF_LHOST": lhost,           # LHOST para payloads
        "MSF_LPORT": str(lport),      # LPORT para payloads
        "SSH_AUDIT": "1",
        "SMB_ENUM": "1",
        "HTTP_PROBE": "1",
        "REPORT": "1",
        "LOOT": "1",
    }

    if not base:
        # Sin conf base, generar uno mínimo
        lines = [f'{k}="{v}"' for k, v in exploit_overrides.items()]
        conf_content = "\n".join(lines) + "\n"
    else:
        # Parchear el conf base con nuestros valores
        result_lines = []
        patched_keys = set()
        for line in base.splitlines():
            stripped = line.strip()
            if stripped.startswith("#") or "=" not in stripped:
                result_lines.append(line)
                continue
            key = stripped.split("=")[0].strip().strip('"')
            if key in exploit_overrides:
                result_lines.append(f'{key}="{exploit_overrides[key]}"')
                patched_keys.add(key)
            else:
                result_lines.append(line)
        # Agregar claves que no estaban en el conf base
        for k, v in exploit_overrides.items():
            if k not in patched_keys:
                result_lines.append(f'{k}="{v}"')
        conf_content = "\n".join(result_lines) + "\n"

    with open(SNIPERAI_CONF, "w") as f:
        f.write(conf_content)

    return SNIPERAI_CONF


def msf_available() -> bool:
    try:
        r = subprocess.run(["which", "msfconsole"], capture_output=True, timeout=3)
        return r.returncode == 0
    except Exception:
        return False


def nmap_available() -> bool:
    try:
        r = subprocess.run(["which", "nmap"], capture_output=True, timeout=3)
        return r.returncode == 0
    except Exception:
        return False
