#!/bin/bash

# Get HUD output
HUD_OUTPUT=$(bash -c 'plugin_dir=$(ls -d "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"/plugins/cache/claude-hud/claude-hud/*/ 2>/dev/null | awk -F/ '"'"'{ print $(NF-1) "\t" $(0) }'"'"' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-); exec "/usr/bin/node" "${plugin_dir}dist/index.js"' 2>/dev/null)

# Get CPU usage
CPU_USAGE=$(ps aux | awk 'NR>1 {sum+=$3} END {printf "%.0f", sum}')

# Get Memory usage
MEM_USAGE=$(free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}')

# Combine output
if [ -n "$HUD_OUTPUT" ]; then
  echo "$HUD_OUTPUT │ CPU: ${CPU_USAGE}% │ MEM: ${MEM_USAGE}%"
else
  echo "[Opus] ████░░░░░ 45% │ CPU: ${CPU_USAGE}% │ MEM: ${MEM_USAGE}%"
fi
