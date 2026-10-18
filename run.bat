@echo off
echo ========================================================
echo        STARTING SIGNALBRIDGE EMERGENCY COPILOT
echo ========================================================
echo.
cd /d "C:\Users\HP\OneDrive\Desktop\antigravity"
start "" "http://127.0.0.1:8000"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
