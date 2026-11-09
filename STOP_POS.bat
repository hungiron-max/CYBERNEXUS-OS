@echo off
title STOP POS SERVER
cls

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
cd /d "%APP_DIR%"

echo ============================================================
echo           DANG DUNG MAY CHU POS BAN HANG
echo ============================================================
echo.

set "FOUND="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
    set "FOUND=1"
)

if defined FOUND (
    echo [*] Da dung thanh cong may chu POS tren cong 8080.
) else (
    echo [*] Khong co may chu POS nao dang chay tren cong 8080.
)

echo.
echo Hoan tat. Cua so nay se tu dong sau 2 giay...
ping 127.0.0.1 -n 3 >nul
exit
