[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$repoPath = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Directorio: $repoPath"

# Cambiar a directorio del repo
Push-Location $repoPath

try {
    # Verificar estado actual
    Write-Host "Estado actual de git:"
    & git status --short
    
    # Agregar cambios
    Write-Host "`nAgregando cambios..."
    & git add src/app/conversaciones/page.tsx
    
    # Hacer commit
    Write-Host "`nHaciendo commit..."
    & git commit -m "fix: reemplazar BotOutlined con RobotOutlined - icono correcto de Ant Design"
    
    # Push a main
    Write-Host "`nHaciendo push a main..."
    & git push origin main
    
    Write-Host "`nCompletar exitosamente!"
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
finally {
    Pop-Location
}
