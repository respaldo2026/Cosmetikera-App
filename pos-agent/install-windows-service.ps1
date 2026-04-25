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

    $retry = 0
    while ($retry -lt 10 -and (Get-Service -Name $ServiceName -ErrorAction SilentlyContinue)) {
      Start-Sleep -Seconds 1
      $retry++
    }
  }

  New-Service -Name $ServiceName -BinaryPathName $binPath -DisplayName "La Cosmetikera POS Agent" -Description "Agente local para imprimir tickets ESC/POS y abrir cajon de La Cosmetikera" -StartupType Automatic

  # Configurar reintentos automáticos de recuperación.
  sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "No se pudo configurar la recuperación automática del servicio."
  }

  Start-Service -Name $ServiceName

  $installed = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if (-not $installed) {
    throw "No se pudo crear el servicio '$ServiceName'."
  }

  Write-Output "Servicio instalado y ejecutándose: $ServiceName"
} catch {
  throw $_
}