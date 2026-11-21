#!/usr/bin/env bash
# Regenerate Go and TypeScript protobuf/Connect code from proto/.
#
# Plugins are installed into ./.bin at pinned versions so the result does not
# depend on whatever happens to be on the caller's PATH.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bin="$root/.bin"

PROTOC_GEN_GO_VERSION="v1.36.12"
PROTOC_GEN_CONNECT_GO_VERSION="v1.21.1"
PROTOC_GEN_ES_VERSION="2.17.0"

mkdir -p "$bin"

install_go_plugin() {
  local pkg="$1" name="$2" version="$3"
  if [ ! -x "$bin/$name" ]; then
    echo "==> installing $name@$version"
    GOBIN="$bin" go install "$pkg@$version"
  fi
}

install_go_plugin google.golang.org/protobuf/cmd/protoc-gen-go \
  protoc-gen-go "$PROTOC_GEN_GO_VERSION"
install_go_plugin connectrpc.com/connect/cmd/protoc-gen-connect-go \
  protoc-gen-connect-go "$PROTOC_GEN_CONNECT_GO_VERSION"

# protoc-gen-es comes from the web project's node_modules.
if [ ! -x "$root/web/node_modules/.bin/protoc-gen-es" ]; then
  echo "==> installing web dependencies (provides protoc-gen-es)"
  (cd "$root/web" && bun install)
fi

export PATH="$bin:$root/web/node_modules/.bin:$PATH"

if ! command -v buf >/dev/null 2>&1; then
  echo "error: buf not found. install with: go install github.com/bufbuild/buf/cmd/buf@latest" >&2
  exit 1
fi

echo "==> buf generate"
cd "$root/proto"
buf generate

echo "==> generated:"
find "$root/proto/gen" "$root/web/src/gen" -type f 2>/dev/null | sed "s|^$root/|  |" | sort
