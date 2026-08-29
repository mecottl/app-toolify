@echo off
title Toolify
cd /d "%~dp0"
echo  Iniciando Toolify...
echo  Abre http://localhost:4747 en tu navegador.
echo.
start "" http://localhost:4747
npm start
pause
