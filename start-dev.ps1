# go-wind-admin local startup script
# ------------------------------------------------------------
# Usage:  in PowerShell run  .\start-dev.ps1
# Prereq: Docker Desktop started (whale icon idle in tray)
# Note:   normal user rights ok; opens 2 new windows for backend/frontend
# Enc:    ASCII only (PS 5.1 reads no-BOM files as GBK -> mojibake)
# ------------------------------------------------------------

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $repo 'backend'
$frontend = Join-Path $repo 'frontend\admin\react'

function Log($m, $c='Cyan') { Write-Host "==> $m" -ForegroundColor $c }

# 1. ensure middleware containers (PostgreSQL:15432 / Redis:6379 / MinIO:9000)
Log 'checking middleware containers...'
$up = docker ps --filter 'name=backend-postgres-1' --filter 'name=backend-redis-1' --filter 'name=backend-minio-1' --format '{{.Names}}' 2>$null
if (($up | Measure-Object).Count -lt 3) {
    Log 'not all running, starting...' 'Yellow'
    Push-Location $backend
    docker compose -f docker-compose.libs.yaml up -d
    Pop-Location
} else {
    Log 'middleware already running' 'Green'
}

# 2. backend in new window (REST :7788 / SSE :7789)
Log 'starting backend (new window)...'
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$backend'; go run ./app/admin/service/cmd/server -c ./app/admin/service/configs"

# 3. frontend in new window (Vite :5888, direct vite to bypass pnpm symlink pre-check)
Log 'starting frontend (new window)...'
Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$frontend'; node node_modules/vite/bin/vite.js --mode development"

Write-Host ''
Write-Host 'done!' -ForegroundColor Green
Write-Host '  frontend: http://localhost:5888   (admin / admin, type captcha on login)'
Write-Host '  swagger:  http://localhost:7788/docs/'
Write-Host '  wait for backend window to show: [HTTP] server listening on :7788'
