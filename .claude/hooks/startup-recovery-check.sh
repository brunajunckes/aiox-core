#!/bin/bash
# Auto-recovery health check on Claude startup
# Ensures zero data loss even after crashes

RECOVERY_FLAG="/tmp/claude-recovery-check-$(date +%Y%m%d)"
VAULT_CHECK="/root/llm-router-aiox/.aiox-core/vault"
CLAUDE_JSON="/root/.claude.json"
BACKUP_DIR="/root/.claude-snapshots/final-backup"

# Check if already ran today
if [ -f "$RECOVERY_FLAG" ]; then
  exit 0
fi

echo "🔍 Startup health check..."
touch "$RECOVERY_FLAG"

# 1. Check Claude config
if [ ! -f "$CLAUDE_JSON" ] || ! grep -q "claude-hud" "$CLAUDE_JSON" 2>/dev/null; then
  echo "⚠️  Claude config incomplete. Restoring..."
  [ -f "$BACKUP_DIR/.claude.json" ] && cp "$BACKUP_DIR/.claude.json" "$CLAUDE_JSON"
fi

# 2. Check Obsidian vault
if [ ! -d "$VAULT_CHECK" ]; then
  echo "⚠️  Obsidian vault missing. Restoring..."
  mkdir -p "$VAULT_CHECK"
  if [ -f "$BACKUP_DIR/obsidian-vault-backup.tar.gz" ]; then
    tar -xzf "$BACKUP_DIR/obsidian-vault-backup.tar.gz" -C /root/.aiox-core/ 2>/dev/null || true
  fi
fi

# 3. Check memories
if [ ! -d "/root/.claude/projects/-root/memory" ] || [ $(find /root/.claude/projects/-root/memory -type f 2>/dev/null | wc -l) -lt 5 ]; then
  echo "⚠️  Memory files incomplete. Restoring..."
  mkdir -p /root/.claude/projects/-root/memory
  [ -d "$BACKUP_DIR/memory" ] && cp -r "$BACKUP_DIR/memory/"* /root/.claude/projects/-root/memory/ 2>/dev/null || true
fi

# 4. Check HUD hooks
if [ ! -f "/root/.claude/hooks/hud-metrics-display.js" ]; then
  echo "⚠️  HUD hook missing. Restoring..."
  [ -f "$BACKUP_DIR/hooks/hud-metrics-display.js" ] && cp "$BACKUP_DIR/hooks/hud-metrics-display.js" /root/.claude/hooks/
fi

echo "✅ Startup check complete"
exit 0
