#!/usr/bin/env bash
# 重新生成 wire 依赖注入代码。
#
# 改完 master/internal/app/app.go 的 ProviderSet 或 wire.go 的注入点签名后执行。
# wire 工具装进 ./.bin（已 gitignore）并固定版本，避免受全局 GOBIN 影响。
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bin="$root/.bin"

WIRE_VERSION="v0.7.0"

mkdir -p "$bin"

if [ ! -x "$bin/wire" ]; then
  echo "==> installing wire@$WIRE_VERSION"
  GOBIN="$bin" go install "github.com/google/wire/cmd/wire@$WIRE_VERSION"
fi

echo "==> wire generate"
cd "$root/master"
"$bin/wire" ./internal/app

echo "==> generated:"
ls -1 "$root/master/internal/app/wire_gen.go"
