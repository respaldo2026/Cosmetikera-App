param(
  [string]$TaskName = "LaCosmetikeraPOSAgent"
)

$ErrorActionPreference = "Stop"
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

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

powershell -ExecutionPolicy Bypass -File (Join-Path $agentDir "install-startup-task.ps1") -NodePath $nodePath -TaskName $TaskName

Start-Sleep -Seconds 2

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:17891/health" -Method GET -TimeoutSec 5
  if ($health.ok -eq $true) {
    Write-Output "[POS-AGENT] Listo: servicio activo en http://127.0.0.1:17891"
    exit 0
  }
} catch {
  Write-Warning "[POS-AGENT] Instalado, pero health check no respondió aún. Revisa la tarea programada '$TaskName'."
}

exit 0
