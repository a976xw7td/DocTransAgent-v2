#!/bin/bash
# DocTransAgent — Unified Next.js full-stack launch
# Frontend :3001 → rewrites /api/* → FastAPI :8000 (internal)

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╔══════════════════════════════════════════════╗"
echo "║   DocTransAgent — Unified Launch            ║"
echo "║   Next.js Full-Stack + GMI Cloud Engine     ║"
echo "╚══════════════════════════════════════════════╝"

# .env
if [ ! -f "$DIR/backend/.env" ]; then
    cp "$DIR/backend/.env.example" "$DIR/backend/.env"
    echo "⚠  Created backend/.env — edit GMI_API_KEY"
    echo "   (Demo mode works without a real key)"
fi

# Deps
echo "[1/3] Backend deps..."
cd "$DIR/backend" && pip3 install -q -r requirements.txt 2>/dev/null || \
    echo "⚠ pip install skipped — run it manually: pip3 install -r backend/requirements.txt"

echo "[2/3] Frontend deps..."
cd "$DIR/frontend" && npm install --silent 2>/dev/null || \
    echo "⚠ npm install skipped — run it manually: npm install"

# Kill leftover processes on our ports
lsof -ti :8000 | xargs kill 2>/dev/null
lsof -ti :3001 | xargs kill 2>/dev/null
sleep 1

# Start FastAPI (internal, port 8000)
echo "[3/3] Starting services..."
cd "$DIR/backend"
python3 -m uvicorn app:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
sleep 2

# Start Next.js (public, port 3001)
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Backend: http://localhost:8000/docs       ║"
echo "║   Frontend: http://localhost:3001            ║"
echo "║   Press Ctrl+C to stop                      ║"
echo "╚══════════════════════════════════════════════╝"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
