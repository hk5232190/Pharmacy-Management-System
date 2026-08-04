@echo off
title PMS - Application Startup
echo ==============================================
echo Pharmacy Management System - Startup
echo ==============================================
echo.

echo Starting Backend Server (FastAPI)...
start "PMS Backend" cmd /c "cd backend && .\venv\Scripts\python.exe -m uvicorn main:app --reload"

echo Starting Frontend Server (Next.js)...
start "PMS Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo Both servers are starting in separate windows.
echo Frontend will be available at: http://localhost:3000
echo Backend API will be available at: http://localhost:8000
echo.
pause
