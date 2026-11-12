@echo off
set "EDGE_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE_EXE%" set "EDGE_EXE=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
start "" "%EDGE_EXE%" --user-data-dir="%TEMP%\edge_dev_preview" --no-first-run --no-default-browser-check "http://127.0.0.1:8501/admin.html" "http://127.0.0.1:8500/super_admin.html"
