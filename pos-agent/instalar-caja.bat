@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo   La Cosmetikera - Instalador Caja
echo ==========================================
echo.

:: Relanzar como administrador si hace falta
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Solicitando permisos de administrador...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Ejecutando setup del agente...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1"
if %errorlevel% neq 0 (
  echo.
  echo ERROR: No se pudo completar la instalacion.
  echo Revisa el mensaje de PowerShell y vuelve a intentar.
  pause
  exit /b 1
)

echo.
echo Verificando health local...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:17891/health' -Method GET -TimeoutSec 5; if ($h.ok -eq $true) { Write-Host 'OK: Agente activo en 127.0.0.1:17891' -ForegroundColor Green } else { Write-Host 'WARN: Health respondio sin ok=true' -ForegroundColor Yellow } } catch { Write-Host 'WARN: No se pudo consultar /health' -ForegroundColor Yellow }"

echo.
echo Listo. Puedes abrir la app web y probar Compras -> Imprimir etiquetas.
echo.
pause
exit /b 0
