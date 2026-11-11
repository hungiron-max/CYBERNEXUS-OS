@echo off
chcp 65001 >nul
title MỞ TƯỜNG LỬA CHO MẠNG LAN - PORT 8500 & 8501

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
echo   ĐANG MỞ CỔNG 8500 & 8501 TRÊN TƯỜNG LỬA WINDOWS DEFENDER
echo   - Cổng 8500: CyberNexus Master Platform
echo   - Cổng 8501: CyberNexus Slave POS Edge Node
echo ============================================================
echo.

netsh advfirewall firewall delete rule name="CYBERNEXUS_MASTER_8500" >nul 2>&1
netsh advfirewall firewall add rule name="CYBERNEXUS_MASTER_8500" dir=in action=allow protocol=TCP localport=8500 profile=any

netsh advfirewall firewall delete rule name="CYBERNEXUS_SLAVE_8501" >nul 2>&1
netsh advfirewall firewall add rule name="CYBERNEXUS_SLAVE_8501" dir=in action=allow protocol=TCP localport=8501 profile=any

netsh advfirewall firewall delete rule name="CYBERNEXUS_MEDIA_8080" >nul 2>&1
netsh advfirewall firewall add rule name="CYBERNEXUS_MEDIA_8080" dir=in action=allow protocol=TCP localport=8080 profile=any

netsh advfirewall firewall delete rule name="CYBERNEXUS_STREAM_8082" >nul 2>&1
netsh advfirewall firewall add rule name="CYBERNEXUS_STREAM_8082" dir=in action=allow protocol=TCP localport=8082 profile=any

echo.
echo [THÀNH CÔNG] Đã cho phép cổng 8500 và 8501 qua tường lửa Windows!
echo Bây giờ điện thoại / iPad / máy trạm trong mạng LAN/WAN có thể kết nối mượt mà.
echo.
pause
