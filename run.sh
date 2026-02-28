#!/bin/bash

# ══════════════════════════════════════════════════════
#  AIWrapper — Start All Services
# ══════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${CYAN}══════════════════════════════════════${NC}"
echo -e "${CYAN}   AIWrapper — Starting Services${NC}"
echo -e "${CYAN}══════════════════════════════════════${NC}"

# ── Kill old processes on required ports ──
echo -e "\n${YELLOW}⏹  Stopping old processes...${NC}"
for PORT in 8000 3000 3001; do
    PID=$(lsof -ti :$PORT 2>/dev/null)
    if [ -n "$PID" ]; then
        kill -9 $PID 2>/dev/null
        echo -e "   Killed process on port $PORT"
    fi
done
sleep 1

# ── Ensure log directory ──
mkdir -p "$ROOT_DIR/logs"

# ── 1. Backend (FastAPI) ──
echo -e "\n${GREEN}🚀 Starting Backend (port 8000)...${NC}"
cd "$ROOT_DIR/backend"
if [ ! -d "venv" ]; then
    echo -e "${RED}   ✗ No venv found. Run: python3 -m venv venv && pip install -r requirements.txt${NC}"
    exit 1
fi
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > "$ROOT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo -e "   ✓ Backend started (PID: $BACKEND_PID)"

# ── 2. Frontend (Next.js) ──
echo -e "\n${GREEN}🚀 Starting Frontend (port 3000)...${NC}"
cd "$ROOT_DIR/frontend"
# Load nvm and switch to Node 20
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20 > /dev/null 2>&1
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}   Installing dependencies...${NC}"
    npm install
fi
npm run dev > "$ROOT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo -e "   ✓ Frontend started (PID: $FRONTEND_PID)"

# ── 3. WhatsApp Bridge (optional) ──
echo -e "\n${GREEN}🚀 Starting WhatsApp Bridge (port 3001)...${NC}"
cd "$ROOT_DIR/backend/whatsapp-bridge"
if [ -d "node_modules" ]; then
    node index.js > "$ROOT_DIR/logs/wa-bridge.log" 2>&1 &
    WA_PID=$!
    echo -e "   ✓ WhatsApp Bridge started (PID: $WA_PID)"
else
    echo -e "${YELLOW}   ⚠ Skipped (run: cd backend/whatsapp-bridge && npm install)${NC}"
    WA_PID=""
fi

# ── Wait for services ──
sleep 3

# ── Status Check ──
echo -e "\n${CYAN}══════════════════════════════════════${NC}"
echo -e "${CYAN}   Service Status${NC}"
echo -e "${CYAN}══════════════════════════════════════${NC}"

check_port() {
    if lsof -ti :$1 > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ $2 → http://localhost:$1${NC}"
    else
        echo -e "   ${RED}✗ $2 failed to start. Check logs/$(echo $2 | tr '[:upper:]' '[:lower:]' | tr ' ' '-').log${NC}"
    fi
}

check_port 8000 "Backend"
check_port 3000 "Frontend"
check_port 3001 "WA Bridge"

echo -e "\n${CYAN}📁 Logs:${NC}  $ROOT_DIR/logs/"
echo -e "${CYAN}🌐 App:${NC}   http://localhost:3000"
echo -e "${CYAN}📡 API:${NC}   http://localhost:8000/docs"
echo -e "\n${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# ── Trap Ctrl+C to kill all services ──
cleanup() {
    echo -e "\n${RED}⏹  Stopping all services...${NC}"
    [ -n "$BACKEND_PID" ] && kill $BACKEND_PID 2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null
    [ -n "$WA_PID" ] && kill $WA_PID 2>/dev/null
    # Kill any remaining processes on our ports
    for PORT in 8000 3000 3001; do
        lsof -ti :$PORT 2>/dev/null | xargs kill -9 2>/dev/null
    done
    echo -e "${GREEN}✓ All services stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ── Keep script alive and tail logs ──
tail -f "$ROOT_DIR/logs/backend.log" "$ROOT_DIR/logs/frontend.log" 2>/dev/null
