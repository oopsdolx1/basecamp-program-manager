$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeRoot = 'C:\ProgramData\BaseCamp\PrintAgent'
$runtimeFiles = @('server.mjs', 'windows-printer-backend.mjs', 'html-pdf-renderer.mjs', 'launch-print-agent.mjs', 'start-print-agent.ps1')
New-Item -ItemType Directory -Force -Path $runtimeRoot, (Join-Path $runtimeRoot 'logs') | Out-Null
foreach ($file in $runtimeFiles) { Copy-Item -LiteralPath (Join-Path $sourceRoot $file) -Destination (Join-Path $runtimeRoot $file) -Force }
$sourceBin = Join-Path $sourceRoot 'bin'
if (Test-Path -LiteralPath $sourceBin) { Copy-Item -LiteralPath $sourceBin -Destination (Join-Path $runtimeRoot 'bin') -Recurse -Force }
$currentUser = "$env:USERDOMAIN\$env:USERNAME"
# Keep the inherited SYSTEM/Administrators ACLs and grant only the interactive
# operator write access needed for logs and idempotent reinstalls.
& icacls $runtimeRoot /grant:r "$currentUser`:(OI)(CI)M" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to set runtime ACL for $currentUser" }
$node = 'C:\Program Files\nodejs\node.exe'
if (-not (Test-Path -LiteralPath $node)) { throw "Node executable not found: $node" }
$launcher = Join-Path $runtimeRoot 'launch-print-agent.mjs'
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute $node -Argument "`\"$launcher`\""
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 0) -MultipleInstances IgnoreNew -StartWhenAvailable
$settings.DisallowStartIfOnBatteries = $false
$settings.StopIfGoingOnBatteries = $false
Register-ScheduledTask -TaskName 'BaseCamp Print Agent' -Action $action -Trigger $trigger -Settings $settings -User "$env:USERDOMAIN\$env:USERNAME" -RunLevel Limited -Force | Out-Null
Start-ScheduledTask -TaskName 'BaseCamp Print Agent'
