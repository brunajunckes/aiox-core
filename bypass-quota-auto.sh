#!/bin/bash
# Automatic Google Drive quota bypass with multiple methods

set -euo pipefail

GDRIVE_ID="1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK"
OUTPUT="/root/vps-backup-20260406.tar.gz"
LOG_FILE="/root/bypass-quota.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
success() { echo "[✅] $*" | tee -a "$LOG_FILE"; }
error() { echo "[❌] $*" | tee -a "$LOG_FILE"; }

log "🔓 Google Drive Quota Bypass - Auto Downloader"
log "File ID: $GDRIVE_ID"
log "Output: $OUTPUT"
log ""

# Clean up old broken file
[ -f "$OUTPUT" ] && [ $(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null) -lt 10485760 ] && rm -f "$OUTPUT"

# Method 1: Try gdown (most reliable)
method_gdown() {
  log "=== Method 1: Gdown ==="

  if ! command -v gdown &> /dev/null; then
    log "Installing gdown..."
    pip install gdown --quiet
  fi

  log "Attempting download with gdown..."
  if gdown --id "$GDRIVE_ID" -O "$OUTPUT" --fuzzy 2>&1 | tail -5 | tee -a "$LOG_FILE"; then
    if [ -f "$OUTPUT" ] && [ $(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null) -gt 1048576 ]; then
      success "Gdown download successful!"
      return 0
    fi
  fi
  rm -f "$OUTPUT"
  return 1
}

# Method 2: gdrive-downloader script
method_gdrive_downloader() {
  log ""
  log "=== Method 2: gdrive-downloader ==="

  if [ ! -d /tmp/gdrive-dl ]; then
    log "Cloning gdrive-downloader..."
    git clone https://github.com/Akianonymus/gdrive-downloader.git /tmp/gdrive-dl 2>&1 | tail -3 | tee -a "$LOG_FILE"
  fi

  log "Attempting download with gdrive-downloader..."
  if bash /tmp/gdrive-dl/gdrive-downloader.sh -i "$GDRIVE_ID" -o "$OUTPUT" 2>&1 | tail -20 | tee -a "$LOG_FILE"; then
    if [ -f "$OUTPUT" ] && [ $(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null) -gt 1048576 ]; then
      success "gdrive-downloader successful!"
      return 0
    fi
  fi
  rm -f "$OUTPUT"
  return 1
}

# Method 3: aria2c with retry
method_aria2c() {
  log ""
  log "=== Method 3: aria2c Parallel Download ==="

  if ! command -v aria2c &> /dev/null; then
    log "Installing aria2c..."
    apt-get update -qq && apt-get install -y aria2 -qq
  fi

  log "Attempting parallel download with aria2c..."
  GDRIVE_URL="https://drive.googleapis.com/uc?id=$GDRIVE_ID&export=download&confirm=t"

  if aria2c \
    --max-connection-per-server=8 \
    --split=8 \
    --allow-overwrite=true \
    --continue=true \
    --enable-rpc=false \
    -o "$(basename $OUTPUT)" \
    "$GDRIVE_URL" 2>&1 | tail -20 | tee -a "$LOG_FILE"; then

    if [ -f "$(basename $OUTPUT)" ]; then
      mv "$(basename $OUTPUT)" "$OUTPUT"
      if [ $(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null) -gt 1048576 ]; then
        success "aria2c download successful!"
        return 0
      fi
    fi
  fi
  rm -f "$OUTPUT" "$(basename $OUTPUT)"
  return 1
}

# Method 4: curl with different user-agent and no compression
method_curl_advanced() {
  log ""
  log "=== Method 4: Curl Advanced (No Compression) ==="

  log "Attempting download with curl..."

  GDRIVE_URL="https://drive.usercontent.google.com/download?id=$GDRIVE_ID&export=download&confirm=t"

  if timeout 3600 curl -sL \
    --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
    -H "Accept-Encoding: identity" \
    --compressed \
    --progress-bar \
    --max-time 3600 \
    --retry 5 \
    --retry-delay 10 \
    "$GDRIVE_URL" -o "$OUTPUT" 2>&1 | tail -20 | tee -a "$LOG_FILE"; then

    if [ -f "$OUTPUT" ] && [ $(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null) -gt 1048576 ]; then
      success "Curl advanced download successful!"
      return 0
    fi
  fi
  rm -f "$OUTPUT"
  return 1
}

# Method 5: rclone (if configured)
method_rclone() {
  log ""
  log "=== Method 5: Rclone ==="

  if ! command -v rclone &> /dev/null; then
    log "rclone not found, installing..."
    curl -s https://rclone.org/install.sh | bash
  fi

  log "Attempting download with rclone..."
  if rclone copy "gdrive:$GDRIVE_ID" /root/vps-backup-20260406.tar.gz --progress 2>&1 | tail -20 | tee -a "$LOG_FILE"; then
    if [ -f "$OUTPUT" ] && [ $(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null) -gt 1048576 ]; then
      success "rclone download successful!"
      return 0
    fi
  fi
  return 1
}

# Execute methods in order
log "Starting bypass attempts..."
log ""

for method in method_gdown method_gdrive_downloader method_aria2c method_curl_advanced; do
  if $method; then
    log ""
    SIZE=$(du -h "$OUTPUT" | cut -f1)
    LINES=$(tar -tzf "$OUTPUT" 2>/dev/null | wc -l)
    success "✨ Download completed!"
    success "File size: $SIZE"
    success "Files in archive: $LINES"
    log ""
    log "🚀 Starting Igreja Recovery..."
    bash /root/master-recovery.sh
    exit 0
  fi
done

log ""
error "All methods failed to download"
error "Check log: $LOG_FILE"
error ""
error "Manual options:"
error "1. Download manually from Google Drive"
error "2. Create a copy in your Google Drive (make_a_copy)"
error "3. Use different Google account"
log ""
log "Place valid backup at: $OUTPUT"
log "Then run: bash /root/master-recovery.sh"
exit 1
