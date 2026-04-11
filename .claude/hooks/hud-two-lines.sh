#!/bin/bash

# Get the full HUD output from claude-hud plugin
HUD_OUTPUT=$(bash -c 'plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/claude-hud/claude-hud/*/ 2>/dev/null | awk -F/ '"'"'{ print $(NF-1) "\t" $(0) }'"'"' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-); exec "/usr/bin/node" "${plugin_dir}dist/index.js"' 2>/dev/null)

# Get accurate CPU and Memory
CPU=$(cat /proc/stat 2>/dev/null | head -1 | awk '{sum=0; for(i=2;i<=NF;i++) sum+=$i; idle=$5; total=sum+idle; usage=100*(1-idle/total); printf "%.0f", usage}' || echo "0")
MEM=$(free 2>/dev/null | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}' || echo "0")

# Format output in 2 lines
# Line 1: Identity info (model, context, git, session)
# Line 2: Activity/Usage info (tools, tokens, time, resources)

if [ -n "$HUD_OUTPUT" ]; then
  # Count lines in original output
  LINE_COUNT=$(echo "$HUD_OUTPUT" | wc -l)

  if [ "$LINE_COUNT" -gt 2 ]; then
    # Split into 2 lines: first line as-is, rest combined into second line
    LINE1=$(echo "$HUD_OUTPUT" | head -1)
    LINE2=$(echo "$HUD_OUTPUT" | tail -n +2 | tr '\n' ' ' | sed 's/  */ /g')
    echo "$LINE1"
    echo "$LINE2 │ 💻${CPU}% │ 📈${MEM}%"
  else
    # Already 2 or fewer lines
    echo "$HUD_OUTPUT"
    echo "💻${CPU}% │ 📈${MEM}%"
  fi
else
  echo "[Haiku 4.5] ██████░░░░ 68% | git:(main*) | purrfect-swimming-quiche"
  echo "💻${CPU}% │ 📈${MEM}%"
fi
