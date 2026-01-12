#!/bin/bash
set -e

echo "Installing dependencies..."
pnpm install --ignore-scripts=false

echo "Installing ffmpeg binary..."
FFMPEG_DIR=$(find node_modules/.pnpm -name "ffmpeg-static@*" -type d | head -n 1)
if [ -n "$FFMPEG_DIR" ]; then
  cd "$FFMPEG_DIR/node_modules/ffmpeg-static"
  node install.js
  echo "✅ FFmpeg installed successfully"
else
  echo "⚠️  Warning: ffmpeg-static directory not found, trying alternative method..."
  cd node_modules/ffmpeg-static 2>/dev/null && node install.js || echo "❌ Could not install ffmpeg"
fi
