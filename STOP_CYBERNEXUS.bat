@echo off
title DUNG CYBERNEXUS OS
taskkill /F /IM php.exe >nul 2>&1
taskkill /F /IM cybernexus_host.exe >nul 2>&1
echo Da dung toan bo may chu CyberNexus OS thanh cong!
ping 127.0.0.1 -n 2 >nul
