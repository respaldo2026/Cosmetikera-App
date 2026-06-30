param(
  [string]$NodePath = "",
  [string]$TaskName = "LaCosmetikeraPOSAgent"
)

$ErrorActionPreference = "Stop"
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-StartupScriptPath {
  $startupDir = [Environment]::GetFolderPath("Startup")
  if ([string]::IsNullOrWhiteSpace($startupDir)) {
    throw "No se pudo resolver la carpeta Inicio del usuario."
  }

  return Join-Path $startupDir "LaCosmetikeraPOSAgent.cmd"
}

function Install-StartupFolderLauncher {
  param([string]$ResolvedNodePath)

  $startupScript = Get-StartupScriptPath
  $content = @(
    '@echo off',
    'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $launcher + '" -NodePath "' + $ResolvedNodePath + '"'
  ) -join [Environment]::NewLine

  Set-Content -Path $startupScript -Value $content -Encoding ASCII
  Write-Output "Autoarranque instalado en carpeta Inicio: $startupScript"
}

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

$launcher = Join-Path $agentDir "start-agent-hidden.ps1"
if (-not (Test-Path $launcher)) {
  throw "No se encontró el lanzador oculto: $launcher"
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcher`"" -WorkingDirectory $agentDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 0)

try {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
  Start-ScheduledTask -TaskName $TaskName
  Write-Output "Tarea instalada y ejecutándose: $TaskName"
} catch {
  Write-Warning ("No se pudo crear la tarea programada: " + $_.Exception.Message)
  Install-StartupFolderLauncher -ResolvedNodePath $NodePath
}
