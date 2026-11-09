@echo off
chcp 65001 >nul
title DỪNG CYBERNEXUS OS
color 0C

echo Đang dừng toàn bộ máy chủ CyberNexus OS...
taskkill /F /IM php.exe >nul 2>&1
taskkill /F /IM cybernexus_host.exe >nul 2>&1

echo Đã dừng tất cả dịch vụ thành công!
timeout /t 2 >nul
