#!/usr/bin/env bash
# 安装 mypanel 到本机：拷贝二进制与配置、注册 systemd 服务。
#
# 未显式指定时，端口 / 管理员账号 / 密码 / 数据目录路径都会随机生成，
# 并写入安装信息文件，之后可用 mypanelctl info 再次查看。
#
# 用法：
#   sudo ./scripts/install.sh                    # 全部随机
#   sudo ./scripts/install.sh --port 8080        # 指定端口，其余随机
#   sudo ./scripts/install.sh --user admin --password '...' --data-dir /opt/mypanel/data
#   sudo ./scripts/install.sh --build            # 先从源码重新构建
#   sudo ./scripts/install.sh --prefix /usr/local --unit-dir /etc/systemd/system
#   sudo ./scripts/install.sh --uninstall        # 卸载（保留配置与数据）
#
# 所有 npm/go 相关命令用 bun / go，遵循仓库约定。
set -euo pipefail

# 既支持在仓库 scripts/ 目录下运行，也支持在打包产物里运行。
self_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$self_dir/.." && pwd)"

if [ -x "$self_dir/master" ]; then
    bin_src="$self_dir/master"
    conf_src="$self_dir/config.yaml"
    ctl_src="$self_dir/mypanelctl"
    build_script=""
elif [ -x "$repo_root/bin/master" ]; then
    bin_src="$repo_root/bin/master"
    conf_src="$repo_root/config.yaml"
    ctl_src="$repo_root/scripts/mypanelctl"
    build_script="$repo_root/scripts/build.sh"
else
    bin_src=""
    conf_src="$repo_root/config.yaml"
    ctl_src="$repo_root/scripts/mypanelctl"
    build_script="$repo_root/scripts/build.sh"
fi

PREFIX="/usr/local"
UNIT_DIR="/etc/systemd/system"
PORT=""
ADMIN_USER=""
ADMIN_PASSWORD=""
DATA_DIR=""
DO_BUILD=0
UNINSTALL=0

log() { printf '\033[32m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[warn]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

usage() { sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
    case "$1" in
        --build) DO_BUILD=1; shift ;;
        --prefix) PREFIX="${2:?--prefix 需要参数}"; shift 2 ;;
        --data-dir) DATA_DIR="${2:?--data-dir 需要参数}"; shift 2 ;;
        --unit-dir) UNIT_DIR="${2:?--unit-dir 需要参数}"; shift 2 ;;
        --port) PORT="${2:?--port 需要参数}"; shift 2 ;;
        --user) ADMIN_USER="${2:?--user 需要参数}"; shift 2 ;;
        --password) ADMIN_PASSWORD="${2:?--password 需要参数}"; shift 2 ;;
        --uninstall) UNINSTALL=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) die "未知参数：$1（--help 查看用法）" ;;
    esac
done

[ "$(id -u)" -eq 0 ] || die "请用 root 运行（sudo $0）"

BIN_DIR="$PREFIX/bin"
CONF_DIR="$PREFIX/etc/mypanel"
UNIT_NAME="mypanel.service"
UNIT_PATH="$UNIT_DIR/$UNIT_NAME"
CTL_PATH="$BIN_DIR/mypanelctl"
INFO_FILE="$CONF_DIR/install-info"

# 生成随机字符串：字母数字，避免特殊字符引发配置转义问题。
rand_str() { openssl rand -base64 18 2>/dev/null | tr -dc 'A-Za-z0-9' | head -c "$1"; }

# 选一个未被占用的随机端口（20000-60000）。
pick_port() {
    local p i
    for i in $(seq 1 50); do
        p=$((20000 + RANDOM % 40000))
        if command -v ss >/dev/null 2>&1; then
            ss -tln 2>/dev/null | grep -q ":${p} " && continue
        fi
        echo "$p"
        return 0
    done
    die "无法挑选空闲端口"
}

do_uninstall() {
    log "停止并禁用服务 $UNIT_NAME"
    systemctl stop "$UNIT_NAME" 2>/dev/null || true
    systemctl disable "$UNIT_NAME" 2>/dev/null || true
    [ -f "$UNIT_PATH" ] && rm -f "$UNIT_PATH" && log "已删除 $UNIT_PATH"
    [ -f "$CTL_PATH" ] && rm -f "$CTL_PATH" && log "已删除 $CTL_PATH"
    [ -f "$BIN_DIR/master" ] && rm -f "$BIN_DIR/master" && log "已删除 $BIN_DIR/master"
    systemctl daemon-reload 2>/dev/null || true
    log "卸载完成（配置 $CONF_DIR 与数据目录已保留）"
}

