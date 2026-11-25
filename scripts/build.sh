#!/usr/bin/env bash
# Build the web frontend, sync it into master's embed directory, and build the
# master binary.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
embed_dir="$root/master/internal/webdist/dist"

echo "==> installing web dependencies"
(cd "$root/web" && bun install --frozen-lockfile)

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
# 版本号注入到 main.version，前端页脚与「关于」页都从后端读取它；
# 没有 tag 的本地构建保留 dev，CI 打 tag 时取 GITHUB_REF_NAME。
version="${MYPANEL_VERSION:-${GITHUB_REF_NAME:-}}"
if [ -z "$version" ]; then
    version="$(git -C "$root" describe --tags --abbrev=0 2>/dev/null || true)"
fi
[ -n "$version" ] || version="dev"
echo "==> version: $version"
(cd "$root/master" && go build -ldflags "-X main.version=$version" -o "$root/bin/master" .)

echo "==> built $root/bin/master"
