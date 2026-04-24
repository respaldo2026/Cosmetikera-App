param(
  [string]$NodePath = "",
  [string]$TaskName = "LaCosmetikeraPOSAgent"
)

$ErrorActionPreference = "Stop"
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ([string]::IsNullOrWhiteSpace($NodePath)) {
  $nodeCandidates = @(
    "C:\Program Files\nodejs\node.exe",
    "$env:APPDATA\nvm\nodejs\node.exe"
  )
  $NodePath = $nodeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($NodePath) -or -not (Test-Path $NodePath)) {
  throw "No se encontró node.exe. Instala Node.js en este equipo."
}

$action = New-ScheduledTaskAction -Execute $NodePath -Argument "`"$agentDir\server.js`"" -WorkingDirectory $agentDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Output "Tarea instalada y ejecutándose: $TaskName"
