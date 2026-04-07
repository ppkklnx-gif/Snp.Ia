#!/usr/bin/env bash
# ============================================================
#  SniperAI — Arranque en Kali Linux
# ============================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Activar venv si existe
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Verificar dependencias
python3 -c "import fastapi, aiosqlite" 2>/dev/null || {
    echo "Ejecuta primero: bash install.sh"
    exit 1
}

echo -e "${GREEN}[+] Iniciando SniperAI...${NC}"

# Puerto del frontend (si existe)
FRONTEND_PORT=3001
BACKEND_PORT=8001

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

    # Ajustar backend URL para local
    if [ ! -f ".env" ]; then
        echo "REACT_APP_BACKEND_URL=http://localhost:${BACKEND_PORT}" > .env
        echo "WDS_SOCKET_PORT=443" >> .env
        echo "PORT=3001" >> .env
    else
        # Asegurar PORT=3001 aunque el .env ya exista
        grep -q "^PORT=" .env && sed -i 's/^PORT=.*/PORT=3001/' .env || echo "PORT=3001" >> .env
    fi

    if command -v yarn &> /dev/null; then
        yarn start &
    else
        npm start &
    fi
    FRONTEND_PID=$!
    cd ..
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  SniperAI COMMAND CENTER ONLINE${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  Dashboard:  http://localhost:${FRONTEND_PORT}"
echo -e "  API:        http://localhost:${BACKEND_PORT}/api/"
echo -e "  Sniper:     $(which sniper 2>/dev/null && echo 'INSTALADO' || echo 'NO INSTALADO — modo demo activo')"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Ctrl+C para detener"

# Esperar señal de parada
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'SniperAI detenido.'" INT TERM
wait
