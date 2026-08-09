@echo off
chcp 65001 >nul 2>&1
title 修复防火墙 - 允许手机访问

echo ========================================
echo   修复防火墙 - 允许手机访问 WordForge
echo ========================================
echo.

:: 检查管理员权限
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 需要管理员权限！
    echo.
    echo 请右键点击此文件，选择"以管理员身份运行"
    echo.
    pause
    exit /b 1
)

echo [1/4] 添加端口 8000 防火墙规则...
netsh advfirewall firewall delete rule name="WordForge 8000" >nul 2>&1
netsh advfirewall firewall add rule name="WordForge 8000" dir=in action=allow protocol=TCP localport=8000
if %errorlevel% equ 0 (
    echo       ✓ 端口 8000 规则已添加
) else (
    echo       ✗ 添加失败
)

echo.
echo [2/4] 确保 Python 程序被允许...
netsh advfirewall firewall add rule name="Python Allow All" dir=in action=allow program="C:\users\29015\appdata\local\programs\python\python313\python.exe" >nul 2>&1
echo       ✓ Python 规则已确认

echo.
echo [3/4] 当前网络 IP 地址:
echo.
ipconfig | findstr "IPv4"
echo.
echo   手机请访问以下地址之一:
echo   http://192.168.0.102:8000
echo   http://192.168.0.100:8000
echo.

echo [4/4] 完成！
echo.
echo ========================================
echo   如果手机仍然无法访问，请检查:
echo   1. 手机和电脑是否连接同一个WiFi
echo      (当前WiFi: MERCURY_5G_A63C 2)
echo   2. 路由器是否开启了"AP隔离"
echo      (如有，请在路由器设置中关闭)
echo   3. 尝试关闭电脑防火墙临时测试
echo ========================================
echo.
pause
