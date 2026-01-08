@echo off
title WhatsApp Forwarder Bot
echo ========================================
echo   WhatsApp Forwarder Bot - Baileys
echo ========================================
echo.
echo Iniciando bot...
echo.

REM Verificar se Node.js está instalado
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js não encontrado!
    echo Por favor, instale o Node.js em: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js encontrado
echo 📱 Iniciando bot Baileys...
echo.

REM Iniciar o bot
node src/index_baileys.js

echo.
echo Bot encerrado. Pressione qualquer tecla para fechar...
pause > nul
