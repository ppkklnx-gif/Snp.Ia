#!/usr/bin/env bash
# ============================================================
#  SniperAI — Script de instalación para Kali Linux
# ============================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "  ____        _                  _    ___ "
echo " / ___| _ __ (_)_ __   ___ _ __/ \  |_ _|"
echo " \___ \| '_ \| | '_ \ / _ \ '__/ _ \  | | "
echo "  ___) | | | | | |_) |  __/ | / ___ \ | | "
echo " |____/|_| |_|_| .__/ \___|_|/_/   \_\___|"
echo "                |_|  COMMAND CENTER        "
echo -e "${NC}"
echo "Instalando SniperAI en Kali Linux..."
echo ""

# ── Python venv ──
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}[*] Creando entorno virtual Python...${NC}"
    python3 -m venv venv
fi
source venv/bin/activate

echo -e "${YELLOW}[*] Instalando dependencias Python...${NC}"
pip install --quiet --upgrade pip
pip install --quiet -r backend/requirements.txt

# emergentintegrations (índice especial de Emergent)
echo -e "${YELLOW}[*] Instalando emergentintegrations...${NC}"
pip install --quiet emergentintegrations \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ \
    || echo -e "${YELLOW}[!] emergentintegrations no disponible — la IA usará openai SDK directo${NC}"

# ── Node.js / Yarn para frontend ──
if command -v node &> /dev/null; then
    echo -e "${YELLOW}[*] Instalando dependencias del frontend...${NC}"
    cd frontend
    if command -v yarn &> /dev/null; then
        yarn install --silent
    else
        npm install --silent
    fi
    cd ..
else
    echo -e "${YELLOW}[!] Node.js no encontrado — solo se iniciará el backend${NC}"
fi

# ── Configurar .env si no existe ──
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}[*] Creando backend/.env...${NC}"
    cat > backend/.env << 'EOF'
CORS_ORIGINS="*"
SQLITE_DB="sniperai.db"
SNIPER_INSTALL_DIR="/usr/share/sniper"
SNIPER_LOOT_DIR="/usr/share/sniper/loot"

# ── Kimi AI (Moonshot) — endpoint INTERNACIONAL ──
AI_PROVIDER="openai"
AI_API_KEY=""
AI_MODEL="kimi-k2.5"
AI_BASE_URL="https://api.moonshot.ai/v1"

# Para usar OpenAI en su lugar:
# AI_API_KEY="sk-..."
# AI_MODEL="gpt-4o"
# AI_BASE_URL=""
EOF
    echo ""
    echo -e "${YELLOW}IMPORTANTE: Edita backend/.env y pon tu AI_API_KEY de Kimi${NC}"
    echo -e "  Obtener key: ${GREEN}https://platform.moonshot.ai${NC} → API Keys"
    echo ""
fi

echo ""
echo -e "${GREEN}[+] Instalación completa!${NC}"
echo ""
echo -e "Para iniciar SniperAI ejecuta:"
echo -e "  ${YELLOW}./start.sh${NC}"
echo ""
