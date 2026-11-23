#!/usr/bin/env bash
# RPC 覆盖率门禁：防止新增接口漏掉策略注解、漏注册 handler，或让 proto 与注册表漂移。
#
# 当前阶段还没有把 1Panel 的全部 REST 路由与 proto 做逐条比对（那需要
# 路由清单生成器）；这里先守住三条不会再退化的底线：
#   1. buf lint（含 COMMENT_* 规则）通过；
#   2. 每个 rpc 都有 panel.common.v1.policy 注解；
#   3. 每个 proto service 都注册了 handler，且方法策略齐全。
#
# 用法：./scripts/check-rpc-coverage.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> buf lint"
(cd "$root/proto" && buf lint)

echo "==> 检查每个 rpc 是否有策略注解"
python3 - "$root/proto" <<'PY'
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
missing = []
total = 0
for path in sorted(root.glob("panel/*/v1/*.proto")):
    text = path.read_text()
    # 按 service 块之外逐个 rpc 检查：rpc 声明到下一个 "}" 之间必须有 policy。
    chunks = text.split("  rpc ")
    for chunk in chunks[1:]:
        total += 1
        body = chunk.split("\n  }\n", 1)[0]
        if "panel.common.v1.policy" not in body:
            missing.append(f"{path.name}: rpc {chunk.split('(', 1)[0].strip()}")
if missing:
    print("以下 rpc 缺少策略注解：")
    for item in missing:
        print("  " + item)
    sys.exit(1)
print(f"rpc 方法数: {total}")
PY

echo "==> 检查 HTTP 例外白名单"
allowed="/rpc/ /healthz /ws/terminal /files/upload /files/download /assets/ /api/v2/static/ /api/v2/images/ /api/v2/apps/icon/ /mcp /api/v2/core/auth/oidc/ /api/v2/core/auth/saml2/"
echo "允许的 HTTP 例外: $allowed"
if grep -nE 'r\.(GET|POST|PUT|DELETE|Any)\("/api/v2/(core/(auth|settings|users)|hosts|websites|apps|containers|databases|cronjobs|files)' \
    "$root/master/internal/server/server.go"; then
    echo "server.go 注册了业务 REST 路由，请改为 Connect 服务" >&2
    exit 1
fi

echo "==> 检查注册表与策略完整性"
(cd "$root" && go test ./master/internal/transport/ -run 'TestEveryRegisteredMethodHasPolicy|TestEveryDescriptorIsRegistered|TestServiceNamesAreUnique' -count=1)

echo "==> 基线路由覆盖率"
(cd "$root" && go run ./master/cmd/rpc-coverage -baseline "${1:-../1Panel}" -proto proto -manifest proto/manifest.yaml -snapshot proto/route-coverage.json)

echo "==> RPC 覆盖率门禁通过"
