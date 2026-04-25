param(
  [string]$ServiceName = "LaCosmetikeraPOSAgent"
)

$ErrorActionPreference = "Stop"

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
  throw "Este script debe ejecutarse como administrador para desinstalar el servicio."
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $existing) {
  Write-Output "No existe el servicio: $ServiceName"
  exit 0
}

if ($existing.Status -ne 'Stopped') {
  Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
}

sc.exe delete $ServiceName | Out-Null
Write-Output "Servicio eliminado: $ServiceName"