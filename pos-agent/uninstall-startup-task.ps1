param(
  [string]$TaskName = "LaCosmetikeraPOSAgent"
)

$ErrorActionPreference = "Stop"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Tarea eliminada: $TaskName"
} else {
  Write-Output "No existe la tarea: $TaskName"
}
