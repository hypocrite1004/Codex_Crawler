@echo off
setlocal

set "PGROOT=C:\Users\SECURITYHUB\pgsql17-local\17"
set "PGDATA=C:\Users\SECURITYHUB\pgsql17-local\data"
set "PGLOG=C:\Users\SECURITYHUB\pgsql17-local\data\server.log"

"%PGROOT%\bin\pg_isready.exe" -h 127.0.0.1 -p 5433 >nul 2>&1
if %errorlevel%==0 (
    echo Local PostgreSQL is already running on 127.0.0.1:5433
    endlocal
    exit /b 0
)

"%PGROOT%\bin\pg_ctl.exe" -D "%PGDATA%" -l "%PGLOG%" start

endlocal
