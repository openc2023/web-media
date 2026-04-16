@echo off
setlocal
cd /d "%~dp0"
echo Starting local server at http://127.0.0.1:4173
start "" http://127.0.0.1:4173
python -m http.server 4173
