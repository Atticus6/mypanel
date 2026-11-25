#!/usr/bin/env bash
# Install mypanel on this host: copy binary/config, register a systemd service.
# Supports Chinese / English; language is selected at the start and stored for mypanelctl.
set -euo pipefail

self_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$self_dir/.." && pwd)"

if [ -x "$self_dir/master" ]; then
    bin_src="$self_dir/master"
    conf_src="$self_dir/config.yaml"
    ctl_src="$self_dir/mypanelctl"
    i18n_src="$self_dir/lib/i18n.sh"
    build_script=""
elif [ -x "$repo_root/bin/master" ]; then
    bin_src="$repo_root/bin/master"
    conf_src="$repo_root/config.yaml"
    ctl_src="$repo_root/scripts/mypanelctl"
    i18n_src="$repo_root/scripts/lib/i18n.sh"
    build_script="$repo_root/scripts/build.sh"
else
    bin_src=""
    conf_src="$repo_root/config.yaml"
    ctl_src="$repo_root/scripts/mypanelctl"
    i18n_src="$repo_root/scripts/lib/i18n.sh"
    build_script="$repo_root/scripts/build.sh"
fi

# shellcheck disable=SC1090
[ -f "$i18n_src" ] && source "$i18n_src" || {
    printf 'i18n library not found: %s\n' "$i18n_src" >&2
    exit 1
}

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

usage() {
    cat <<'EOF'
Usage:
  sudo ./install.sh                          # randomize port/user/password/data dir
  sudo ./install.sh --lang zh                # choose language (zh|en)
  sudo ./install.sh --port 8080              # specify port; others randomized
  sudo ./install.sh --user admin --password '...' --data-dir /opt/mypanel/data
  sudo ./install.sh --build                  # rebuild from source first
  sudo ./install.sh --prefix /usr/local --unit-dir /etc/systemd/system
  sudo ./install.sh --uninstall              # uninstall (keep config and data)
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --build) DO_BUILD=1; shift ;;
        --prefix) PREFIX="${2:?$(t need_arg --prefix)}"; shift 2 ;;
        --data-dir) DATA_DIR="${2:?$(t need_arg --data-dir)}"; shift 2 ;;
        --unit-dir) UNIT_DIR="${2:?$(t need_arg --unit-dir)}"; shift 2 ;;
        --port) PORT="${2:?$(t need_arg --port)}"; shift 2 ;;
        --user) ADMIN_USER="${2:?$(t need_arg --user)}"; shift 2 ;;
        --password) ADMIN_PASSWORD="${2:?$(t need_arg --password)}"; shift 2 ;;
        --lang) set_lang "$2"; shift 2 ;;
        --uninstall) UNINSTALL=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) die "$(t unknown_arg "$1")" ;;
    esac
done

# Interactive language selection happens before any work.
select_lang

BIN_DIR="$PREFIX/bin"
CONF_DIR="$PREFIX/etc/mypanel"
MYPANEL_CONF_DIR="$CONF_DIR"
UNIT_NAME="mypanel.service"
UNIT_PATH="$UNIT_DIR/$UNIT_NAME"
CTL_PATH="$BIN_DIR/mypanelctl"
INFO_FILE="$CONF_DIR/install-info"

do_uninstall() {
    log "$(t uninstall_stop "$UNIT_NAME")"
    systemctl stop "$UNIT_NAME" 2>/dev/null || true
    systemctl disable "$UNIT_NAME" 2>/dev/null || true
    [ -f "$UNIT_PATH" ] && rm -f "$UNIT_PATH" && log "$(t uninstall_removed "$UNIT_PATH")"
    [ -f "$CTL_PATH" ] && rm -f "$CTL_PATH" && log "$(t uninstall_removed "$CTL_PATH")"
    [ -f "$BIN_DIR/master" ] && rm -f "$BIN_DIR/master" && log "$(t uninstall_removed "$BIN_DIR/master")"
    systemctl daemon-reload 2>/dev/null || true
    log "$(t uninstall_done)"
}

[ "$(id -u)" -eq 0 ] || die "$(t root_required "$0")"

if [ "$UNINSTALL" -eq 1 ]; then
    do_uninstall
    exit 0
fi

if [ "$DO_BUILD" -eq 1 ] || [ ! -x "$bin_src" ]; then
    [ -n "$build_script" ] || die "$(t no_source_build)"
    log "$(t building)"
    bash "$build_script"
fi
[ -x "$bin_src" ] || die "$(t master_not_found)"

# Randomize unspecified values.
rand_str() { openssl rand -base64 18 2>/dev/null | tr -dc 'A-Za-z0-9' | head -c "$1"; }
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
    die "$(t no_port)"
}
[ -n "$PORT" ] || PORT="$(pick_port)"
[ -n "$ADMIN_USER" ] || ADMIN_USER="admin$(rand_str 4)"
[ -n "$ADMIN_PASSWORD" ] || ADMIN_PASSWORD="$(rand_str 16)"
[ -n "$DATA_DIR" ] || DATA_DIR="/opt/mypanel-$(rand_str 6)/data"
ENTRANCE="$(rand_str 10)"

mkdir -p "$BIN_DIR" "$CONF_DIR" "$DATA_DIR"
log "$(t creating_dirs)"

log "$(t installing_bin "$BIN_DIR/master")"
install -m 755 "$bin_src" "$BIN_DIR/master"

log "$(t installing_conf "$CONF_DIR/config.yaml")"
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

log "$(t installing_ctl "$CTL_PATH")"
install -m 755 "$ctl_src" "$CTL_PATH"
# Bundle i18n lib next to config so mypanelctl can use it.
mkdir -p "$CONF_DIR/lib"
install -m 644 "$i18n_src" "$CONF_DIR/lib/i18n.sh"

log "$(t installing_unit "$UNIT_PATH")"
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

save_lang

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
wait_for_port || warn "$(t service_not_listen "$PORT")"

"$BIN_DIR/master" -config "$CONF_DIR/config.yaml" -ctl-action entrance -ctl-value "$ENTRANCE" >/dev/null 2>&1 || \
    warn "$(t set_entrance_fail)"
systemctl restart "$UNIT_NAME"

local_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -n "$local_ip" ] || local_ip="$(ip -4 addr show scope global 2>/dev/null | awk -F'[ /]+' '/inet /{print $3; exit}')"
[ -n "$local_ip" ] || local_ip="<IP>"

cat > "$INFO_FILE" <<EOF
address=http://$local_ip:$PORT/$ENTRANCE
port=$PORT
user=$ADMIN_USER
data_dir=$DATA_DIR
entrance=$ENTRANCE
EOF
chmod 600 "$INFO_FILE"

echo
echo "========== $(t install_done) =========="
printf '  %-12s %s\n' "$(t visit_addr)" "http://$local_ip:$PORT/$ENTRANCE"
printf '  %-12s %s\n' "$(t account)" "$ADMIN_USER"
printf '  %-12s %s\n' "$(t data_dir)" "$DATA_DIR"
printf '  %-12s %s\n' "$(t entrance)" "/$ENTRANCE"
echo "  --------------------------------"
echo "  $(t view_again)"
echo "  $(t service_status)"
echo "================================"
echo
