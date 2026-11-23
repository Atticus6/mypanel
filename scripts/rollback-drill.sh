#!/usr/bin/env bash
# 本地回滚演练：真实启动 master → 备份 → 制造变更 → 恢复 → 健康检查 → RPC 冒烟。
#
# 该脚本用临时目录模拟部署环境，不依赖外部主机；生产环境演练时把
# MYPANEL_DATA_DIR / MYPANEL_ADDR 换成目标机参数并复用 backup.sh / restore.sh 即可。
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bin="$root/bin/master"
if [ ! -x "$bin" ]; then
    echo "缺少 $bin，请先执行 ./scripts/build.sh" >&2
    exit 1
fi
for cmd in sqlite3 curl python3; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "演练需要 $cmd" >&2
        exit 1
    fi
done

work="$(mktemp -d)"
data="$work/data"
backups="$work/backups"
log="$work/master.log"
addr="127.0.0.1:$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')"
pid=""
cleanup() {
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        wait "$pid" 2>/dev/null || true
    fi
    rm -rf "$work"
}
trap cleanup EXIT

start_master() {
    MYPANEL_ADDR="$addr" MYPANEL_DATA_DIR="$data" \
        MYPANEL_ADMIN_USER=admin MYPANEL_ADMIN_PASSWORD="$(python3 -c 'import secrets;print(secrets.token_hex(8))')" \
        "$bin" >"$log" 2>&1 &
    pid=$!
    for _ in $(seq 1 50); do
        if curl -fsS --max-time 1 "http://$addr/healthz" >/dev/null 2>&1; then
            return 0
        fi
        sleep 0.2
    done
    echo "master 启动超时，日志: $log" >&2
    cat "$log" >&2
    exit 1
}

stop_master() {
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    pid=""
}

sentinel_count() {
    sqlite3 "$data/1panel/db/mypanel.db" \
        "SELECT COUNT(*) FROM settings WHERE key='RollbackDrillSentinel';" 2>/dev/null || echo 0
}

echo "==> 1. 启动 master 并生成初始数据"
start_master
stop_master

echo "==> 2. 备份数据目录"
archive="$(MYPANEL_DATA_DIR="$data" MYPANEL_BACKUP_DIR="$backups" "$root/scripts/backup.sh")"
echo "备份归档: $archive"

echo "==> 3. 制造变更后再次启动，确认变更可见"
sqlite3 "$data/1panel/db/mypanel.db" \
    "INSERT OR REPLACE INTO settings(key,value,about) VALUES('RollbackDrillSentinel','present','rollback drill');"
if [ "$(sentinel_count)" != "1" ]; then
    echo "标记记录写入失败" >&2
    exit 1
fi
start_master
echo "变更后标记数: $(sentinel_count)"

echo "==> 4. 运行中拒绝恢复"
if MYPANEL_DATA_DIR="$data" MYPANEL_ADDR="$addr" "$root/scripts/restore.sh" "$archive" >/dev/null 2>&1; then
    echo "运行中不应允许恢复" >&2
    exit 1
fi
echo "运行中恢复已正确拒绝"
stop_master

echo "==> 5. 停机后恢复并确认变更消失"
MYPANEL_DATA_DIR="$data" MYPANEL_ADDR="$addr" "$root/scripts/restore.sh" "$archive"
if [ "$(sentinel_count)" != "0" ]; then
    echo "恢复后标记记录仍存在" >&2
    exit 1
fi

echo "==> 6. 恢复后启动、健康检查与 RPC 冒烟"
start_master
MYPANEL_ADDR="$addr" "$root/scripts/healthcheck.sh"
rpc_code="$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' \
    -X POST "http://$addr/rpc/panel.agent.v1.WebsiteService/Search" \
    -H 'Content-Type: application/json' -d '{"page":1,"pageSize":10}')"
if [ "$rpc_code" != "401" ]; then
    echo "RPC 未登录响应 = $rpc_code, 期望 401" >&2
    exit 1
fi
stop_master

echo "回滚演练通过：备份 → 变更 → 拒绝在线恢复 → 停机恢复 → 健康检查 → RPC 冒烟"
