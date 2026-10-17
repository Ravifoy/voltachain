# One-command start for VoltaChain (Windows PowerShell).
# Starts: local blockchain (8545), ML API (8000), deploys + seeds contract, frontend (3000).
# Usage:  powershell -ExecutionPolicy Bypass -File .\start.ps1
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$logs = Join-Path $root "logs"
New-Item -ItemType Directory -Force $logs | Out-Null

function Stop-Port($port) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
function Wait-Url($url, $name, $post = $null) {
  for ($i = 0; $i -lt 90; $i++) {
    try {
      if ($post) { Invoke-RestMethod -Uri $url -Method Post -Body $post -ContentType application/json | Out-Null }
      else { Invoke-WebRequest -Uri $url -UseBasicParsing | Out-Null }
      Write-Host "  $name is up"; return
    } catch { Start-Sleep 1 }
  }
  throw "$name did not start - see logs\"
}

Write-Host "Stopping anything already running on ports 8545 / 8000 / 3000..."
8545, 8000, 3000 | ForEach-Object { Stop-Port $_ }
Remove-Item (Join-Path $root "ml\data\reports.json") -ErrorAction SilentlyContinue  # fresh chain = fresh reports

# First-run setup
if (-not (Test-Path "$root\contracts\node_modules")) { Write-Host "Installing contract deps..."; Push-Location "$root\contracts"; npm install --legacy-peer-deps; Pop-Location }
if (-not (Test-Path "$root\frontend\node_modules")) { Write-Host "Installing frontend deps..."; Push-Location "$root\frontend"; npm install; Pop-Location }
if (-not (Test-Path "$root\ml\model.joblib")) { Write-Host "Installing + training ML model..."; Push-Location "$root\ml"; pip install -q -r requirements.txt; python train.py; Pop-Location }

Write-Host "1/4 Starting local blockchain (Hardhat node)..."
Start-Process cmd -WindowStyle Hidden -ArgumentList "/c", "cd /d `"$root\contracts`" && npx hardhat node > `"$logs\node.log`" 2>&1"
Wait-Url "http://127.0.0.1:8545" "Blockchain node" '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'

Write-Host "2/4 Starting ML API..."
Start-Process cmd -WindowStyle Hidden -ArgumentList "/c", "cd /d `"$root\ml`" && python -m uvicorn app:app --port 8000 > `"$logs\ml.log`" 2>&1"
Wait-Url "http://127.0.0.1:8000/health" "ML API"

Write-Host "3/4 Deploying contract + seeding sample batteries..."
Push-Location "$root\contracts"
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/seed.js --network localhost
Pop-Location

Write-Host "4/4 Starting frontend..."
Start-Process cmd -WindowStyle Hidden -ArgumentList "/c", "cd /d `"$root\frontend`" && npm run dev > `"$logs\frontend.log`" 2>&1"
Wait-Url "http://localhost:3000" "Frontend"

Write-Host ""
Write-Host "VoltaChain is running:  http://localhost:3000" -ForegroundColor Green
Write-Host "Logs are in .\logs   |   Stop everything with:  powershell -ExecutionPolicy Bypass -File .\stop.ps1"
