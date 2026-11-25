#!/usr/bin/env bash
# mypanel 脚本国际化：中文 / English。
#
# 用法：source 本文件后调用 t <key> [参数...]，用 load_lang 读取已保存语言。
# 安装时语言写入 $MYPANEL_CONF_DIR/lang；mypanelctl 启动时读取它。

MYPANEL_LANG="${MYPANEL_LANG:-}"
MYPANEL_CONF_DIR="${MYPANEL_CONF_DIR:-/usr/local/etc/mypanel}"

# 设置语言（zh / en）。
set_lang() {
    case "$1" in
        zh|zh_CN|zh-CN) MYPANEL_LANG="zh" ;;
        en|en_US|en-US) MYPANEL_LANG="en" ;;
        *) MYPANEL_LANG="en" ;;
    esac
}

# 从配置文件读取语言；读不到时按系统 LANG 猜测。
load_lang() {
    if [ -f "$MYPANEL_CONF_DIR/lang" ]; then
        MYPANEL_LANG="$(head -1 "$MYPANEL_CONF_DIR/lang" | tr -d '[:space:]')"
    fi
    if [ -z "$MYPANEL_LANG" ]; then
        case "${LANG:-}" in
            zh*) MYPANEL_LANG="zh" ;;
            *)   MYPANEL_LANG="en" ;;
        esac
    fi
}

save_lang() {
    mkdir -p "$MYPANEL_CONF_DIR" 2>/dev/null || true
    printf '%s\n' "$MYPANEL_LANG" > "$MYPANEL_CONF_DIR/lang" 2>/dev/null || true
}

# 交互式选择语言；非交互（无 TTY）时用系统默认。
select_lang() {
    if [ -n "$MYPANEL_LANG" ]; then
        return
    fi
    if [ -t 0 ]; then
        printf 'Select language / 选择语言 [1] English  [2] 中文 (默认 1): '
        read -r answer || answer=""
        case "$answer" in
            2|zh|ZH) MYPANEL_LANG="zh" ;;
            *)       MYPANEL_LANG="en" ;;
        esac
    else
        load_lang
    fi
}

