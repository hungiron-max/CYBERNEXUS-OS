@echo off
title CyberNexus OS - Slave Store Node (Port 8501)
cd /d "%~dp0"
echo ===================================================
echo   CYBERNEXUS OS - SLAVE STORE NODE (EDGE POS)
echo ===================================================
echo [INFO] Cleaning up previous Slave processes & sessions...
taskkill /F /IM cybernexus_slave.exe >nul 2>&1
echo [INFO] Starting CyberNexus Slave Edge Node Server...
cybernexus_slave.exe
pause
