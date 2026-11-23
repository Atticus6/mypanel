#!/usr/bin/env bash
# 部署侧健康检查：同时探测进程的 /healthz 与 RPC 健康接口。
#
# 失败时可通过 ALERT_WEBHOOK_URL 发送一条 JSON 通知（可选），
# 未配置时只在 stderr 输出错误并以非零码退出，便于 systemd/cron 直接接入。
set -euo pipefail

addr="${MYPANEL_ADDR:-127.0.0.1:8080}"
base="http://$addr"
webhook="${ALERT_WEBHOOK_URL:-}"
message=""

check() {
    local label="$1" url="$2"
    if ! curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
        message="${message}${label} 检查失败; "
    fi
}

check "healthz" "$base/healthz"
# Connect unary RPC：未登录会返回 401，只要不是连接失败即视为服务可用。
rpc_code="$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' \
    -X POST "$base/rpc/panel.agent.v1.HealthService/Check" \
    -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo 000)"
if [ "$rpc_code" = "000" ]; then
    message="${message}RPC 健康检查无响应; "
fi

if [ -n "$message" ]; then
    echo "${message}目标: $addr" >&2
    if [ -n "$webhook" ] && command -v curl >/dev/null 2>&1; then
        payload="$(printf '{"text":"mypanel healthcheck failed: %s target=%s"}' "$message" "$addr")"
        curl -fsS --max-time 5 -X POST -H 'Content-Type: application/json' \
            -d "$payload" "$webhook" >/dev/null 2>&1 || true
    fi
    exit 1
fi

echo "ok: $addr"
