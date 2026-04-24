@echo off
title La Cosmetikera - POS Agent
cd /d "%~dp0"

:: Buscar node.exe
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js no encontrado en PATH.
    echo Instala Node.js desde https://nodejs.org (version LTS)
    pause
    exit /b 1
)

:: Instalar dependencias si falta node_modules
if not exist "node_modules" (
    echo Instalando dependencias...
    npm install
)

echo.
echo ==========================================
echo   La Cosmetikera POS Agent
echo   Escuchando en http://127.0.0.1:17891
echo   Cierra esta ventana para detener
echo ==========================================
echo.

node server.js

pause
