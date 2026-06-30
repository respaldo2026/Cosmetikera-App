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

$stagingDir = Join-Path $distDir "_pos-agent-package"
if (Test-Path $stagingDir) {
  Remove-Item $stagingDir -Recurse -Force
}

$packageRoot = Join-Path $stagingDir "la-cosmetikera-pos-agent"
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
Copy-Item -Path (Join-Path $agentDir "*") -Destination $packageRoot -Recurse -Force

Compress-Archive -Path $packageRoot -DestinationPath $zipPath -Force

Remove-Item $stagingDir -Recurse -Force
Write-Output "Paquete generado: $zipPath"
