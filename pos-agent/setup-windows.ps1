param(
  [string]$TaskName = "LaCosmetikeraPOSAgent",
  [string]$ServiceName = "LaCosmetikeraPOSAgent"
)

$ErrorActionPreference = "Stop"
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Resolve-NodePath {
  $candidates = @(
    "C:\Program Files\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
    "$env:APPDATA\nvm\nodejs\node.exe"
  )

  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }

  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd) { return $nodeCmd.Source }

  return $null
}

function Resolve-NpmCmd {
  $candidates = @(
    "C:\Program Files\nodejs\npm.cmd",
    "$env:LOCALAPPDATA\Programs\nodejs\npm.cmd",
    "$env:APPDATA\nvm\nodejs\npm.cmd"
  )

  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }

  $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmCmd) { return $npmCmd.Source }

  return $null
}

function Install-NodeLTS {
  Write-Output "[POS-AGENT] Node.js no encontrado. Intentando instalar Node LTS..."

  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    return
  }

  throw "No se encontró winget para instalar Node automáticamente. Instala Node LTS manualmente desde https://nodejs.org y vuelve a ejecutar este script."
}

Set-Location $agentDir

$nodePath = Resolve-NodePath
if (-not $nodePath) {
  Install-NodeLTS
  $nodePath = Resolve-NodePath
}

$npmCmd = Resolve-NpmCmd
if (-not $npmCmd) {
  throw "No se encontró npm.cmd. Reabre PowerShell y ejecuta nuevamente setup-windows.ps1"
}

Write-Output "[POS-AGENT] Node: $nodePath"
Write-Output "[POS-AGENT] NPM : $npmCmd"

& $npmCmd install

function Start-AgentProcess {
  Write-Output "[POS-AGENT] Arrancando agente..."

  Get-Process -Name "node" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*server.js*" } |
    Stop-Process -Force -ErrorAction SilentlyContinue

  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName        = $nodePath
  $startInfo.Arguments       = "`"$agentDir\server.js`""
  $startInfo.WorkingDirectory = $agentDir
  $startInfo.WindowStyle     = [System.Diagnostics.ProcessWindowStyle]::Minimized
  $startInfo.UseShellExecute = $true
  [System.Diagnostics.Process]::Start($startInfo) | Out-Null
}

if (Test-IsAdministrator) {
  Write-Output "[POS-AGENT] Intentando instalar como servicio de Windows..."
  try {
    powershell -ExecutionPolicy Bypass -File (Join-Path $agentDir "install-windows-service.ps1") -NodePath $nodePath -ServiceName $ServiceName
    if ($LASTEXITCODE -ne 0) {
      throw "La instalación como servicio devolvió código $LASTEXITCODE"
    }
  } catch {
    Write-Warning "[POS-AGENT] Falló instalación como servicio. Se usará tarea programada."
    Write-Warning ("[POS-AGENT] Motivo: " + $_.Exception.Message)
    powershell -ExecutionPolicy Bypass -File (Join-Path $agentDir "install-startup-task.ps1") -NodePath $nodePath -TaskName $TaskName
    if ($LASTEXITCODE -ne 0) {
      throw "La instalación de autoarranque devolvió código $LASTEXITCODE"
    }
    Start-AgentProcess
  }
} else {
  Write-Warning "[POS-AGENT] Sin permisos de administrador. Se instalará como tarea programada."
  powershell -ExecutionPolicy Bypass -File (Join-Path $agentDir "install-startup-task.ps1") -NodePath $nodePath -TaskName $TaskName
  if ($LASTEXITCODE -ne 0) {
    throw "La instalación de autoarranque devolvió código $LASTEXITCODE"
  }
  Start-AgentProcess
}

Write-Output "[POS-AGENT] Esperando que el agente arranque..."
Start-Sleep -Seconds 5

$intentos = 0
$ok = $false
while ($intentos -lt 6 -and -not $ok) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:17891/health" -Method GET -TimeoutSec 3
    if ($health.ok -eq $true) { $ok = $true }
  } catch {}
  if (-not $ok) { Start-Sleep -Seconds 2 }
  $intentos++
}

if ($ok) {
  Write-Output ""
  Write-Output "=========================================="
  Write-Output "  LISTO: Agente activo en puerto 17891"
  Write-Output "  Prueba: http://127.0.0.1:17891/health"
  Write-Output "=========================================="
} else {
  Write-Warning ""
  Write-Warning "El agente no respondió al health check."
  Write-Warning "Si usaste modo servicio, revisa el servicio '$ServiceName'."
  Write-Warning "Si usaste modo tarea, intenta abrir start-agent.bat en la carpeta pos-agent"
  Write-Warning "y luego visita http://127.0.0.1:17891/health"
}

exit 0
