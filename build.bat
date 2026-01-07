@echo off
echo 🔨 Iniciando build do WhatsApp Forwarder...
echo.

REM Verificar Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado. Por favor instale o Node.js primeiro.
    echo 📥 Download: https://nodejs.org/
    pause
    exit /b 1
)

REM Instalar dependências
echo 📦 Instalando dependências...
call npm install

REM Executar build
echo 🏗️ Executando build...
node build.js

echo.
echo ✅ Processo concluído!
echo 📂 Verifique a pasta dist para o executável.
pause
