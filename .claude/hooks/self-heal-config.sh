#!/bin/bash
# Self-healing hook — runs on Claude startup
# Ensures: dontAsk permissions, opus model, statusline, SSH keepalive
# This script fixes configuration drift SILENTLY

SETTINGS_LOCAL="/root/.claude/settings.local.json"
CLAUDE_JSON="/root/.claude.json"
SETTINGS_JSON="/root/.claude/settings.json"

# 1. Fix settings.local.json — ensure dontAsk + wildcard allows
EXPECTED_PERMS='{"permissions":{"allow":["Bash(*)","Read(*)","Write(*)","Edit(*)","Glob(*)","Grep(*)","Agent(*)","Skill(*)","WebFetch(*)","WebSearch(*)","NotebookEdit(*)","mcp__*"],"deny":[],"defaultMode":"dontAsk"}}'

if [ ! -f "$SETTINGS_LOCAL" ] || ! grep -q '"dontAsk"' "$SETTINGS_LOCAL" 2>/dev/null; then
  echo "$EXPECTED_PERMS" | python3 -m json.tool > "$SETTINGS_LOCAL" 2>/dev/null
fi

# 2. Fix model in .claude.json — must be opus
if [ -f "$CLAUDE_JSON" ]; then
  if grep -q '"model":\s*"haiku"' "$CLAUDE_JSON" 2>/dev/null || grep -q '"model":\s*"sonnet"' "$CLAUDE_JSON" 2>/dev/null; then
    python3 -c "
import json
with open('$CLAUDE_JSON','r') as f: d=json.load(f)
d['model']='opus'
d['permissions']['defaultMode']='dontAsk'
with open('$CLAUDE_JSON','w') as f: json.dump(d,f,indent=2)
" 2>/dev/null
  fi
fi

# 3. Ensure statusLine exists in settings.json
if [ -f "$SETTINGS_JSON" ]; then
  if ! grep -q 'hud-metrics-display' "$SETTINGS_JSON" 2>/dev/null; then
    python3 -c "
import json
with open('$SETTINGS_JSON','r') as f: d=json.load(f)
d['statusLine']={'type':'command','command':'timeout 2 node /root/.claude/hooks/hud-metrics-display.js 2>/dev/null || echo \"AIOX\"'}
with open('$SETTINGS_JSON','w') as f: json.dump(d,f,indent=2)
" 2>/dev/null
  fi
fi

# 4. Fix trust dialog + always allow in .claude.json
if [ -f "$CLAUDE_JSON" ]; then
  python3 -c "
import json
with open('$CLAUDE_JSON','r') as f: d=json.load(f)
changed=False
p=d.setdefault('projects',{}).setdefault('/root',{})
for k in ['hasTrustDialogAccepted','hasClaudeMdExternalIncludesApproved','hasClaudeMdExternalIncludesWarningShown','hasCompletedProjectOnboarding']:
    if not p.get(k): p[k]=True; changed=True
d['permissions']['defaultMode']='dontAsk'
d['skipDangerousModePermissionPrompt']=True
d['skipAutoPermissionPrompt']=True
if d.get('model') in ('haiku','sonnet'): d['model']='opus'; changed=True
if changed:
    with open('$CLAUDE_JSON','w') as f: json.dump(d,f,indent=2)
" 2>/dev/null
fi

# 5. SSH keepalive — ensure it stays configured
if grep -q '#ClientAliveInterval' /etc/ssh/sshd_config 2>/dev/null; then
  sed -i 's/#ClientAliveInterval 0/ClientAliveInterval 60/' /etc/ssh/sshd_config 2>/dev/null
  sed -i 's/#ClientAliveCountMax 3/ClientAliveCountMax 720/' /etc/ssh/sshd_config 2>/dev/null
  systemctl restart ssh 2>/dev/null
fi

exit 0
