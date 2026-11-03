# Puts ArenaHub online through a free Cloudflare quick tunnel (no account needed).
# Builds, starts the production server, then prints a public https://….trycloudflare.com link.
# The site is online only while this window stays open. Ctrl+C stops both.
param([int]$Port = 3001)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) { $cloudflared = Join-Path $env:LOCALAPPDATA "cloudflared\cloudflared.exe" }
if (-not (Test-Path $cloudflared)) {
  Write-Host "Downloading cloudflared to $cloudflared"
  New-Item -ItemType Directory -Force (Split-Path $cloudflared) | Out-Null
  Invoke-WebRequest -UseBasicParsing -OutFile $cloudflared `
    -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
}

npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

$server = Start-Process -PassThru -NoNewWindow npx -ArgumentList "next", "start", "-p", "$Port"
try {
  Write-Host "`nLook for the https://….trycloudflare.com link below. Share that link.`n"
  & $cloudflared tunnel --no-autoupdate --url "http://localhost:$Port"
} finally {
  Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue }
}
