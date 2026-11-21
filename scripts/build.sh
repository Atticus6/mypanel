#!/usr/bin/env bash
# Build the web frontend, sync it into master's embed directory, and build the
# master binary.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
embed_dir="$root/master/internal/webdist/dist"

echo "==> building web"
(cd "$root/web" && bun --bun run build)

echo "==> syncing web/dist -> master/internal/webdist/dist"
rm -rf "$embed_dir"
mkdir -p "$embed_dir"
# -a keeps permissions; the trailing /. copies directory contents, not the dir.
cp -a "$root/web/dist/." "$embed_dir/"
# The placeholder keeps the go:embed directive valid on a clean checkout.
: > "$embed_dir/.gitkeep"

echo "==> building master"
mkdir -p "$root/bin"
(cd "$root/master" && go build -o "$root/bin/master" .)

echo "==> built $root/bin/master"
