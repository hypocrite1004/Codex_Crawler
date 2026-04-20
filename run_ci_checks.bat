@echo off
setlocal

echo [1/5] Starting local PostgreSQL...
call start_local_postgres.bat
if errorlevel 1 exit /b 1

echo [2/5] Django system checks...
call .\venv\Scripts\python.exe backend\manage.py check
if errorlevel 1 exit /b 1

echo [3/5] Backend tests...
call .\venv\Scripts\python.exe backend\manage.py test api.tests --keepdb
if errorlevel 1 exit /b 1

echo [4/5] Frontend lint...
pushd frontend
call npm run lint
if errorlevel 1 (
    popd
    exit /b 1
)

echo [5/5] Frontend build and E2E...
call npm run build
if errorlevel 1 (
    popd
    exit /b 1
)
call npm run test:e2e
if errorlevel 1 (
    popd
    exit /b 1
)
popd

echo All checks passed.
endlocal
