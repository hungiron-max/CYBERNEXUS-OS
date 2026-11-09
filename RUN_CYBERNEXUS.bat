@echo off
chcp 65001 >nul
title CYBERNEXUS OS — SMART VENUE RUNTIME
color 0B

echo ========================================================
echo    🚀 KHỞI ĐỘNG CYBERNEXUS OS (LIQUID GLASS PRO)
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Tìm trình thông dịch PHP
set "PHP_CMD="
where php >nul 2>&1
if %errorlevel% equ 0 set "PHP_CMD=php"
if not defined PHP_CMD if exist "C:\xampp\php\php.exe" set "PHP_CMD=C:\xampp\php\php.exe"
if not defined PHP_CMD if exist "D:\xampp\php\php.exe" set "PHP_CMD=D:\xampp\php\php.exe"

if not defined PHP_CMD (
    echo [LỖI] Không tìm thấy PHP trên máy tính!
    echo Vui lòng cài đặt PHP hoặc XAMPP.
    pause
    exit /b 1
)

:: 2. Khởi động máy chủ POS Web trên cổng 8080
powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue; if (!$conn) { exit 1 } else { exit 0 }"
if %errorlevel% neq 0 (
    echo [1/3] Đang khởi chạy máy chủ POS Web Liquid Glass (Port 8080)...
    start "CYBERNEXUS_WEB" /min "%PHP_CMD%" -S 0.0.0.0:8080 router.php
    powershell -NoProfile -Command "Start-Sleep -Milliseconds 800"
) else (
    echo [1/3] Máy chủ POS Web (Port 8080) đã sẵn sàng.
)

:: 3. Khởi động Host Core C++ (Port 8500) nếu có file nhị phân
if exist "build\cybernexus_host.exe" (
    powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 8500 -ErrorAction SilentlyContinue; if (!$conn) { exit 1 } else { exit 0 }"
    if %errorlevel% neq 0 (
        echo [2/3] Đang khởi chạy Lõi Điều Phối C++ Microkernel (Port 8500)...
        start "CYBERNEXUS_CORE" /min "build\cybernexus_host.exe" --port 8500 --super-admin
    )
)

:: 4. Mở trình duyệt vào đúng quầy bán hàng POS
echo [3/3] Đang mở trình duyệt giao diện Liquid Glass...
start "" "http://localhost:8080/index.php"

echo.
echo ========================================================
echo   ✅ HỆ THỐNG CYBERNEXUS OS ĐÃ HOẠT ĐỘNG HOÀN HẢO:
echo     • Quầy Bán Hàng POS: http://localhost:8080/index.php
echo     • Màn Hình Bếp KDS:  http://localhost:8080/kitchen.php
echo     • Nhân Viên Order:   http://localhost:8080/order.php
echo     • Menu Khách Hàng:   http://localhost:8080/customer.php
echo     • Quản Trị Quán:     http://localhost:8080/admin.php
echo ========================================================
echo.
echo Nhấp đúp vào STOP_CYBERNEXUS.bat khi muốn tắt máy chủ.
pause
