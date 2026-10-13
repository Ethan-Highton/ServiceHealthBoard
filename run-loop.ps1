# Keeps the Service Health Board running: if the server exits (for example Tailscale
# isn't connected yet at login), wait and start it again. Logs to
# %LOCALAPPDATA%\service-health-board\board.log.
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = 'C:\Program Files\nodejs\node.exe'
$logDir = Join-Path $env:LOCALAPPDATA 'service-health-board'
$log = Join-Path $logDir 'board.log'
New-Item -ItemType Directory -Force $logDir | Out-Null
Set-Location $dir
while ($true) {
  if ((Test-Path $log) -and (Get-Item $log).Length -gt 2MB) { Move-Item $log "$log.old" -Force }
  "[$(Get-Date -Format s)] starting server" | Add-Content $log
  & $node server.mjs *>> $log
  "[$(Get-Date -Format s)] exited with code $LASTEXITCODE; restarting in 10s" | Add-Content $log
  Start-Sleep -Seconds 10
}
