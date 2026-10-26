@echo off
title Football Match Intelligence (port 3005)
cd /d "%~dp0football-intel"
if not exist node_modules (
  echo Installing dependencies (first run only)...
  call npm install || goto :error
)
echo Starting Football Match Intelligence on http://localhost:3005 ...
call npm run dev
goto :eof

:error
echo.
echo Install failed. Make sure Node.js 20+ is installed: https://nodejs.org
pause
