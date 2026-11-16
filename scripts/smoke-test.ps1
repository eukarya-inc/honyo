# Launches the packaged Windows app in smoke-test mode (HONYO_SMOKE_TEST, see
# src/main.ts) and fails unless it finishes startup within the timeout.
#
#   pwsh scripts/smoke-test.ps1 [-Exe dist/win-unpacked/Honyo.exe] [-TimeoutSec 60]
param(
  [string]$Exe = 'dist/win-unpacked/Honyo.exe',
  [int]$TimeoutSec = 60
)

$ErrorActionPreference = 'Stop'

$work = Join-Path ([System.IO.Path]::GetTempPath()) "honyo-smoke-$PID"
New-Item -ItemType Directory -Force -Path $work | Out-Null
$marker = Join-Path $work 'smoke-ok'
$stdout = Join-Path $work 'stdout.log'
$stderr = Join-Path $work 'stderr.log'

# A fresh userData dir so the run starts from default settings
$env:HONYO_USER_DATA_DIR = Join-Path $work 'userdata'
$env:HONYO_SMOKE_TEST = $marker
$env:ELECTRON_ENABLE_LOGGING = '1'

$proc = Start-Process -FilePath (Resolve-Path $Exe) -PassThru `
  -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Write-Host "Started $Exe (PID $($proc.Id))"

$exited = $proc.WaitForExit($TimeoutSec * 1000)
if (-not $exited) {
  # A startup error in the main process shows a modal dialog and hangs here
  Write-Host "Timed out after ${TimeoutSec}s; stopping PID $($proc.Id)"
  Stop-Process -Id $proc.Id -Force
}

Write-Host '--- stdout ---'
if (Test-Path $stdout) { Get-Content $stdout }
Write-Host '--- stderr ---'
if (Test-Path $stderr) { Get-Content $stderr }

if (-not (Test-Path $marker)) {
  Write-Error 'Smoke test failed: the app did not finish startup'
  exit 1
}
Write-Host 'Smoke test passed'
