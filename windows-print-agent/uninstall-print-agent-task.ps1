param([switch]$RemoveRuntime)

$ErrorActionPreference = 'Stop'
$runtimeRoot = 'C:\ProgramData\BaseCamp\PrintAgent'
Stop-ScheduledTask -TaskName 'BaseCamp Print Agent' -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName 'BaseCamp Print Agent' -Confirm:$false -ErrorAction SilentlyContinue
if ($RemoveRuntime -and (Test-Path -LiteralPath $runtimeRoot)) { Remove-Item -LiteralPath $runtimeRoot -Recurse -Force }
