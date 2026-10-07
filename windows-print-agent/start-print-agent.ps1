$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node)) { throw "Node executable not found: $node" }
$logDir = Join-Path $root 'logs'; New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logPath = Join-Path $logDir 'print-agent.log'
$listener = Get-NetTCPConnection -LocalPort 43127 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  "$(Get-Date -Format o) port 43127 already listening (PID $($listener.OwningProcess)); launcher will not start a duplicate." | Add-Content -LiteralPath $logPath
  exit 0
}
"$(Get-Date -Format o) starting BaseCamp Print Agent with $node" | Add-Content -LiteralPath $logPath
Push-Location $root
try { & $node (Join-Path $root 'server.mjs') *>> $logPath }
finally { Pop-Location }
