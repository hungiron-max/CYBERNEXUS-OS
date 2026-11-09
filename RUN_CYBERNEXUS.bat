@echo off
title CYBERNEXUS OS (C++ NATIVE PORT 8500)
cd /d "%~dp0"
if not exist "build\cybernexus_host.exe" (
    echo [LOI] Khong tim thay build\cybernexus_host.exe!
    pause
    exit /b 1
)
start "" "http://localhost:8500/index.html"
echo ========================================================
echo   CYBERNEXUS OS C++ NATIVE DANG CHAY TAI PORT 8500
echo   (KHONG DUNG PHP - 100%% C++ NATIVE DOC LAP)
echo ========================================================
echo   - POS Ban Hang:  http://localhost:8500/index.html
echo   - Man Hinh Bep:  http://localhost:8500/kitchen.html
echo   - Nhan Vien:     http://localhost:8500/order.html
echo   - Menu Khach:    http://localhost:8500/customer.html
echo   - Quan Tri Quan: http://localhost:8500/admin.html
echo ========================================================
echo.
build\cybernexus_host.exe --port 8500 --super-admin
