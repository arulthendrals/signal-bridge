@echo off
echo ========================================================
echo     STARTING SIGNALBRIDGE PUBLIC CLOUDFLARE TUNNEL
echo ========================================================
echo.
cd /d "C:\Users\HP\OneDrive\Desktop\antigravity"
echo Launching tunnel to http://127.0.0.1:8000 ...
.\cloudflared.exe tunnel --url http://127.0.0.1:8000
pause
