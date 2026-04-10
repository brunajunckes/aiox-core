#!/bin/bash
# Auto-load @aiox-master on Claude startup
# This hook runs before Claude CLI prompt

# Check if we're in a Claude session
if [ -z "$CLAUDE_SESSION_ID" ]; then
  exit 0
fi

# Display agent activation banner
echo "🚀 Ativando Orion (AIOX Master)..."

# The actual agent activation happens via the ACTIVATION_PROMPT
# which will be shown before user input
exit 0
