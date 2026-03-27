@echo off
setlocal

set "PGROOT=C:\Users\SECURITYHUB\pgsql17-local\17"
set "PGDATA=C:\Users\SECURITYHUB\pgsql17-local\data"

"%PGROOT%\bin\pg_ctl.exe" -D "%PGDATA%" stop

endlocal
