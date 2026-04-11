#!/bin/bash

# Get CPU and Memory
CPU=$(ps aux | awk 'NR>1 {sum+=$3} END {printf "%.0f", sum}')
MEM=$(free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}')

# Get context percentage (mock - would be from Claude)
CTX="45"

# Simple compact format with icons
# 🎨=model, 📊=context, 🔧=tools, ✓=done, 🌳=git, 💻=cpu, 📈=memory, ⏱=time

echo "🎨Opus │ 📊${CTX}% │ 🔧Active │ ✓5 │ 🌳main │ 💻${CPU}% │ 📈${MEM}%"