if [ "$UNINSTALL" -eq 1 ]; then
    do_uninstall
    exit 0
fi

if [ "$DO_BUILD" -eq 1 ] || [ ! -x "$bin_src" ]; then
    [ -n "$build_script" ] || die "打包产物里没有源码，不能使用 --build；请直接使用随包提供的 master"
    log "构建 master（scripts/build.sh）"
    bash "$build_script"
fi
[ -x "$bin_src" ] || die "找不到 master，请先运行 ./scripts/build.sh"

# 未指定的参数全部随机生成。
[ -n "$PORT" ] || PORT="$(pick_port)"
[ -n "$ADMIN_USER" ] || ADMIN_USER="admin$(rand_str 4)"
[ -n "$ADMIN_PASSWORD" ] || ADMIN_PASSWORD="$(rand_str 16)"
[ -n "$DATA_DIR" ] || DATA_DIR="/opt/mypanel-$(rand_str 6)/data"

log "创建目录"
mkdir -p "$BIN_DIR" "$CONF_DIR" "$DATA_DIR"

log "安装二进制到 $BIN_DIR/master"
install -m 755 "$bin_src" "$BIN_DIR/master"

# 主配置只保留原样；本机参数全部写进 local 覆盖，便于用 mypanelctl 查看。
if [ -f "$conf_src" ]; then
    install -m 640 "$conf_src" "$CONF_DIR/config.yaml"
else
    cat > "$CONF_DIR/config.yaml" <<EOF
addr: ":$PORT"
data_dir: "$DATA_DIR"
EOF
fi

cat > "$CONF_DIR/config.local.yaml" <<EOF
addr: ":$PORT"
data_dir: "$DATA_DIR"
admin_user: "$ADMIN_USER"
admin_password: "$ADMIN_PASSWORD"
EOF
chmod 600 "$CONF_DIR/config.local.yaml"

log "安装命令行工具到 $CTL_PATH"
install -m 755 "$ctl_src" "$CTL_PATH"

log "安装 systemd 单元 $UNIT_PATH"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_PATH" <<EOF
[Unit]
Description=mypanel - single-process 1Panel control panel
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
User=root
Environment=MYPANEL_ADDR=:$PORT
Environment=MYPANEL_DATA_DIR=$DATA_DIR
ExecStart=$BIN_DIR/master -config $CONF_DIR/config.yaml
Restart=on-failure
RestartSec=5s
LimitNOFILE=1048576
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
chmod 644 "$UNIT_PATH"

systemctl daemon-reload
systemctl enable "$UNIT_NAME" >/dev/null 2>&1 || true
systemctl restart "$UNIT_NAME"

wait_for_port() {
    local i
    for i in $(seq 1 30); do
        if command -v ss >/dev/null 2>&1 && ss -tln 2>/dev/null | grep -q ":$PORT "; then
            return 0
        fi
        if command -v curl >/dev/null 2>&1 && curl -fsS --max-time 1 "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    return 1
}
wait_for_port || warn "服务尚未监听 :$PORT，请用 mypanelctl status 检查"

local_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -n "$local_ip" ] || local_ip="$(ip -4 addr show scope global 2>/dev/null | awk -F'[ /]+' '/inet /{print $3; exit}')"
[ -n "$local_ip" ] || local_ip="<本机IP>"

# 写入安装信息，mypanelctl info 从这里读取。
cat > "$INFO_FILE" <<EOF
address=http://$local_ip:$PORT
port=$PORT
user=$ADMIN_USER
password=$ADMIN_PASSWORD
data_dir=$DATA_DIR
entrance=未设置（可在面板「设置 - 安全」中启用）
EOF
chmod 600 "$INFO_FILE"

echo
echo "========== 安装完成 =========="
printf '  %-14s %s\n' '访问地址：' "http://$local_ip:$PORT"
printf '  %-14s %s\n' '账号：' "$ADMIN_USER"
printf '  %-14s %s\n' '密码：' "$ADMIN_PASSWORD"
printf '  %-14s %s\n' '数据目录：' "$DATA_DIR"
printf '  %-14s %s\n' '安全入口：' "未设置（可在面板「设置 - 安全」中启用）"
echo "  --------------------------------"
echo "  再次查看： mypanelctl info"
echo "  服务状态： mypanelctl status"
echo "================================"
echo
