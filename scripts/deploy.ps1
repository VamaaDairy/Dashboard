# Production deploy for the NSSM service "DashboardApp".
# Pulls main, installs, builds, restarts the service and checks /api/health.
# If the check fails it puts the previous build back. Safe to run by hand: .\scripts\deploy.ps1
param(
  [string]$AppDir = (Split-Path -Parent $PSScriptRoot),
  [string]$Service = "DashboardApp",
  [string]$HealthUrl = "http://localhost:3001/api/health",
  [string]$Branch = "main"
)

# Continue, not Stop: Windows PowerShell 5.1 turns any native-command stderr (git's "From ..." line,
# npm warnings) into a terminating error under Stop. Real failures are caught by the explicit checks below.
$ErrorActionPreference = "Continue"
Set-Location $AppDir

function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }

# Never deploy over uncommitted work or a different branch.
$dirty = git status --porcelain --untracked-files=no
if ($dirty) { throw "Working tree has uncommitted changes; commit or stash them first:`n$dirty" }
if ((git branch --show-current) -ne $Branch) { throw "Not on '$Branch'. Check it out before deploying." }

Step "Pull $Branch"
git pull --ff-only origin $Branch
if ($LASTEXITCODE -ne 0) { throw "git pull failed" }

Step "Install dependencies"
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

Step "Back up current build"
if (Test-Path .next.bak) { Remove-Item .next.bak -Recurse -Force }
if (Test-Path .next) { robocopy .next .next.bak /MIR /NFL /NDL /NJH /NJS /NP | Out-Null }

Step "Build"
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed - restoring previous build" -ForegroundColor Red
  if (Test-Path .next.bak) { robocopy .next.bak .next /MIR /NFL /NDL /NJH /NJS /NP | Out-Null }
  throw "build failed; the running app was not restarted"
}

Step "Restart $Service"
Restart-Service $Service -Force -ErrorAction Stop

Step "Health check"
$ok = $false
for ($i = 1; $i -le 15; $i++) {
  Start-Sleep -Seconds 3
  try {
    $r = Invoke-WebRequest $HealthUrl -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
}

if (-not $ok) {
  Write-Host "Health check failed - rolling back" -ForegroundColor Red
  robocopy .next.bak .next /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  Restart-Service $Service -Force -ErrorAction Stop
  throw "deploy failed health check; previous build restored. See logs\app.err.log"
}

Write-Host "`nDeployed $(git rev-parse --short HEAD) and healthy." -ForegroundColor Green
