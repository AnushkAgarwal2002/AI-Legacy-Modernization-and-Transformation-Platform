#!/bin/bash
# Quick start script for ModernizeAI Platform

echo "=== ModernizeAI Platform Quick Start ==="

# Check environment
if [ ! -f "backend/.env" ]; then
    echo "⚠  Creating .env from template..."
    cp backend/.env.example backend/.env
    echo "   Edit backend/.env and set BOB_API_KEY, BOB_INFERENCE_URL, BOB_MODEL before AI features will work!"
fi

# Start backend
echo "Starting backend..."
cd backend
python run.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend
sleep 2

# Start frontend dev server
echo "Starting frontend..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✓ Backend:  http://localhost:8000"
echo "✓ API Docs: http://localhost:8000/docs"
echo "✓ Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

wait
