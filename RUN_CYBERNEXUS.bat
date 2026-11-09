@echo off
chcp 65001 >nul
title CYBERNEXUS OS — SMART VENUE RUNTIME
color 0B

echo ========================================================
echo    🚀 KHỞI ĐỘNG CYBERNEXUS OS (LIQUID GLASS C++17)
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "build\cybernexus_host.exe" (
    echo [Lỗi] Chưa tìm thấy file build\cybernexus_host.exe!
    echo Đang tự động biên dịch...
    cmake -B build -DCMAKE_BUILD_TYPE=Release
    cmake --build build --config Release
)

echo [1/2] Đang mở trình duyệt vào Quầy POS Bán Hàng...
start "" "http://localhost:8500/index.php"

echo [2/2] Máy chủ CyberNexus Host đang chạy tại http://localhost:8500
echo  - Quầy Thu Ngân POS: http://localhost:8500/index.php
echo  - Màn Hình Bếp KDS: http://localhost:8500/kitchen.php
echo  - Nhân Viên Order:  http://localhost:8500/order.php
echo  - Menu Khách Hàng:  http://localhost:8500/customer.php
echo  - Quản Trị Quán:    http://localhost:8500/admin.php
echo  - SuperAdmin Master:http://localhost:8500/super_admin.php
echo.
echo Nhấn Ctrl+C để dừng máy chủ.
echo ========================================================
echo.

.\build\cybernexus_host.exe --port 8500 --super-admin
pause
