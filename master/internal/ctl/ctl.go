// Package ctl 提供面板运维命令行操作，供 mypanelctl 调用。
//
// 这些操作必须通过 core 的 settingRepo 执行：它会在更新数据库的同时刷新
// 进程内缓存。若只用外部工具改库，运行中的 master 会在缓存 TTL 内读到旧值。
package ctl

import (
	"fmt"
	"strings"

	"mypanel/core/app/repo"
	"mypanel/core/utils/encrypt"
)

// Apply 执行一个运维操作。
//
// 调用前必须已经完成 core 初始化（global.DB / global.CONF 就绪）。
// action 支持：password / port / listen-ip / entrance。
func Apply(action, value string) error {
	value = strings.TrimSpace(value)
	if value == "" {
		return fmt.Errorf("%s 的值不能为空", action)
	}

	settingRepo := repo.NewISettingRepo()
	switch action {
	case "password":
		// 与 core 的 1pctl update password 保持一致：用 EncryptKey 加密后入库。
		encrypted, err := encrypt.StringEncrypt(value)
		if err != nil {
			return fmt.Errorf("加密密码失败: %w", err)
		}
		return settingRepo.UpdateOrCreate("Password", encrypted)
	case "port":
		return settingRepo.UpdateOrCreate("ServerPort", value)
	case "listen-ip":
		return settingRepo.UpdateOrCreate("BindAddress", value)
	case "entrance":
		return settingRepo.UpdateOrCreate("SecurityEntrance", value)
	default:
		return fmt.Errorf("未知操作: %s", action)
	}
}
