# ModernizeAI Quick Start (Windows PowerShell)
# Run: .\start.ps1

Write-Host "=== ModernizeAI Platform Quick Start ===" -ForegroundColor Cyan

# Check .env
if (-not (Test-Path "backend\.env")) {
    Write-Host "Creating .env from template..." -ForegroundColor Yellow
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "Edit backend\.env and set BOBSHELL_API_KEY before AI features will work" -ForegroundColor Yellow
}

# Start backend
Write-Host "Starting backend at http://localhost:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location backend; python run.py"

Start-Sleep -Seconds 2

# Start frontend
Write-Host "Starting frontend at http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; npm run dev"

Write-Host ""
Write-Host "✓ Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "✓ API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host "✓ Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Open http://localhost:5173 in your browser to use the platform." -ForegroundColor Cyan
