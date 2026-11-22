@echo off
chcp 65001 >nul
echo ============================================================
echo   CYBERNEXUS OS — MO FIREWALL WINDOWS CHO MASTER TCP 8500
echo ============================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [CANH BAO] Vui long nhap chuot phai chon "Run as administrator"!
    pause
    exit /b 1
)

echo [1/2] Dang mo Windows Firewall Inbound TCP Port 8500...
netsh advfirewall firewall delete rule name="CyberNexus Master TCP 8500" >nul 2>&1
netsh advfirewall firewall add rule name="CyberNexus Master TCP 8500" dir=in action=allow protocol=TCP localport=8500 profile=any
if %errorlevel% equ 0 (
    echo [OK] Da mo quy tac Firewall Inbound TCP 8500 thanh cong!
) else (
    echo [LOI] Khong the them quy tac Windows Firewall!
    pause
    exit /b 1
)

echo.
echo [2/2] BUOC CON LAI TREN ROUTER TP-LINK (CAU HINH THU CONG):
echo   - Dang nhap Router (192.168.1.1 / 192.168.0.1 / tplinkwifi.net)
echo   - Address Reservation (DHCP Static IP): gan IP LAN co dinh 10.0.126.159 cho may Master
echo   - Virtual Server / Port Forwarding:
echo       Service Port: 8500
echo       Internal IP : 10.0.126.159
echo       Internal Port: 8500
echo       Protocol    : TCP
echo   - Sau khi luu Router, tu 4G/Wi-Fi ngoai chay:
echo       Test-NetConnection cybernexus.tplinkdns.com -Port 8500
echo.
pause
