@echo off
REM ─────────────────────────────────────────────────────────────────────────
REM  AutoFlow Desktop GPU Worker — Windows startup script
REM  Double-click or add to Task Scheduler (Trigger: At logon, Run highest)
REM ─────────────────────────────────────────────────────────────────────────

set GPU_WORKER_HOST=0.0.0.0
set GPU_WORKER_PORT=8500
set GPU_WORKER_WORKDIR=C:\autoflow\gpu_jobs
set GPU_WORKER_TIMEOUT=1800
set GPU_WORKER_CONCURRENCY=1

REM Shared secret with VPS — set to the same value in /etc/autoflow/gpu.env on the VPS
REM Leave blank only for local testing on a trusted LAN.
set GPU_WORKER_TOKEN=CHANGE_ME_TO_A_LONG_RANDOM_STRING

REM Path to the Python interpreter with fastapi + uvicorn + httpx installed.
REM Using a dedicated venv is strongly recommended.
set PYTHON_EXE=C:\autoflow\venv\Scripts\python.exe

if not exist %PYTHON_EXE% (
    echo [ERROR] Python not found at %PYTHON_EXE%
    echo Create the venv first:
    echo     python -m venv C:\autoflow\venv
    echo     C:\autoflow\venv\Scripts\pip install fastapi "uvicorn[standard]" httpx pydantic python-multipart
    pause
    exit /b 1
)

if not exist %GPU_WORKER_WORKDIR% mkdir %GPU_WORKER_WORKDIR%

cd /d %~dp0\..
echo [INFO] Starting AutoFlow GPU Worker on %GPU_WORKER_HOST%:%GPU_WORKER_PORT%
%PYTHON_EXE% gpu_worker_api.py
