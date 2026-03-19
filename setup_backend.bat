@echo off
if not exist venv (
    python -m venv venv
)

call .\venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
python -m playwright install chromium

if not exist backend\.env if exist backend\.env.example copy backend\.env.example backend\.env > nul

echo Backend dependencies installed.
echo Run with: call .\venv\Scripts\activate.bat ^&^& cd backend ^&^& python manage.py runserver
