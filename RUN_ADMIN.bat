@echo off
chcp 65001 >nul
title POS GOC PHO - QUAN TRI BACK-OFFICE
cls

cd /d "%~dp0"

set "PHP_CMD="
where php >nul 2>&1
if %errorlevel% equ 0 set "PHP_CMD=php"
if not defined PHP_CMD if exist "D:\xampp\php\php.exe" set "PHP_CMD=D:\xampp\php\php.exe"
if not defined PHP_CMD if exist "C:\xampp\php\php.exe" set "PHP_CMD=C:\xampp\php\php.exe"

if not defined PHP_CMD (
    echo [LỖI] Không tìm thấy PHP!
    pause
    exit /b 1
)

:: Kiểm tra xem server 8080 đã chạy chưa, nếu chưa thì bật trên 0.0.0.0:8080
powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue; if (!$conn) { exit 1 } else { exit 0 }"
if %errorlevel% neq 0 (
    start "POS_SERVER" /min "%PHP_CMD%" -S 0.0.0.0:8080 router.php
    powershell -NoProfile -Command "Start-Sleep -Milliseconds 800"
)

start http://localhost:8080/admin.php
