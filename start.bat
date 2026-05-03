@echo off
title JIN MultiAI Chat
echo ============================================
echo   JIN MultiAI Chat
echo ============================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if errorlevel 1 ( echo ERROR: npm install gagal! & pause & exit /b 1 )
    echo.
)

echo Pastikan 9Router sudah berjalan di http://localhost:20128
echo.
start "" "http://localhost:3099"
echo Server: http://localhost:3099
echo Tekan Ctrl+C untuk berhenti.
echo.
node server.js
