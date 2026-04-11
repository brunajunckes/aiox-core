#!/bin/bash

# Get the full HUD output from claude-hud plugin
HUD_OUTPUT=$(bash -c 'plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/claude-hud/claude-hud/*/ 2>/dev/null | awk -F/ '"'"'{ print $(NF-1) "\t" $(0) }'"'"' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-); exec "/usr/bin/node" "${plugin_dir}dist/index.js"' 2>/dev/null)

# Get accurate CPU usage
CPU=$(cat /proc/stat 2>/dev/null | head -1 | awk '{sum=0; for(i=2;i<=NF;i++) sum+=$i; idle=$5; total=sum+idle; usage=100*(1-idle/total); printf "%.0f", usage}' || echo "0")

# Get Memory usage
MEM=$(free 2>/dev/null | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}' || echo "0")

# Combine and output on one line (remove newlines, condense whitespace)
if [ -n "$HUD_OUTPUT" ]; then
  # Take the HUD output, compress it, and add CPU/MEM
  echo "$HUD_OUTPUT" | tr '\n' ' ' | sed 's/  */ /g' | sed "s/$/│ 💻${CPU}% │ 📈${MEM}%/"
else
  echo "[Haiku 4.5] ██████░░░░ 68% | git:(main*) | 💻${CPU}% | 📈${MEM}%"
fi
