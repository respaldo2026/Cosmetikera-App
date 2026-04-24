$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$agentDir = Join-Path $repoRoot "pos-agent"
if (-not (Test-Path $agentDir)) {
  throw "No existe la carpeta pos-agent"
}

$distDir = Join-Path $repoRoot "dist"
New-Item -ItemType Directory -Path $distDir -Force | Out-Null

$zipPath = Join-Path $distDir "la-cosmetikera-pos-agent.zip"
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

Compress-Archive -Path (Join-Path $agentDir "*") -DestinationPath $zipPath -Force
Write-Output "Paquete generado: $zipPath"
