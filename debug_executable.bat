@echo off
echo Iniciando WhatsApp Forwarder em modo debug...
echo.
echo Se o executavel fechar, os erros aparecerao aqui.
echo.
cd dist
whatsapp-forwarder.exe
echo.
echo Executavel encerrado. Pressione qualquer tecla para fechar...
pause > nul
