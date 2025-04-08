@echo off
setlocal enabledelayedexpansion

echo ======================================
echo WebSocket Server Kill Script
echo ======================================

:: Find the Python socket server process on port 5001
echo Looking for process using port 5001...
for /f "tokens=1,5" %%a in ('netstat -ano ^| findstr ":5001"') do (
    set pid=%%b
    echo Found process on port 5001 with PID: !pid!
    goto :kill5001
)

echo No process found running on port 5001.
goto :check8000

:kill5001
echo.
echo Killing process with PID: !pid!
taskkill /F /PID !pid!
if !errorlevel! equ 0 (
    echo Process successfully terminated.
) else (
    echo Failed to terminate process. Try running as administrator.
)

:check8000
:: Find the process using port 8000
echo.
echo Looking for process using port 8000...
for /f "tokens=1,5" %%a in ('netstat -ano ^| findstr ":8000"') do (
    set pid=%%b
    echo Found process on port 8000 with PID: !pid!
    goto :kill8000
)

echo No process found running on port 8000.
goto :end

:kill8000
echo.
echo Killing process with PID: !pid!
taskkill /F /PID !pid!
if !errorlevel! equ 0 (
    echo Process successfully terminated.
) else (
    echo Failed to terminate process. Try running as administrator.
)

:end
echo.
echo Done! 