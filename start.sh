#!/usr/bin/env bash
# ============================================================
#  SniperAI — Arranque en Kali Linux
# ============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

FRONTEND_PORT=3001
BACKEND_PORT=8001

# Activar venv si existe
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Verificar dependencias
python3 -c "import fastapi, aiosqlite" 2>/dev/null || {
    echo -e "${RED}[!] Dependencias no instaladas. Ejecuta primero: bash install.sh${NC}"
    exit 1
}

# ── Liberar puertos si están ocupados ──
free_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}[*] Puerto $port ocupado (PID $pid) — liberando...${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
        echo -e "${GREEN}[+] Puerto $port libre${NC}"
    fi
}

free_port $BACKEND_PORT
free_port $FRONTEND_PORT

echo -e "${GREEN}[+] Iniciando SniperAI...${NC}"
echo ""

# ── Backend ──
echo -e "${YELLOW}[*] Backend en http://localhost:${BACKEND_PORT}${NC}"
cd backend
python3 -m uvicorn server:app \
    --host 0.0.0.0 \
    --port $BACKEND_PORT \
    --reload &
BACKEND_PID=$!
cd ..
sleep 2

# ── Frontend (si node está disponible) ──
if command -v node &> /dev/null && [ -d "frontend" ]; then
    echo -e "${YELLOW}[*] Frontend en http://localhost:${FRONTEND_PORT}${NC}"
    cd frontend

    # Configurar .env local
    if [ ! -f ".env" ]; then
        cat > .env << EOF
REACT_APP_BACKEND_URL=http://localhost:${BACKEND_PORT}
WDS_SOCKET_PORT=443
PORT=${FRONTEND_PORT}
EOF
    else
        # Asegurar puerto correcto aunque ya exista el .env
        grep -q "^PORT=" .env \
            && sed -i "s/^PORT=.*/PORT=${FRONTEND_PORT}/" .env \
            || echo "PORT=${FRONTEND_PORT}" >> .env
        grep -q "^REACT_APP_BACKEND_URL=" .env \
            || echo "REACT_APP_BACKEND_URL=http://localhost:${BACKEND_PORT}" >> .env
    fi

    if command -v yarn &> /dev/null; then
        yarn start &
    else
        npm start &
    fi
    FRONTEND_PID=$!
    cd ..
fi

# ── Detectar Sn1per ──
SNIPER_STATUS="NO INSTALADO — modo demo activo"
for path in /usr/share/sniper/sniper /usr/bin/sniper /usr/local/bin/sniper $(which sniper 2>/dev/null); do
    if [ -f "$path" ] && [ -x "$path" ]; then
        SNIPER_STATUS="INSTALADO en $path"
        break
    fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  SniperAI COMMAND CENTER ONLINE${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  Dashboard:  ${YELLOW}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "  API:        http://localhost:${BACKEND_PORT}/api/"
echo -e "  Sn1per:     ${SNIPER_STATUS}"
echo -e "${GREEN}========================================${NC}"
echo ""

if [[ "$SNIPER_STATUS" == *"NO INSTALADO"* ]]; then
    echo -e "${YELLOW}Para instalar Sn1per y salir del modo demo:${NC}"
    echo -e "  ${RED}cd /tmp && git clone https://github.com/1N3/Sn1per && cd Sn1per && sudo bash install.sh${NC}"
    echo ""
fi

echo "Presiona Ctrl+C para detener SniperAI"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo 'SniperAI detenido.'" INT TERM
wait
