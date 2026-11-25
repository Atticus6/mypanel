#!/usr/bin/env bash
# 安装 mypanel 到本机：拷贝二进制与配置、注册 systemd 服务。
#
# 用法：
#   ./scripts/install.sh                 # 安装（优先用 bin/master，否则本地构建）
#   ./scripts/install.sh --build         # 强制先跑 scripts/build.sh 重新构建
#   ./scripts/install.sh --prefix /usr/local
#   ./scripts/install.sh --data-dir /opt/mypanel/data
#   ./scripts/install.sh --port 8080
#   ./scripts/install.sh --password '...'
#   ./scripts/install.sh --uninstall     # 卸载（保留数据）
#
# 所有 npm/go 相关命令用 bun / go，遵循仓库约定。
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bin_src="$root/bin/master"

PREFIX="/usr/local"
DATA_DIR="/opt/mypanel/data"
UNIT_DIR="/etc/systemd/system"
PORT="8080"
ADMIN_PASSWORD=""
DO_BUILD=0
UNINSTALL=0

log() { printf '\033[32m[install]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[warn]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[31m[error]\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
    sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
    case "$1" in
        --build) DO_BUILD=1; shift ;;
        --prefix) PREFIX="${2:?--prefix 需要参数}"; shift 2 ;;
        --data-dir) DATA_DIR="${2:?--data-dir 需要参数}"; shift 2 ;;
        --unit-dir) UNIT_DIR="${2:?--unit-dir 需要参数}"; shift 2 ;;
        --port) PORT="${2:?--port 需要参数}"; shift 2 ;;
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

do_uninstall() {
    log "停止并禁用服务 $UNIT_NAME"
    systemctl stop "$UNIT_NAME" 2>/dev/null || true
    systemctl disable "$UNIT_NAME" 2>/dev/null || true
    [ -f "$UNIT_PATH" ] && rm -f "$UNIT_PATH" && log "已删除 $UNIT_PATH"
    [ -f "$CTL_PATH" ] && rm -f "$CTL_PATH" && log "已删除 $CTL_PATH"
    [ -f "$BIN_DIR/master" ] && rm -f "$BIN_DIR/master" && log "已删除 $BIN_DIR/master"
    systemctl daemon-reload 2>/dev/null || true
    log "卸载完成（配置 $CONF_DIR 与数据 $DATA_DIR 已保留）"
}

if [ "$UNINSTALL" -eq 1 ]; then
    do_uninstall
    exit 0
fi

if [ "$DO_BUILD" -eq 1 ] || [ ! -x "$bin_src" ]; then
    log "构建 master（scripts/build.sh）"
    bash "$root/scripts/build.sh"
fi
[ -x "$bin_src" ] || die "找不到 $bin_src，请先运行 ./scripts/build.sh"

log "创建目录"
mkdir -p "$BIN_DIR" "$CONF_DIR" "$DATA_DIR"

log "安装二进制到 $BIN_DIR/master"
install -m 755 "$bin_src" "$BIN_DIR/master"

log "安装配置文件到 $CONF_DIR/config.yaml"
if [ -f "$root/config.yaml" ]; then
    install -m 640 "$root/config.yaml" "$CONF_DIR/config.yaml"
else
    cat > "$CONF_DIR/config.yaml" <<EOF
addr: ":$PORT"
data_dir: "$DATA_DIR"
admin_user: "admin"
admin_password: "$ADMIN_PASSWORD"
EOF
fi

# 用本机参数补一层 local 覆盖，避免改动入库的 config.yaml。
cat > "$CONF_DIR/config.local.yaml" <<EOF
addr: ":$PORT"
data_dir: "$DATA_DIR"
admin_user: "admin"
admin_password: "$ADMIN_PASSWORD"
EOF
chmod 600 "$CONF_DIR/config.local.yaml"

log "安装命令行工具到 $CTL_PATH"
install -m 755 "$root/scripts/mypanelctl" "$CTL_PATH"

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
systemctl enable "$UNIT_NAME"
systemctl restart "$UNIT_NAME"

log "安装完成"
echo "  服务状态： systemctl status $UNIT_NAME"
echo "  命令行：    mypanelctl status   （mypanelctl --help 查看全部）"
echo "  访问地址： http://<本机IP>:$PORT"
if [ -z "$ADMIN_PASSWORD" ] && grep -q '随机密码' "$CONF_DIR/config.local.yaml" 2>/dev/null; then
    warn "管理员密码为随机生成，请查看 journalctl -u $UNIT_NAME 启动日志"
fi
