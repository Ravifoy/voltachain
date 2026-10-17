# Stops the VoltaChain blockchain node, ML API and frontend.
foreach ($port in 8545, 8000, 3000) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Write-Host "VoltaChain stopped."