# 翻译：t <key> [args...]
t() {
    local key="$1"; shift
    if [ "$MYPANEL_LANG" = "zh" ]; then
        case "$key" in
            select_lang_prompt) printf '选择语言 [1] 中文  [2] English （默认 1）: ' ;;
            install_start) printf '安装 mypanel ...' ;;
            install_done) printf '安装完成' ;;
            visit_addr) printf '访问地址：' ;;
            account) printf '账号：' ;;
            password) printf '密码：' ;;
            data_dir) printf '数据目录：' ;;
            entrance) printf '安全入口：' ;;
            not_set) printf '未设置' ;;
            view_again) printf '再次查看： mypanelctl info（密码请用 mypanelctl update password 重设）' ;;
            service_status) printf '服务状态： mypanelctl status' ;;
            root_required) printf '请用 root 运行（sudo %s）' "$1" ;;
            unknown_arg) printf '未知参数：%s（--help 查看用法）' "$1" ;;
            need_arg) printf '%s 需要参数' "$1" ;;
            creating_dirs) printf '创建目录' ;;
            installing_bin) printf '安装二进制到 %s' "$1" ;;
            installing_conf) printf '安装配置文件到 %s' "$1" ;;
            installing_ctl) printf '安装命令行工具到 %s' "$1" ;;
            installing_unit) printf '安装 systemd 单元 %s' "$1" ;;
            building) printf '构建 master（scripts/build.sh）' ;;
            no_source_build) printf '打包产物里没有源码，不能使用 --build；请直接使用随包提供的 master' ;;
            master_not_found) printf '找不到 master，请先运行 ./scripts/build.sh' ;;
            no_port) printf '无法挑选空闲端口' ;;
            service_not_listen) printf '服务尚未监听 :%s，请用 mypanelctl status 检查' "$1" ;;
            set_entrance_fail) printf '设置安全入口失败，可用 mypanelctl update entrance 重设' ;;
            uninstall_stop) printf '停止并禁用服务 %s' "$1" ;;
            uninstall_removed) printf '已删除 %s' "$1" ;;
            uninstall_done) printf '卸载完成（配置与数据已保留）' ;;
            info_title) printf 'mypanel 安装信息' ;;
            info_no_file) printf '安装信息文件不存在，仅显示配置中的可用项' ;;
            port) printf '端口：' ;;
            no_password_shown) printf '密码不会显示；重设： sudo mypanelctl update password <新密码>' ;;
            service_running) printf '服务运行中' ;;
            service_stopped) printf '服务未运行' ;;
            listen_addr) printf '监听地址：' ;;
            version) printf '版本：' ;;
            ctl_unknown) printf '未知命令：%s（mypanelctl help 查看用法）' "$1" ;;
            ctl_root_required) printf '此操作需要 root（sudo mypanelctl %s）' "$1" ;;
            ctl_no_master) printf '未找到 %s' "$1" ;;
            ctl_no_conf) printf '配置文件不存在：%s' "$1" ;;
            ctl_restarted) printf '服务已重启，变更已生效' ;;
            ctl_started) printf '已启动' ;;
            ctl_stopped) printf '已停止' ;;
            ctl_enabled) printf '已设为开机自启' ;;
            ctl_disabled) printf '已取消开机自启' ;;
            ctl_pwd_set) printf '管理员密码已重设' ;;
            ctl_pwd_usage) printf '用法：mypanelctl update password <新密码>' ;;
            ctl_pwd_space) printf '密码不能包含空格' ;;
            ctl_pwd_fail) printf '更新密码失败，请检查服务日志' ;;
            ctl_port_usage) printf '用法：mypanelctl update port <新端口>' ;;
            ctl_port_num) printf '端口必须是数字' ;;
            ctl_port_set) printf '端口已设为 %s' "$1" ;;
            ctl_ip_usage) printf '用法：mypanelctl update listen-ip <地址>' ;;
            ctl_ip_set) printf '监听地址已设为 %s' "$1" ;;
            ctl_entrance_usage) printf '用法：mypanelctl update entrance <入口>（传空字符串关闭）' ;;
            ctl_entrance_set) printf '安全入口已设为 %s' "$1" ;;
            ctl_upgrade) printf '升级源：' ;;
            ctl_upgrade_set) printf '升级源已设为 %s' "$1" ;;
            ctl_update_usage) printf '用法：mypanelctl update {password|port|listen-ip|entrance} <值>' ;;
            *) printf '%s' "$key" ;;
        esac
    else
        case "$key" in
            select_lang_prompt) printf 'Select language [1] English  [2] 中文 (default 1): ' ;;
            install_start) printf 'Installing mypanel ...' ;;
            install_done) printf 'Installation complete' ;;
            visit_addr) printf 'Address:    ' ;;
            account) printf 'Username:   ' ;;
            password) printf 'Password:   ' ;;
            data_dir) printf 'Data dir:   ' ;;
            entrance) printf 'Entrance:   ' ;;
            not_set) printf 'not set' ;;
            view_again) printf 'View again: mypanelctl info (reset password: mypanelctl update password <new>)' ;;
            service_status) printf 'Service:    mypanelctl status' ;;
            root_required) printf 'Please run as root (sudo %s)' "$1" ;;
            unknown_arg) printf 'Unknown argument: %s (--help for usage)' "$1" ;;
            need_arg) printf '%s requires an argument' "$1" ;;
            creating_dirs) printf 'Creating directories' ;;
            installing_bin) printf 'Installing binary to %s' "$1" ;;
            installing_conf) printf 'Installing config to %s' "$1" ;;
            installing_ctl) printf 'Installing CLI to %s' "$1" ;;
            installing_unit) printf 'Installing systemd unit %s' "$1" ;;
            building) printf 'Building master (scripts/build.sh)' ;;
            no_source_build) printf 'No source in package; --build is unavailable; use the bundled master' ;;
            master_not_found) printf 'master not found; run ./scripts/build.sh first' ;;
            no_port) printf 'Cannot find a free port' ;;
            service_not_listen) printf 'Service not listening on :%s; check mypanelctl status' "$1" ;;
            set_entrance_fail) printf 'Failed to set entrance; use mypanelctl update entrance' ;;
            uninstall_stop) printf 'Stopping and disabling service %s' "$1" ;;
            uninstall_removed) printf 'Removed %s' "$1" ;;
            uninstall_done) printf 'Uninstalled (config and data kept)' ;;
            info_title) printf 'mypanel installation info' ;;
            info_no_file) printf 'Info file missing; showing values from config only' ;;
            port) printf 'Port:       ' ;;
            no_password_shown) printf 'Password is hidden; reset: sudo mypanelctl update password <new>' ;;
            service_running) printf 'Service is running' ;;
            service_stopped) printf 'Service is not running' ;;
            listen_addr) printf 'Listen:     ' ;;
            version) printf 'Version:    ' ;;
            ctl_unknown) printf 'Unknown command: %s (mypanelctl help for usage)' "$1" ;;
            ctl_root_required) printf 'This operation requires root (sudo mypanelctl %s)' "$1" ;;
            ctl_no_master) printf '%s not found' "$1" ;;
            ctl_no_conf) printf 'Config file not found: %s' "$1" ;;
            ctl_restarted) printf 'Service restarted, changes applied' ;;
            ctl_started) printf 'Started' ;;
            ctl_stopped) printf 'Stopped' ;;
            ctl_enabled) printf 'Enabled at boot' ;;
            ctl_disabled) printf 'Disabled at boot' ;;
            ctl_pwd_set) printf 'Admin password reset' ;;
            ctl_pwd_usage) printf 'Usage: mypanelctl update password <new>' ;;
            ctl_pwd_space) printf 'Password cannot contain spaces' ;;
            ctl_pwd_fail) printf 'Failed to update password; check journalctl -u mypanel.service' ;;
            ctl_port_usage) printf 'Usage: mypanelctl update port <port>' ;;
            ctl_port_num) printf 'Port must be a number' ;;
            ctl_port_set) printf 'Port set to %s' "$1" ;;
            ctl_ip_usage) printf 'Usage: mypanelctl update listen-ip <address>' ;;
            ctl_ip_set) printf 'Listen address set to %s' "$1" ;;
            ctl_entrance_usage) printf 'Usage: mypanelctl update entrance <code> (empty to disable)' ;;
            ctl_entrance_set) printf 'Entrance set to %s' "$1" ;;
            ctl_upgrade) printf 'Upgrade source: ' ;;
            ctl_upgrade_set) printf 'Upgrade source set to %s' "$1" ;;
            ctl_update_usage) printf 'Usage: mypanelctl update {password|port|listen-ip|entrance} <value>' ;;
            *) printf '%s' "$key" ;;
        esac
    fi
}
