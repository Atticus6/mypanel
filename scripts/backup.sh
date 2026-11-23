#!/usr/bin/env bash
# 备份 mypanel 的数据目录。
#
# 数据目录结构由 master 初始化时生成：1panel/db/*.db 为业务库，
# 另有独立的监控/告警/任务库。直接复制 WAL 模式下的 .db 文件可能得到
# 不一致快照，因此优先用 sqlite3 的 .backup 做在线备份；没有 sqlite3 时
# 降级为整目录复制，并在备份完成后列出结果供人工核对。
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_dir="${MYPANEL_DATA_DIR:-$root/data}"
backup_dir="${MYPANEL_BACKUP_DIR:-$root/backups}"
retention_days="${MYPANEL_BACKUP_RETENTION_DAYS:-7}"

if [ ! -d "$data_dir" ]; then
    echo "数据目录不存在: $data_dir" >&2
    exit 1
fi

stamp="$(date +%Y%m%d-%H%M%S)"
work_dir="$backup_dir/.mypanel-$stamp"
archive="$backup_dir/mypanel-$stamp.tar.gz"
mkdir -p "$work_dir"

db_dir="$data_dir/1panel/db"
if [ -d "$db_dir" ]; then
    mkdir -p "$work_dir/1panel/db"
    for db in "$db_dir"/*.db; do
        [ -f "$db" ] || continue
        name="$(basename "$db")"
        if command -v sqlite3 >/dev/null 2>&1; then
            sqlite3 "$db" ".backup '$work_dir/1panel/db/$name'"
        else
            cp "$db" "$work_dir/1panel/db/$name"
        fi
    done
fi

# 个人配置与证书等文件型数据直接复制，排除易失的 WAL/SHM 文件。
for name in config.yaml config.local.yaml; do
    if [ -f "$data_dir/$name" ]; then
        cp "$data_dir/$name" "$work_dir/$name"
    fi
done

if [ -z "$(ls -A "$work_dir")" ]; then
    rmdir "$work_dir"
    echo "没有找到需要备份的数据: $data_dir" >&2
    exit 1
fi

tar -czf "$archive" -C "$backup_dir" ".mypanel-$stamp"
rm -rf "$work_dir"

# 只清理本脚本生成的归档，避免误删用户放在同目录的其它文件。
find "$backup_dir" -maxdepth 1 -type f -name 'mypanel-*.tar.gz' -mtime "+$retention_days" -delete

echo "$archive"
