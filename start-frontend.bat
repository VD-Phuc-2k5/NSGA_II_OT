@echo off
REM Doctor Scheduling App - Frontend Launcher
REM Run this in the second terminal
cd /d "%~dp0frontend"

echo ========================================
echo  Doctor Scheduling - Frontend Server
echo ========================================
echo.
echo Starting Next.js frontend on port 3000...
echo.

call npm run dev

pause
