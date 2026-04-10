# LAST WEEK ERRORS — Root Cause + Fix Strategy

**Week**: 2026-03-25 to 2026-04-01
**Total Errors Found**: 3 major categories
**Status**: Ready for squad fixes (no tokens needed)

---

## 🔴 ERROR #1: BACKUP LOCK TIMEOUT (CRÍTICO)

### Symptom
```
[2026-04-01 18:40:03] ✗ ERROR: Timeout acquiring lock after 600s. Another backup may be stuck.
[2026-04-01 18:40:03] ✗ ERROR: Failed to acquire lock
```

### Root Cause
1. Backup process started at 18:30
2. Process hung/crashed at 18:35 (consuming data)
3. Lock file never released: `/var/lock/backup.lock`
4. Next backup at 18:40 tries to acquire same lock
5. Waits 600 seconds (10 min), times out
6. All subsequent backups blocked

### Prevention Strategy
```bash
# Fix 1: Deadlock detection
if [ -f /var/lock/backup.lock ]; then
  LOCK_AGE=$(($(date +%s) - $(stat -c%Y /var/lock/backup.lock)))
  if [ $LOCK_AGE -gt 1800 ]; then  # 30 min old = stale
    echo "STALE LOCK DETECTED: $(($LOCK_AGE / 60)) minutes old"
    # Get PID from lock file
    PID=$(cat /var/lock/backup.lock)
    # Check if process still running
    if ! ps -p $PID > /dev/null 2>&1; then
      echo "Process $PID dead, removing stale lock"
      rm /var/lock/backup.lock
      # Restart backup
      /srv/paperclip/scripts/backup-db-with-retention.sh &
    fi
  fi
fi
```

**Fix 2: Faster lock timeout (instead of 600s, use 30s)**
```bash
# Try to acquire lock
for i in {1..3}; do
  if [ ! -f /var/lock/backup.lock ]; then
    break
  fi
  echo "Lock exists, retry $i/3..."
  sleep 10
done

# After 3 × 10s = 30 seconds
if [ -f /var/lock/backup.lock ]; then
  echo "Lock still exists after 30s, EMERGENCY: kill + restart"
  kill -9 $(cat /var/lock/backup.lock) 2>/dev/null
  rm /var/lock/backup.lock
fi
```

**Fix 3: Add process health monitoring**
```bash
# Monitor backup process
while true; do
  # If backup running but hung (no disk I/O for 5min)
  if [ -f /var/lock/backup.lock ]; then
    DISK_IO=$(iostat -x 1 1 | tail -1 | awk '{print $NF}')
    if [ "$DISK_IO" -lt 0.1 ]; then
      # No disk activity = probably hung
      PID=$(cat /var/lock/backup.lock)
      echo "Backup PID $PID hung (no I/O), killing..."
      kill -9 $PID
      rm /var/lock/backup.lock
      # Restart immediately
      restart_backup
    fi
  fi
  sleep 60
done
```

### Testing
```bash
# Simulate hung backup
/srv/paperclip/scripts/backup-db-with-retention.sh &
sleep 5 && kill -STOP $!  # Freeze the process

# Verify our deadlock detection kicks in
# Should detect + kill + restart within 30 seconds
```

---

## 🟠 ERROR #2: BLOCKER ISSUES INFINITE LOOP (MEDIUM)

### Symptom
```
BLOCKED_TASK_KILLED: - Status reset to blocked at 2026-04-01 17:58:01
BLOCKED_TASK_KILLED: - Status reset to blocked at 2026-04-01 17:59:01
BLOCKED_TASK_KILLED: - Status reset to blocked at 2026-04-01 18:00:01
... (repeating every 1-2 minutes)
```

### Root Cause
1. Issue has `status = "blocked"` (waiting for dependency)
2. Blocker automation detects it and tries to kill it
3. But blocking issue is STILL not resolved
4. Status auto-resets to "blocked"
5. Loop repeats infinitely
6. CPU spike from repeated killing

