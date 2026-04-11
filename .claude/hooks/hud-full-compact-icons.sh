#!/bin/bash

# Get accurate CPU usage (not summed)
CPU=$(top -bn1 2>/dev/null | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//' || echo "0")
if [ -z "$CPU" ] || [ "$CPU" = "0" ]; then
  # Fallback if top fails
  CPU=$(cat /proc/stat 2>/dev/null | head -1 | awk '{sum=0; for(i=2;i<=NF;i++) sum+=$i; idle=$5; total=sum+idle; usage=100*(1-idle/total); printf "%.0f", usage}' || echo "0")
fi

# Get Memory usage
MEM=$(free 2>/dev/null | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}' || echo "0")

# Try to get HUD data from environment or use defaults
MODEL="${CLAUDE_MODEL:-Opus}"
CTX="${CLAUDE_CONTEXT:-45}"
GIT_BRANCH="${GIT_BRANCH:-main}"
TOOLS_COUNT="${TOOLS_COUNT:-3}"
TASKS_COUNT="${TASKS_COUNT:-5}"
AGENTS_COUNT="${AGENTS_COUNT:-2}"

# Format: icon + data separated by pipes
echo "🎨${MODEL} │ 📊${CTX}% │ 🔧${TOOLS_COUNT} │ ✓${TASKS_COUNT} │ 👥${AGENTS_COUNT} │ 🌳${GIT_BRANCH} │ 💻${CPU}% │ 📈${MEM}%"
