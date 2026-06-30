param(
  [string]$TaskName = "LaCosmetikeraPOSAgent"
)

$ErrorActionPreference = "Stop"
$startupDir = [Environment]::GetFolderPath("Startup")
$startupScript = if ([string]::IsNullOrWhiteSpace($startupDir)) { $null } else { Join-Path $startupDir "LaCosmetikeraPOSAgent.cmd" }

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Tarea eliminada: $TaskName"
} else {
  Write-Output "No existe la tarea: $TaskName"
}

if ($startupScript -and (Test-Path $startupScript)) {
  Remove-Item $startupScript -Force
  Write-Output "Autoarranque eliminado de carpeta Inicio: $startupScript"
}
