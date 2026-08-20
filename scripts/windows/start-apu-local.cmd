@echo off
setlocal

rem Resolve the repository root relative to this launcher so it works from
rem either its own directory or any other current working directory.
cd /d "%~dp0\..\.." || exit /b 1

start "" "http://localhost:5173/"
call npm.cmd run dev:local
exit /b %errorlevel%
