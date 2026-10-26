@echo off
title MatchMind - Live Event Engine (port 5000)
cd /d "%~dp0matchmind"
if not exist node_modules (
  echo Installing workspace dependencies (first run only)...
  call pnpm install || goto :error
)
set PORT=5000
echo Starting live event engine on http://localhost:5000 ...
call pnpm --filter @workspace/api-server run dev
goto :eof

:error
echo.
echo Install failed. Make sure Node.js 20+ and pnpm are installed:
echo   https://nodejs.org
echo   npm install -g pnpm
pause
