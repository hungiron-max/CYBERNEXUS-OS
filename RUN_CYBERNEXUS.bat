@echo off
title CYBERNEXUS OS
cd /d "%~dp0"
set "PHP_CMD="
if exist "D:\xampp\php\php.exe" set "PHP_CMD=D:\xampp\php\php.exe"
if not defined PHP_CMD if exist "C:\xampp\php\php.exe" set "PHP_CMD=C:\xampp\php\php.exe"
if not defined PHP_CMD where php >nul 2>&1 && set "PHP_CMD=php"
if not defined PHP_CMD (
    echo [LOI] Khong tim thay PHP tren may tinh!
    pause
    exit /b 1
)
start "CYBERNEXUS_WEB" /min "%PHP_CMD%" -S 0.0.0.0:8080 router.php
ping 127.0.0.1 -n 2 >nul
start "" "http://localhost:8080/index.php"
echo ========================================================
echo   CYBERNEXUS OS DANG CHAY THANH CONG TAI CONG 8080
echo ========================================================
echo   - POS Ban Hang: http://localhost:8080/index.php
echo   - Man Hinh Bep: http://localhost:8080/kitchen.php
echo   - Nhan Vien:    http://localhost:8080/order.php
echo   - Menu Khach:   http://localhost:8080/customer.php
echo   - Quan Tri:     http://localhost:8080/admin.php
echo ========================================================
echo Cua so nay co the thu nho xuong Taskbar.
echo De tat may chu, chay file STOP_CYBERNEXUS.bat
pause
