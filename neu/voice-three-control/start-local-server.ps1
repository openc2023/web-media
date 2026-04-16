Set-Location $PSScriptRoot
Write-Host "Starting local server at http://127.0.0.1:4173"
Start-Process "http://127.0.0.1:4173"
python -m http.server 4173
