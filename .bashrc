
# ============================================================================
# Claude + AIOX Configuration
# ============================================================================

# Recovery: claude-recovery | claude-recovery snapshot | claude-recovery verify
# Script at /usr/local/bin/claude-recovery (already in PATH)

# ============ CLAUDE SETTINGS ============
# settings.json is managed by Claude Code — do NOT delete it
# ==================================================================

# PATH
export PATH="$HOME/.local/bin:$PATH"

# Self-heal Claude config on every shell start (before Claude opens)
bash /root/.claude/hooks/self-heal-config.sh 2>/dev/null

# Source claude startup if available
if [ -f "$HOME/.bashrc.claude-startup" ]; then
  source "$HOME/.bashrc.claude-startup"
fi
. "/root/.acme.sh/acme.sh.env"
