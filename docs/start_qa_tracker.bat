@echo off
cd /d "%~dp0\.."
start "" http://127.0.0.1:8599/13_BANG_THEO_DOI_KHUYET_TAT.html
python tools\qa_tracker_server.py
