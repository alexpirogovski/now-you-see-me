#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Usage: bash scripts/package.sh <version>}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist"
STAGING_DIR="$DIST_DIR/package"
ARCHIVE_PATH="$DIST_DIR/now-you-see-me-$VERSION.zip"

cd "$PROJECT_DIR"

python3 -m json.tool manifest.json >/dev/null

if command -v node >/dev/null 2>&1; then
  node --check content.js
  node --check options.js
else
  echo "Node is unavailable; skipping JavaScript syntax checks." >&2
fi

rm -rf "$STAGING_DIR"
rm -f "$ARCHIVE_PATH"
mkdir -p "$STAGING_DIR/assets"

cp manifest.json content.js styles.css options.html options.js options.css "$STAGING_DIR/"
cp -R assets/. "$STAGING_DIR/assets/"

(cd "$STAGING_DIR" && zip -qr "$ARCHIVE_PATH" .)

echo "Created $ARCHIVE_PATH"
