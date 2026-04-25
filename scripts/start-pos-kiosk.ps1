[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidAssignmentToAutomaticVariable', '', Scope = 'Script')]
param(
  [string]$Url = "",
  [switch]$AppMode
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Url)) {
  if ($env:NEXT_PUBLIC_APP_URL) {
    $Url = $env:NEXT_PUBLIC_APP_URL
  } else {
    $Url = "http://localhost:3001/ventas"
  }
}

$chromeCandidates = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)

$browser = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) {
  throw "No se encontró Chrome/Edge instalado en rutas estándar."
}

if ($AppMode) {
  Start-Process -FilePath $browser -ArgumentList @("--kiosk-printing", "--new-window", "--app=$Url")
} else {
  Start-Process -FilePath $browser -ArgumentList @("--kiosk-printing", "--new-window", $Url)
}

Write-Output "POS iniciado en modo impresión silenciosa. URL: $Url"
Write-Output "Importante: establece la impresora térmica como predeterminada en Windows."
Write-Output "Si necesitas abrir cajón sin QZ, configúralo en el driver de la impresora (cash drawer pulse on print)."
