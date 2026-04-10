#!/bin/bash
# Mount tar.gz directly with ratarmount - direct access without extracting

set -euo pipefail

GDRIVE_URL="https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&export=download&confirm=t"
MOUNT_POINT="/mnt/Igreja"
LOG_FILE="/root/ratarmount.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
success() { echo "[✅] $*" | tee -a "$LOG_FILE"; }
error() { echo "[❌] $*" | tee -a "$LOG_FILE"; exit 1; }

log "🔧 Setting up direct TAR.GZ access with ratarmount"
log "URL: $GDRIVE_URL"
log "Mount point: $MOUNT_POINT"

# Install ratarmount if needed
if ! command -v ratarmount &> /dev/null; then
  log "Installing ratarmount..."
  pip install ratarmount --quiet || error "Failed to install ratarmount"
  success "ratarmount installed"
fi

# Create mount point
log "Creating mount point..."
mkdir -p "$MOUNT_POINT"

# Check if already mounted
if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
  log "Already mounted, unmounting..."
  fusermount -u "$MOUNT_POINT" 2>/dev/null || true
  sleep 1
fi

# Mount with ratarmount
log "Mounting tar.gz with ratarmount..."
log "This may take a minute to index the archive..."

if timeout 300 ratarmount \
  --index-file "/tmp/Igreja.index" \
  --verify-mtime \
  --read-ahead 4 \
  "$GDRIVE_URL" \
  "$MOUNT_POINT" 2>&1 | tee -a "$LOG_FILE"; then

  success "✅ TAR.GZ mounted successfully!"
  log ""
  log "📂 Mounted at: $MOUNT_POINT"
  log "📊 Contents:"
  ls -la "$MOUNT_POINT" | tee -a "$LOG_FILE"
  log ""
  log "📝 Available files:"
  find "$MOUNT_POINT" -maxdepth 2 -type f | head -20 | tee -a "$LOG_FILE"
  log ""
  log "🚀 You can now use the archive as a normal folder:"
  log "   cd $MOUNT_POINT/Igreja"
  log "   npm install --legacy-peer-deps"
  log "   npx tsc --noEmit"
  log ""
  log "❌ To unmount when done: fusermount -u $MOUNT_POINT"

else
  error "Failed to mount tar.gz"
fi
