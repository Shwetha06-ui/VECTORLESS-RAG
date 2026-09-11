@echo off
setlocal enabledelayedexpansion

:: Vectorless RAG - Windows Start/Stop Script

set "PROJECT_DIR=%~dp0"
set "BACKEND_DIR=%PROJECT_DIR%backend"
set "FRONTEND_DIR=%PROJECT_DIR%frontend"
set "LOG_DIR=%PROJECT_DIR%logs"

set "BACKEND_PID_FILE=%LOG_DIR%\backend.pid"
set "FRONTEND_PID_FILE=%LOG_DIR%\frontend.pid"
set "BACKEND_LOG=%LOG_DIR%\backend.log"
set "FRONTEND_LOG=%LOG_DIR%\frontend.log"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: Colors (Windows 10+ supports ANSI)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "NC=[0m"

:check_backend
if exist "%BACKEND_PID_FILE%" (
    set /p BACKEND_PID=<"%BACKEND_PID_FILE%"
    tasklist /FI "PID eq !BACKEND_PID!" 2>nul | find /i "python" >nul
    if !errorlevel! equ 0 (
        echo %GREEN%Backend: Running (PID: !BACKEND_PID!)%NC%
        goto :check_frontend
    )
)
echo %RED%Backend: Stopped%NC%

:check_frontend
if exist "%FRONTEND_PID_FILE%" (
    set /p FRONTEND_PID=<"%FRONTEND_PID_FILE%"
    tasklist /FI "PID eq !FRONTEND_PID!" 2>nul | find /i "node" >nul
    if !errorlevel! equ 0 (
        echo %GREEN%Frontend: Running (PID: !FRONTEND_PID!)%NC%
        goto :eof
    )
)
echo %RED%Frontend: Stopped%NC%
goto :eof

:start_backend
if exist "%BACKEND_PID_FILE%" (
    set /p BACKEND_PID=<"%BACKEND_PID_FILE%"
    tasklist /FI "PID eq !BACKEND_PID!" 2>nul | find /i "python" >nul
    if !errorlevel! equ 0 (
        echo %YELLOW%Backend is already running (PID: !BACKEND_PID!)%NC%
        goto :eof
    )
)

echo %YELLOW%Starting backend...%NC%
cd /d "%BACKEND_DIR%"
start /B cmd /c "python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 > "%BACKEND_LOG%" 2>&1"
timeout /t 2 /nobreak >nul
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq python.exe" ^| find "python"') do (
    set "BACKEND_PID=%%a"
    goto :save_backend_pid
)
:save_backend_pid
echo !BACKEND_PID! > "%BACKEND_PID_FILE%"
echo %GREEN%Backend started (PID: !BACKEND_PID!)%NC%
cd /d "%PROJECT_DIR%"
goto :eof

:start_frontend
if exist "%FRONTEND_PID_FILE%" (
    set /p FRONTEND_PID=<"%FRONTEND_PID_FILE%"
    tasklist /FI "PID eq !FRONTEND_PID!" 2>nul | find /i "node" >nul
    if !errorlevel! equ 0 (
        echo %YELLOW%Frontend is already running (PID: !FRONTEND_PID!)%NC%
        goto :eof
    )
)

echo %YELLOW%Starting frontend...%NC%
cd /d "%FRONTEND_DIR%"
start /B cmd /c "npm run dev > "%FRONTEND_LOG%" 2>&1"
timeout /t 3 /nobreak >nul
for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" ^| find "node"') do (
    set "FRONTEND_PID=%%a"
    goto :save_frontend_pid
)
:save_frontend_pid
echo !FRONTEND_PID! > "%FRONTEND_PID_FILE%"
echo %GREEN%Frontend started (PID: !FRONTEND_PID!)%NC%
cd /d "%PROJECT_DIR%"
goto :eof

:stop_backend
if exist "%BACKEND_PID_FILE%" (
    set /p BACKEND_PID=<"%BACKEND_PID_FILE%"
    echo %YELLOW%Stopping backend (PID: !BACKEND_PID!)...%NC%
    taskkill /PID !BACKEND_PID! /F >nul 2>&1
    del "%BACKEND_PID_FILE%" 2>nul
    echo %GREEN%Backend stopped%NC%
) else (
    echo %YELLOW%Backend is not running%NC%
)
goto :eof

:stop_frontend
if exist "%FRONTEND_PID_FILE%" (
    set /p FRONTEND_PID=<"%FRONTEND_PID_FILE%"
    echo %YELLOW%Stopping frontend (PID: !FRONTEND_PID!)...%NC%
    taskkill /PID !FRONTEND_PID! /F >nul 2>&1
    del "%FRONTEND_PID_FILE%" 2>nul
    echo %GREEN%Frontend stopped%NC%
) else (
    echo %YELLOW%Frontend is not running%NC%
)
goto :eof

:show_status
echo.
echo === Vectorless RAG Status ===
echo.
call :check_backend
call :check_frontend
echo.
echo URLs:
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo   API Docs: http://localhost:8000/docs
echo.
goto :eof

:show_logs
echo === Backend Logs (last 20 lines) ==
if exist "%BACKEND_LOG%" (
    powershell -Command "Get-Content '%BACKEND_LOG%' -Tail 20"
) else (
    echo No backend logs
)
echo.
echo === Frontend Logs (last 20 lines) ==
if exist "%FRONTEND_LOG%" (
    powershell -Command "Get-Content '%FRONTEND_LOG%' -Tail 20"
) else (
    echo No frontend logs
)
goto :eof

:: Main
if "%1"=="start" (
    call :start_backend
    call :start_frontend
    call :show_status
) else if "%1"=="stop" (
    call :stop_backend
    call :stop_frontend
) else if "%1"=="restart" (
    call :stop_backend
    call :stop_frontend
    timeout /t 1 /nobreak >nul
    call :start_backend
    call :start_frontend
    call :show_status
) else if "%1"=="status" (
    call :show_status
) else if "%1"=="logs" (
    call :show_logs
) else (
    echo Usage: run.bat {start^|stop^|restart^|status^|logs}
    echo.
    echo Commands:
    echo   start    - Start both backend and frontend
    echo   stop     - Stop both services
    echo   restart  - Restart both services
    echo   status   - Show current status
    echo   logs     - Show recent logs
)
