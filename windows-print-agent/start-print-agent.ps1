$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = (Get-Command node.exe -ErrorAction Stop).Source
$logDir = Join-Path $root 'logs'; New-Item -ItemType Directory -Force -Path $logDir | Out-Null
if (Get-NetTCPConnection -LocalPort 43127 -State Listen -ErrorAction SilentlyContinue) { exit 0 }
& $node (Join-Path $root 'server.mjs') *>> (Join-Path $logDir 'print-agent.log')
