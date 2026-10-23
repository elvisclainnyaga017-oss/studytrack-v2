@echo off
title StudyTrack V2
cd /d "C:\Users\Administrator\Desktop\studytrack-v2"

echo ========================================
echo          STUDYTRACK V2
echo ========================================
echo.

echo Checking MariaDB service...
powershell -NoProfile -Command "if ((Get-Service MariaDB).Status -ne 'Running') { Start-Service MariaDB; Start-Sleep -Seconds 3 }"

if errorlevel 1 (
    echo Could not start MariaDB. Please check the MariaDB service.
    pause
    exit /b 1
)

echo Starting StudyTrack V2...
start "StudyTrack V2 Server" cmd /k "cd /d C:\Users\Administrator\Desktop\studytrack-v2 && npm.cmd run dev"

timeout /t 5 /nobreak >nul
start "" "http://localhost:3001"
exit /b
