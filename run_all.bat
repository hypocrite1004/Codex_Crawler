@echo off
echo Starting Django Backend...
start cmd /k "cd backend && call ..\venv\Scripts\activate.bat && python manage.py runserver"

echo Starting Next.js Frontend...
start cmd /k "cd frontend && npm run dev"

echo Starting Crawler Scheduler...
start cmd /k "cd backend && call ..\venv\Scripts\activate.bat && python manage.py run_crawler_scheduler --poll-seconds 60"

echo Backend, frontend, and scheduler are starting in separate windows.
