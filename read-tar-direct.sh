#!/bin/bash
# Read files directly from tar.gz via HTTP streaming - no download, no extraction

set -euo pipefail

GDRIVE_URL="https://drive.usercontent.google.com/download?id=1EsEYrE8Oq8dtuUQ7m_TwBv0w-Fn_r1BK&export=download&confirm=t"

echo "╔════════════════════════════════════════════════════╗"
echo "║  Direct TAR.GZ Stream Reading (No Extraction)    ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# List all files in archive
echo "📋 LISTING ARCHIVE CONTENTS..."
echo "This may take a minute..."
echo ""

echo "=== Top-level directories ==="
curl -sL "$GDRIVE_URL" 2>/dev/null | tar -tzf - 2>/dev/null | \
  cut -d'/' -f1 | sort -u | head -20

echo ""
echo "=== Igreja project files ==="
curl -sL "$GDRIVE_URL" 2>/dev/null | tar -tzf - 2>/dev/null | \
  grep -i "Igreja" | head -30

echo ""
echo "=== File count ==="
FILE_COUNT=$(curl -sL "$GDRIVE_URL" 2>/dev/null | tar -tzf - 2>/dev/null | wc -l)
echo "Total files: $FILE_COUNT"

echo ""
echo "📖 READING SPECIFIC FILES..."
echo ""

# Function to read file from tar
read_tar_file() {
  local file="$1"
  echo "=== $file ==="
  curl -sL "$GDRIVE_URL" 2>/dev/null | \
  tar -xzOf - "$file" 2>/dev/null || echo "[File not found or error reading]"
  echo ""
}

# Read important files if they exist
echo "Attempting to read key files..."
echo ""

# Try variations of paths
for path in "Igreja/package.json" "package.json" "Igreja/tsconfig.json" "tsconfig.json"; do
  echo "Trying: $path..."
  if curl -sL "$GDRIVE_URL" 2>/dev/null | tar -tzf - 2>/dev/null | grep -q "^$path$"; then
    read_tar_file "$path" | head -30
    break
  fi
done

echo ""
echo "💡 USAGE:"
echo ""
echo "Read specific file:"
echo '  curl -sL "$URL" | tar -xzOf - Igreja/package.json'
echo ""
echo "Extract specific file to disk:"
echo '  curl -sL "$URL" | tar -xzOf - Igreja/package.json > /tmp/package.json'
echo ""
echo "Search for files:"
echo '  curl -sL "$URL" | tar -tzf - | grep package.json'
echo ""
echo "Extract multiple files:"
echo '  curl -sL "$URL" | tar -xzf - Igreja/package.json Igreja/tsconfig.json Igreja/README.md'
