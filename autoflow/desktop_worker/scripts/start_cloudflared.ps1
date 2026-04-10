#Requires -RunAsAdministrator
# ─────────────────────────────────────────────────────────────────────────────
# Install + start the Cloudflare Tunnel as a Windows service
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$cloudflared = "C:\Program Files\cloudflared\cloudflared.exe"
$configPath  = "$env:USERPROFILE\.cloudflared\config.yml"

if (-not (Test-Path $cloudflared)) {
    Write-Error "cloudflared.exe not found at $cloudflared. Download from https://github.com/cloudflare/cloudflared/releases"
    exit 1
}

if (-not (Test-Path $configPath)) {
    Write-Error "Tunnel config not found at $configPath. Copy desktop_worker/cloudflare/config.yml there and edit the UUID."
    exit 1
}

Write-Host "[INFO] Validating tunnel config..."
& $cloudflared tunnel --config $configPath validate

Write-Host "[INFO] Installing cloudflared as a Windows service..."
& $cloudflared service install

Write-Host "[INFO] Starting cloudflared service..."
Start-Service cloudflared

Write-Host "[OK] cloudflared running. Check status with: Get-Service cloudflared"
Write-Host "[OK] Public hostname should now tunnel to http://127.0.0.1:8500"
