# SniperAI Command Center

## Instalacion rapida en Kali Linux

```bash
# 1. Clonar
git clone <repo-url> SniperAI
cd SniperAI

# 2. Instalar
bash install.sh

# 3. Configurar tu API key de IA (OpenAI recomendado)
nano backend/.env
# Pon tu AI_API_KEY="sk-..."

# 4. Iniciar
bash start.sh
```

## Uso

- Abre http://localhost:3000 en tu browser
- Entra un objetivo (IP, dominio o CIDR)
- Click **AI RECOMMEND** para que la IA recomiende el modo
- Click **LAUNCH SCAN**
- Cuando termine: **ANALYZE WITH AI** genera el plan de ataque
- **CHAIN ATTACK** ejecuta la cadena automatica guiada por IA

## Activar Sn1per real

```bash
cd /tmp && git clone https://github.com/1N3/Sn1per
cd Sn1per && bash install.sh
```

Una vez instalado, el banner DEMO MODE desaparece y los scans son reales.

## Configurar IA

Edita `backend/.env`:
```env
# OpenAI (recomendado)
AI_API_KEY="sk-..."
AI_MODEL="gpt-4o"

# O Anthropic Claude
AI_API_KEY="sk-ant-..."
AI_MODEL="claude-3-5-sonnet-20241022"
```

## Estructura de archivos

```
SniperAI/
├── backend/
│   ├── server.py        # API FastAPI + SQLite
│   ├── ai_engine.py     # Modulo IA (OpenAI/Anthropic)
│   ├── loot_parser.py   # Parser de archivos de Sn1per
│   ├── database.py      # Schema SQLite
│   ├── sniperai.db      # Base de datos (se crea automaticamente)
│   └── .env             # Configuracion + API keys
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Dashboard.jsx
│       │   ├── NewScan.jsx
│       │   ├── ScanMonitor.jsx  # Terminal en tiempo real
│       │   ├── AttackPlan.jsx   # Plan IA con comandos
│       │   ├── ChainAttack.jsx  # Ataque encadenado auto
│       │   ├── Results.jsx
│       │   └── Workspaces.jsx
│       └── App.js
├── install.sh   # Instalador para Kali
├── start.sh     # Script de arranque
└── README.md
```
