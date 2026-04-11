#!/bin/bash

# Single-line HUD for Claude Code statusLine
# Format: Usage | Weekly 3d/7d | Model | Git | Tasks | CPU | MEM

# Read stdin JSON from Claude Code
INPUT=$(cat 2>/dev/null)

# Get claude-hud plugin output (pass stdin to plugin)
HUD_OUTPUT=$(echo "$INPUT" | bash -c 'plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/claude-hud/claude-hud/*/ 2>/dev/null | tail -1); exec "/usr/bin/node" "${plugin_dir}dist/index.js"' 2>/dev/null)

# System metrics
CPU=$(cat /proc/stat 2>/dev/null | head -1 | awk '{sum=0; for(i=2;i<=NF;i++) sum+=$i; idle=$5; total=sum+idle; usage=100*(1-idle/total); printf "%.0f", usage}' || echo "0")
MEM=$(free 2>/dev/null | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}' || echo "0")

# Weekly day counter (1-7)
DAY_OF_WEEK=$(date +%u)
WEEKLY_PROGRESS=$((DAY_OF_WEEK * 100 / 7))

# Build progress bar
build_bar() {
  local pct=$1
  local filled=$((pct / 10))
  local empty=$((10 - filled))
  local bar=""
  for ((i=0; i<filled; i++)); do bar+="█"; done
  for ((i=0; i<empty; i++)); do bar+="░"; done
  echo "$bar"
}

WEEKLY_BAR=$(build_bar $WEEKLY_PROGRESS)

# Git branch
GIT_BRANCH=$(git -C "${CLAUDE_PROJECT_DIR:-$PWD}" branch --show-current 2>/dev/null || echo "main")

# Model
MODEL=$(python3 -c "import json; print(json.load(open('/root/.claude.json')).get('model','opus'))" 2>/dev/null || echo "opus")

# Tasks
TASKS_PENDING=8
TASKS_TOTAL=138

# Try to extract Usage from HUD plugin output
if [ -n "$HUD_OUTPUT" ] && ! echo "$HUD_OUTPUT" | grep -q "Initializing"; then
  USAGE_INFO=$(echo "$HUD_OUTPUT" | grep -oiE "Usage[^│]*" | head -1 || echo "")
else
  USAGE_INFO=""
fi

# Default Usage if plugin not ready
if [ -z "$USAGE_INFO" ]; then
  USAGE_INFO="Usage █░░░░░░░░░ 10%"
fi

# Single-line output
echo "${USAGE_INFO} │ Weekly ${WEEKLY_BAR} ${DAY_OF_WEEK}d/7d │ 🤖${MODEL} │ 🔀${GIT_BRANCH} │ 📋${TASKS_PENDING}/${TASKS_TOTAL} │ 💻${CPU}% │ 📈${MEM}%"
