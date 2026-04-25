param(
  [string]$NodePath = "",
  [string]$ServiceName = "LaCosmetikeraPOSAgent"
)

$ErrorActionPreference = "Stop"
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
  throw "Este script debe ejecutarse como administrador para instalar el servicio."
}

if ([string]::IsNullOrWhiteSpace($NodePath)) {
  $nodeCandidates = @(
    "C:\Program Files\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
    "$env:APPDATA\nvm\nodejs\node.exe"
  )
  $NodePath = $nodeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
}

if ([string]::IsNullOrWhiteSpace($NodePath) -or -not (Test-Path $NodePath)) {
  throw "No se encontró node.exe. Instala Node.js en este equipo."
}

$serverPath = Join-Path $agentDir "server.js"
$binPath = '"{0}" "{1}"' -f $NodePath, $serverPath

try {
  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    if ($existing.Status -ne 'Stopped') {
      Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    }
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
  }

  sc.exe create $ServiceName binPath= $binPath start= auto DisplayName= "La Cosmetikera POS Agent" | Out-Null
  sc.exe description $ServiceName "Agente local para imprimir tickets ESC/POS y abrir cajon de La Cosmetikera" | Out-Null
  sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
  Start-Service -Name $ServiceName

  Write-Output "Servicio instalado y ejecutándose: $ServiceName"
} catch {
  throw $_
}