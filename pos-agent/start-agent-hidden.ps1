param(
  [string]$NodePath = ""
)

$ErrorActionPreference = "Stop"
$agentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-NodePath {
  param([string]$InputNodePath)

  if (-not [string]::IsNullOrWhiteSpace($InputNodePath) -and (Test-Path $InputNodePath)) {
    return $InputNodePath
  }

  $nodeCandidates = @(
    "C:\Program Files\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
    "$env:APPDATA\nvm\nodejs\node.exe"
  )

  foreach ($candidate in $nodeCandidates) {
    if (Test-Path $candidate) { return $candidate }
  }

  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCmd) { return $nodeCmd.Source }

  return $null
}

$resolvedNode = Resolve-NodePath -InputNodePath $NodePath
if (-not $resolvedNode) {
  throw "No se encontró node.exe para iniciar el agente"
}

$startInfo = New-Object System.Diagnostics.ProcessStartInfo
$startInfo.FileName = $resolvedNode
$startInfo.Arguments = "`"$agentDir\server.js`""
$startInfo.WorkingDirectory = $agentDir
$startInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
$startInfo.CreateNoWindow = $true
$startInfo.UseShellExecute = $false
[System.Diagnostics.Process]::Start($startInfo) | Out-Null
