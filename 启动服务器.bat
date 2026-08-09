@echo off
chcp 65001 >nul 2>&1
title WordForge Server

echo ========================================
echo   WordForge 服务器启动器
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] 检查端口 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    echo 正在停止旧进程 PID: %%a
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
)

echo [2/3] 启动服务器...
echo.
echo ========================================
echo   服务器地址: http://localhost:8000
echo   按 Ctrl+C 停止服务器
echo ========================================
echo.

python main.py

echo.
echo 服务器已停止。按任意键退出...
pause >nul
