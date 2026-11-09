@echo off
chcp 65001 >nul
title MỞ TƯỜNG LỬA CHO MẠNG LAN - PORT 8080

:: Tự động yêu cầu quyền Run as Administrator
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Đang yêu cầu quyền Administrator...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

echo ============================================================
echo   ĐANG MỞ CỔNG 8080 TRÊN TƯỜNG LỬA WINDOWS DEFENDER
echo   (Giúp điện thoại / iPad trong mạng LAN truy cập POS)
echo ============================================================
echo.

netsh advfirewall firewall delete rule name="POS_SALE_APP_8080" >nul 2>&1
netsh advfirewall firewall add rule name="POS_SALE_APP_8080" dir=in action=allow protocol=TCP localport=8080 profile=any

echo.
echo [THÀNH CÔNG] Đã cho phép cổng 8080 qua tường lửa Windows!
echo Bây giờ điện thoại trong cùng mạng Wi-Fi có thể truy cập mượt mà.
echo.
pause

