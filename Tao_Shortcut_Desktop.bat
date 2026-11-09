@echo off
chcp 65001 >nul
title Tao Shortcut Desktop
cls

cd /d "%~dp0"

echo Đang tạo biểu tượng tắt ngoài màn hình Desktop...

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $desk = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut(\"$desk\POS GOC PHO.lnk\"); $s.TargetPath = \"$((Get-Location).Path)\RUN_POS.bat\"; $s.WorkingDirectory = \"$((Get-Location).Path)\"; $s.IconLocation = \"$((Get-Location).Path)\RUN_POS.bat,0\"; $s.Description = \"Phần mềm Bán Hàng POS Trà Sữa - Cafe\"; $s.Save()"

echo.
echo ============================================================
echo  ĐÃ TẠO SHORTCUT 'POS GOC PHO' TRÊN MÀN HÌNH CHÍNH (DESKTOP)!
echo  Bạn chỉ cần nhấp đúp vào biểu tượng đó để mở phần mềm.
echo ============================================================
echo.
pause

