#!/usr/bin/env python3
"""AutoFlow Resource Monitor — systemd service
Monitors RAM, disk, CPU, Docker containers.
Logs to /var/log/autoflow-monitor.jsonl
Takes protective action when resources are critical.
"""
import psutil, json, time, subprocess, os, sys

THRESHOLDS = {"ram_pct": 85, "ram_critical": 92, "disk_pct": 90}
LOG = "/var/log/autoflow-monitor.jsonl"
INTERVAL = 30  # seconds

def check():
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    cpu_pct = psutil.cpu_percent(interval=1)

    try:
        containers = int(subprocess.getoutput("docker ps -q 2>/dev/null | wc -l"))
    except Exception:
        containers = -1

    state = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "cpu_pct": cpu_pct,
        "ram_pct": round(ram.percent, 1),
        "ram_used_gb": round(ram.used / 1e9, 2),
        "ram_avail_gb": round(ram.available / 1e9, 2),
        "disk_pct": round(disk.percent, 1),
        "disk_free_gb": round(disk.free / 1e9, 1),
        "containers": containers,
    }

    with open(LOG, "a") as f:
        f.write(json.dumps(state) + "\n")

    if state["ram_pct"] > THRESHOLDS["ram_critical"]:
        subprocess.run(["docker", "stop", "llm-router-grafana"], capture_output=True)
        subprocess.run(["docker", "stop", "llm-router-prometheus"], capture_output=True)
        log_alert(state, "CRITICAL: RAM > 92%, stopped non-critical containers")
    elif state["ram_pct"] > THRESHOLDS["ram_pct"]:
        log_alert(state, "WARNING: RAM > 85%")

    if state["disk_pct"] > THRESHOLDS["disk_pct"]:
        subprocess.run(["find", "/var/log", "-name", "*.gz", "-mtime", "+7", "-delete"], capture_output=True)
        log_alert(state, f"WARNING: Disk {state['disk_pct']}%, cleaned old logs")

    return state

def log_alert(state, msg):
    alert = {"ts": state["ts"], "alert": msg, **state}
    with open(LOG, "a") as f:
        f.write(json.dumps(alert) + "\n")
    print(f"[ALERT] {msg}", file=sys.stderr)

if __name__ == "__main__":
    print(f"AutoFlow Monitor started. Logging to {LOG}", file=sys.stderr)
    while True:
        try:
            check()
        except Exception as e:
            print(f"Monitor error: {e}", file=sys.stderr)
        time.sleep(INTERVAL)
