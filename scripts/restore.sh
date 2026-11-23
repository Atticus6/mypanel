#!/usr/bin/env bash
# 从 scripts/backup.sh 生成的归档恢复数据目录。
#
# 恢复必须在 master 停止后执行，否则正在写入的进程会覆盖恢复结果。
# 脚本只覆盖归档里出现的文件，不删除数据目录中额外的文件。
set -euo pipefail

archive="${1:-}"
if [ -z "$archive" ] || [ ! -f "$archive" ]; then
    echo "用法: MYPANEL_DATA_DIR=<数据目录> $0 <备份归档.tar.gz>" >&2
    exit 1
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_dir="${MYPANEL_DATA_DIR:-$root/data}"
addr="${MYPANEL_ADDR:-127.0.0.1:8080}"

# 探测是否还有服务在跑；curl 缺失时跳过该检查，由调用方自行保证停机。
if command -v curl >/dev/null 2>&1; then
    if curl -fsS --max-time 2 "http://$addr/healthz" >/dev/null 2>&1 && [ "${FORCE:-0}" != "1" ]; then
        echo "master 仍在 $addr 运行，请先停止服务（或设置 FORCE=1 强行恢复）" >&2
        exit 1
    fi
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
tar -xzf "$archive" -C "$tmp"

source_dir="$(find "$tmp" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [ -z "$source_dir" ]; then
    echo "归档格式不正确: $archive" >&2
    exit 1
fi

mkdir -p "$data_dir/1panel/db"
copied=0
while IFS= read -r -d '' file; do
    rel="${file#"$source_dir"/}"
    case "$rel" in
        *.db|config.yaml|config.local.yaml)
            cp "$file" "$data_dir/$rel"
            copied=$((copied + 1))
            ;;
    esac
done < <(find "$source_dir" -type f -print0)

echo "已从 $archive 恢复 $copied 个文件到 $data_dir"