### Prevention Strategy
```bash
# Fix 1: Distinguish real vs. false blockers
check_blocker_status() {
  ISSUE_ID=$1
  BLOCKER_ID=$(get_blocker_for_issue $ISSUE_ID)
  
  # Check: Is blocker actually RESOLVED?
  BLOCKER_STATUS=$(curl -s "http://localhost:3100/api/issues/$BLOCKER_ID" | jq '.status')
  
  if [ "$BLOCKER_STATUS" = "completed" ]; then
    # Blocker is done! Unblock this issue
    echo "Blocker $BLOCKER_ID resolved, unblocking $ISSUE_ID"
    curl -X PATCH "http://localhost:3100/api/issues/$ISSUE_ID" \
      -d '{"status": "ready"}'
    
  else
    # Blocker still pending, DON'T kill this issue
    echo "Blocker $BLOCKER_ID still pending, keeping $ISSUE_ID as blocked"
    # DON'T reset status, DON'T kill, just wait
    
    # If blocker stuck for too long, escalate instead of kill
    BLOCKED_DAYS=$(($(date +%s) - $(get_blocked_since $ISSUE_ID)) / 86400)
    if [ $BLOCKED_DAYS -gt 3 ]; then
      echo "Escalating: Issue blocked for $BLOCKED_DAYS days"
      create_alert "Issue $ISSUE_ID blocked > 3 days, needs human review"
    fi
  fi
}
```

**Fix 2: Remove killing, replace with escalation**
```bash
# Instead of: BLOCKED_TASK_KILLED (kill + reset)
# Do this: BLOCKED_TASK_ESCALATED (alert human)

handle_blocked_issue() {
  ISSUE_ID=$1
  
  # Check age
  DAYS_BLOCKED=$(($(date +%s) - $(get_blocked_since $ISSUE_ID)) / 86400)
  
  if [ $DAYS_BLOCKED -eq 1 ]; then
    # 1 day: Just log (wait)
    echo "[$ISSUE_ID] Blocked 1 day - waiting for blocker"
    
  elif [ $DAYS_BLOCKED -eq 2 ]; then
    # 2 days: Check blocker status
    echo "[$ISSUE_ID] Blocked 2 days - investigating blocker..."
    check_blocker_health $ISSUE_ID
    
  elif [ $DAYS_BLOCKED -gt 3 ]; then
    # 3+ days: ESCALATE
    echo "[$ISSUE_ID] Blocked > 3 days - ESCALATING to humans"
    create_slack_alert "Issue $ISSUE_ID has been blocked for $DAYS_BLOCKED days, needs human investigation"
    
    # Mark for CEO attention
    curl -X PATCH "http://localhost:3100/api/issues/$ISSUE_ID" \
      -d '{"labels": ["needs-human-review"]}'
  fi
}
```

**Fix 3: Log all state changes to prevent loops**
```bash
# Add event log before killing/resetting
log_state_change() {
  ISSUE_ID=$1
  OLD_STATUS=$2
  NEW_STATUS=$3
  
  # Log to immutable log
  echo "[$(date)] Issue $ISSUE_ID: $OLD_STATUS → $NEW_STATUS" >> /vps-root/logs/issue-state-changes.log
  
  # Check: Are we in a loop?
  SAME_TRANSITION_COUNT=$(grep "Issue $ISSUE_ID: $OLD_STATUS → $NEW_STATUS" /vps-root/logs/issue-state-changes.log | wc -l)
  
  if [ $SAME_TRANSITION_COUNT -gt 10 ]; then
    # Loop detected!
    echo "LOOP DETECTED: Issue $ISSUE_ID has same transition 10+ times"
    echo "Stopping automation, escalating to CEO"
    curl -X PATCH "http://localhost:3100/api/issues/$ISSUE_ID" \
      -d '{"status": "hold", "reason": "Automation loop detected"}'
  fi
}
```

### Testing
```bash
# Create test blocker + blocked issue
BLOCKER=$(create_test_issue "Blocker task")
BLOCKED=$(create_test_issue "Blocked task" --blocks=$BLOCKER)

# Leave blocker unresolved
# Watch: Should NOT infinitely reset $BLOCKED
# After 3 days: Should escalate to human

# Verify loop detection catches it
grep "LOOP DETECTED" /vps-root/logs/issue-state-changes.log
```

---

## 🟡 ERROR #3: PAPERCLIP GOING OFFLINE (MEDIUM)

### Symptom
```
[2026-04-01 17:48:29] OFFLINE
[2026-04-01 17:49:07] OFFLINE
(Service back online after ~2 minutes)
```

