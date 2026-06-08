@echo off
title Gabor Noise Synthesizer

echo.
echo  ========================================
echo    Gabor Noise Synthesizer — Install
echo  ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo  Descargalo desde: https://nodejs.org/
    pause
    exit /b 1
)

echo  [OK] Node.js encontrado
node -v

:: Install dependencies
echo.
echo  Instalando dependencias...
echo.
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Fallo la instalacion de dependencias.
    pause
    exit /b 1
)

echo.
echo  [OK] Dependencias instaladas correctamente
echo.
echo  Servidor iniciando...
echo.
echo    Panel de control : http://localhost:3000
echo    Visual output   : http://localhost:3000/visual.html
echo.

:: Start the server in background, wait, then open browser
start /B "" node server.js >nul 2>&1
timeout /t 2 /nobreak >nul
start http://localhost:3000

:: Keep window open
pause >nul
