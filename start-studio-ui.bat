@echo off
title MatchMind Studio UI (port 5173)
cd /d "%~dp0matchmind"
if not exist node_modules (
  echo Installing workspace dependencies (first run only)...
  call pnpm install || goto :error
)
set PORT=5173
set BASE_PATH=/
set API_PROXY_TARGET=http://localhost:5000
echo Starting MatchMind studio on http://localhost:5173 ...
echo (Requires the event engine from start-studio-api.bat to be running)
call pnpm --filter @workspace/matchmind-ai run dev
goto :eof

:error
echo.
echo Install failed. Make sure Node.js 20+ and pnpm are installed:
echo   https://nodejs.org
echo   npm install -g pnpm
pause
