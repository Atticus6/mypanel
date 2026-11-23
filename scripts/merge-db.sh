#!/usr/bin/env bash
# 把旧版按模块拆分的 SQLite 数据合并到共享库 mypanel.db。
#
# 升级前先停止 master，备份旧数据目录，再运行本脚本；完成后启动新版本。
# 脚本按表名匹配，只复制目标库里已经存在的表，避免破坏新版 schema。
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
data_dir="${MYPANEL_DATA_DIR:-$root/data}"
db_dir="$data_dir/1panel/db"
target="$db_dir/mypanel.db"

if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "合并旧库需要 sqlite3" >&2
    exit 1
fi
if [ ! -f "$target" ]; then
    echo "共享库不存在: $target；请先启动一次新版本生成库结构" >&2
    exit 1
fi

target_tables="$(sqlite3 "$target" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")"

for name in core agent task alert monitor gpu_monitor; do
    old="$db_dir/$name.db"
    [ -f "$old" ] || continue
    alias="legacy_$name"
    old_tables="$(sqlite3 "$old" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")"

    sql="ATTACH DATABASE '$old' AS $alias;"$'\n'
    copied=0
    while IFS= read -r table; do
        [ -n "$table" ] || continue
        if grep -qxF "$table" <<< "$target_tables" && grep -qxF "$table" <<< "$old_tables"; then
            target_cols="$(sqlite3 "$target" "PRAGMA table_info(\"$table\");" | wc -l | tr -d ' ')"
            old_cols="$(sqlite3 "$old" "PRAGMA table_info(\"$table\");" | wc -l | tr -d ' ')"
            if [ "$target_cols" != "$old_cols" ]; then
                echo "跳过 $name.db/$table：列数不一致（$old_cols vs $target_cols）" >&2
                continue
            fi
            sql+="INSERT OR IGNORE INTO main.\"$table\" SELECT * FROM $alias.\"$table\";"$'\n'
            copied=$((copied + 1))
        fi
    done <<< "$target_tables"
    sql+="DETACH DATABASE $alias;"$'\n'
    printf '%s' "$sql" | sqlite3 "$target"
    echo "$name.db: 合并 $copied 张表"
done

echo "共享库: $target"
