@echo off
title WarBox (워박스)
echo ========================================================
echo   워박스 (WarBox) - 대규모 군단 배틀 시뮬레이터
echo   YouTube / Shorts Creator Suite
echo ========================================================
echo.
echo 브라우저를 열고 로컬 서버를 실행합니다...
echo URL: http://localhost:8080
echo.
timeout /t 1 /nobreak >nul
start http://localhost:8080
python -m http.server 8080
