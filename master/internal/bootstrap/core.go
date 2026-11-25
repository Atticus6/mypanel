// Package bootstrap 负责在单进程模式下按固定顺序初始化 1Panel 的 core 与 agent。
//
// 初始化顺序是硬约束：日志要在数据库之前，数据库要在迁移之前，
// 迁移要在 hook 之前，hook 要在任何业务调用之前。顺序错了会出现
// 「表不存在」「密钥没生成」这类只在首次启动才暴露的问题。
package bootstrap

import (
	"encoding/gob"
	"fmt"
	"os"
	"path/filepath"

	"mypanel/core/app/repo"
	"mypanel/core/global"
	"mypanel/core/i18n"
	"mypanel/core/init/auth"
	"mypanel/core/init/db"
	"mypanel/core/init/hook"
	"mypanel/core/init/log"
	"mypanel/core/init/migration"
	"mypanel/core/init/session"
	"mypanel/core/init/session/psession"
	"mypanel/core/init/validator"
	coreviper "mypanel/core/init/viper"
	"mypanel/core/utils/re"
	"mypanel/shareddb"
)

// CoreOptions 是初始化 core 所需的参数。
type CoreOptions struct {
	// DataDir 是面板数据目录，例如 ./data；数据库、日志、密钥都写在其下。
	DataDir string
	// Version 是面板版本号。
	Version string
	// AdminUser 是首次启动创建的管理员用户名。
	AdminUser string
	// AdminPassword 是首次启动创建的管理员密码。
	AdminPassword string
	// Port 是面板实际监听端口（不含冒号），供 core 设置页展示。
	Port string
	// Mode 是运行模式：stable 或 dev。
	Mode string
	// Language 是默认界面语言。
	Language string
}

// InitCore 初始化 1Panel 的 core 侧依赖。
//
// 不启动 HTTP 服务，也不注册任何 REST 路由：路由由 master 统一提供，
// 业务调用通过 transport 层的 Connect adapter 进入。
func InitCore(opts CoreOptions) error {
	if opts.DataDir == "" {
		return fmt.Errorf("data_dir 不能为空")
	}
	abs, err := filepath.Abs(opts.DataDir)
	if err != nil {
		return fmt.Errorf("解析 data_dir 失败: %w", err)
	}
	if err := os.MkdirAll(filepath.Join(abs, "1panel"), 0o700); err != nil {
		return fmt.Errorf("创建数据目录失败: %w", err)
	}

	re.Init()
	coreviper.InitProcess(coreviper.ProcessOptions{
		InstallDir:    abs,
		Version:       opts.Version,
		AdminUser:     opts.AdminUser,
		AdminPassword: opts.AdminPassword,
		Port:          opts.Port,
		Mode:          opts.Mode,
		Language:      opts.Language,
	})

	log.Init()
	if _, err := shareddb.Init(abs); err != nil {
		return fmt.Errorf("初始化共享数据库失败: %w", err)
	}
	db.Init()
	migration.Init()
	i18n.Init()
	validator.Init()

	// session 里保存的是 SessionUser，写入 cookie 前需要注册 gob 类型。
	gob.Register(psession.SessionUser{})

	session.Init()
	hook.Init()

	// 迁移只在首次建库时写入 ServerPort，老库会保留旧的默认端口（9999）。
	// 每次启动都用 master 实际监听端口覆盖，确保设置页展示的端口与访问地址一致。
	if opts.Port != "" {
		settingRepo := repo.NewISettingRepo()
		if err := settingRepo.UpdateOrCreate("ServerPort", opts.Port); err != nil {
			global.LOG.Warnf("同步面板端口到数据库失败: %v", err)
		}
	}

	global.IPTracker = auth.NewIPTracker()

	global.LOG.Infof("core 初始化完成，数据目录 %s", abs)
	return nil
}