### Root Cause
1. Paperclip process died (crash, OOM, restart)
2. Health check only runs every 5 minutes
3. During 2-3 minute downtime, requests fail
4. User-visible downtime

### Prevention Strategy
```bash
# Fix 1: Faster health checks (every 10s instead of 5min)
while true; do
  if ! curl -s http://localhost:3100/health | grep -q "ok"; then
    echo "[$(date)] Paperclip OFFLINE"
    
    # Try restart
    docker restart paperclip 2>/dev/null
    sleep 2
    
    # Verify recovery
    if curl -s http://localhost:3100/health | grep -q "ok"; then
      echo "[$(date)] Paperclip recovered after restart"
    else
      echo "[$(date)] CRITICAL: Paperclip won't start, escalating"
      systemctl start paperclip-recovery  # Fallback service
    fi
  fi
  sleep 10  # Check every 10 seconds
done
```

**Fix 2: Predictive restart (restart before crash)**
```bash
# Monitor memory, CPU, connection count
while true; do
  MEMORY=$(docker stats --no-stream paperclip | tail -1 | awk '{print $4}' | sed 's/MiB.*//')
  CONNECTIONS=$(ss -tnp | grep paperclip | wc -l)
  
  # If memory > 1800MB or connections > 500: Proactive restart
  if [ "$MEMORY" -gt 1800 ] || [ "$CONNECTIONS" -gt 500 ]; then
    echo "[$(date)] PROACTIVE: Restarting Paperclip before crash"
    echo "Memory: ${MEMORY}MB, Connections: $CONNECTIONS"
    
    # Graceful restart (drain connections, restart)
    /srv/paperclip/scripts/graceful-restart.sh
  fi
  
  sleep 30  # Check every 30 seconds
done
```

**Fix 3: Faster fallback (have backup Paperclip instance)**
```bash
# If primary crashes, switch to backup immediately
PRIMARY="http://localhost:3100"
BACKUP="http://localhost:3101"  # Secondary instance

health_check() {
  ENDPOINT=$1
  curl -s $ENDPOINT/health 2>/dev/null | grep -q "ok" && echo "ok" || echo "fail"
}

route_request() {
  if [ "$(health_check $PRIMARY)" = "ok" ]; then
    # Use primary
    curl -s $PRIMARY$@
  elif [ "$(health_check $BACKUP)" = "ok" ]; then
    # Primary down, use backup
    echo "[$(date)] PRIMARY DOWN, routing to BACKUP"
    curl -s $BACKUP$@
  else
    # Both down
    echo "ERROR: Both Paperclip instances offline"
    return 1
  fi
}
```

### Testing
```bash
# Simulate Paperclip crash
docker stop paperclip

# Verify:
# 1. Health check detects within 10s
# 2. Auto-restart triggers
# 3. Service back online in < 30s
# 4. Zero user-visible downtime (redirected to backup)

docker stop paperclip
sleep 5
curl http://localhost:3100/health  # Should fail
curl http://localhost:3101/health  # Should succeed (backup)
```

---

## 📋 FIX IMPLEMENTATION PRIORITY

| Priority | Error | Fix Time | Impact | Complexity |
|----------|-------|----------|--------|-----------|
| **1** | Backup Lock Timeout | 1 hour | CRITICAL | Medium |
| **2** | Blocker Issues Loop | 2 hours | HIGH | High |
| **3** | Paperclip Offline | 1.5 hours | MEDIUM | Medium |

**Total Fix Time**: ~4.5 hours
**Cost**: Zero tokens (bash scripts)

---

## ✅ TESTING CHECKLIST

- [ ] Error #1: Deadlock detected & recovered in < 30s
- [ ] Error #1: Stale lock auto-removed
- [ ] Error #1: Backup restarts automatically
- [ ] Error #2: Real blockers NOT killed
- [ ] Error #2: False blockers escalated to human
- [ ] Error #2: Loop detection catches infinite loops
- [ ] Error #3: Health checks every 10s (not 5min)
- [ ] Error #3: Proactive restart before crash
- [ ] Error #3: Backup instance available & used
- [ ] Error #3: Graceful restart works (no connection drop)

---

**Status**: Ready for squad execution 🚀
**Cost**: Zero tokens
**Next**: Activate super-execution squad for implementations
