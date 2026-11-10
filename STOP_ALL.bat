@echo off
title DUNG HE THONG CYBERNEXUS OS
echo ============================================================
echo   DANG DUNG CAC MAY CHU CYBERNEXUS OS (MASTER & SLAVE)...
echo ============================================================
taskkill /F /IM cybernexus_master.exe >nul 2>&1
taskkill /F /IM cybernexus_slave.exe >nul 2>&1
echo [OK] Da dung tat ca cac tien trinh CyberNexus thanh cong!
ping 127.0.0.1 -n 2 >nul
