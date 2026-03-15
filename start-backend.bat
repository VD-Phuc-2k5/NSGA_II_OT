@echo off
REM Doctor Scheduling App - Backend Launcher
REM Run this in the first terminal
cd /d "%~dp0backend"
for /f "tokens=*" %%i in ('cd') do set BACKEND_DIR=%%i
cd /d "%~dp0"
for /f "tokens=*" %%i in ('cd') do set SOURCE_DIR=%%i
cd /d "%BACKEND_DIR%"

echo ========================================
echo  Doctor Scheduling - Backend Server
echo ========================================
echo.
echo Starting FastAPI backend on port 8000...
echo.

call "%SOURCE_DIR%\venv\Scripts\activate.bat"
set PYTHONPATH=%SOURCE_DIR%
python -m uvicorn app.main:app --reload --port 8000

pause
