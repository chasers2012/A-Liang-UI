@echo off
REM 初始化 monorepo（调用 scripts\setup.ps1）。双击或在 cmd 中从任意目录运行均可。
setlocal
pushd "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
set "exitcode=%ERRORLEVEL%"
popd
exit /b %exitcode%
