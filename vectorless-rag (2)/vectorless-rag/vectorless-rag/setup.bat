@echo off
setlocal

echo ========================================
echo Vectorless RAG - Windows Setup
echo ========================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.10+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

echo [1/4] Setting up backend...
cd /d "%~dp0backend"

:: Create virtual environment
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

:: Activate virtual environment
call venv\Scripts\activate.bat

:: Install dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

:: Create .env if it doesn't exist
if not exist ".env" (
    echo.
    echo [CONFIG] Creating .env file...
    echo # Generate secret keys
    echo JWT_SECRET_KEY=change_me_to_a_random_64_char_hex_string > .env
    echo SESSION_SECRET_KEY=change_me_to_another_random_64_char_hex_string >> .env
    echo. >> .env
    echo # Get your Groq API key from https://console.groq.com/keys >> .env
    echo GROQ_API_KEY=your_groq_api_key_here >> .env
    echo. >> .env
    echo # Optional: Gemini API key >> .env
    echo GEMINI_API_KEY=your-gemini-api-key-here >> .env
    echo. >> .env
    echo CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173 >> .env
    echo. >> .env
    echo # LLM provider: groq, gemini-lite, gemini-flash >> .env
    echo LLM_PROVIDER=groq >> .env
    echo.
    echo [!] Created .env file - Please edit it with your API keys!
)

cd /d "%~dp0"

echo.
echo [2/4] Setting up frontend...
cd /d "%~dp0frontend"

:: Install Node.js dependencies
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    npm install
)

cd /d "%~dp0"

echo.
echo [3/4] Creating required directories...
if not exist "backend\documents" mkdir "backend\documents"
if not exist "backend\logs" mkdir "backend\logs"
if not exist "logs" mkdir "logs"

echo.
echo [4/4] Setup complete!
echo.
echo ========================================
echo SETUP COMPLETE
echo ========================================
echo.
echo NEXT STEPS:
echo 1. Edit backend\.env and add your API keys:
echo    - GROQ_API_KEY (required) - Get from https://console.groq.com/keys
echo    - JWT_SECRET_KEY (required) - Generate a random hex string
echo    - SESSION_SECRET_KEY (required) - Generate another random hex string
echo.
echo 2. Run the application:
echo    run.bat start
echo.
echo 3. Open in browser:
echo    http://localhost:5173
echo.
echo 4. Stop the application:
echo    run.bat stop
echo.
echo ========================================
pause
