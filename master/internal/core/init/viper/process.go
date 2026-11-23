package viper

import (
	"bytes"
	"fmt"

	"mypanel/core/cmd/server/conf"
	"mypanel/core/global"

	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

// ProcessOptions 是单进程模式下初始化 core 配置所需的输入。
type ProcessOptions struct {
	// InstallDir 是面板数据目录，例如 ./data；数据库与日志都写在其下。
	InstallDir string
	// Version 是面板版本号，写入配置并回传给前端。
	Version string
	// AdminUser 是首次启动时创建的管理员用户名。
	AdminUser string
	// AdminPassword 是首次启动时创建的管理员密码。
	AdminPassword string
	// Mode 是运行模式：stable 或 dev。
	Mode string
	// Language 是默认界面语言。
	Language string
}

// InitProcess 用进程级数据目录初始化 core 配置。
//
// 与 Init 的差异：不读取 /usr/local/bin/1pctl，也不要求 /opt/1panel 存在，
// 因为单进程模式下安装目录由 master 统一注入（MYPANEL_DATA_DIR）。
// 已有安装目录中的 conf/app.yaml 仍然会被读取，以保证升级场景配置不丢失。
func InitProcess(opts ProcessOptions) {
	v := viper.NewWithOptions()
	v.SetConfigType("yaml")

	serverConfig := global.ServerConfig{}
	if err := yaml.Unmarshal(conf.AppYaml, &serverConfig); err != nil {
		panic(fmt.Errorf("parse embedded app.yaml: %w", err))
	}
	if err := v.ReadConfig(bytes.NewReader(conf.AppYaml)); err != nil {
		panic(fmt.Errorf("load embedded app.yaml: %w", err))
	}

	// 安装目录下存在 conf/app.yaml 时以它为准，保留用户已有配置。
	configPath := opts.InstallDir + "/1panel/conf/app.yaml"
	v.SetConfigFile(configPath)
	if err := v.ReadInConfig(); err != nil {
		// 读不到视为首次启动，回退到内置默认值，不当作错误。
		v.SetConfigFile("")
		if readErr := v.ReadConfig(bytes.NewReader(conf.AppYaml)); readErr != nil {
			panic(fmt.Errorf("reload embedded app.yaml: %w", readErr))
		}
	}

	reloaded := global.ServerConfig{}
	if err := v.Unmarshal(&reloaded); err != nil {
		panic(fmt.Errorf("unmarshal app.yaml: %w", err))
	}
	serverConfig = reloaded

	mode := opts.Mode
	if mode == "" {
		mode = "stable"
	}
	language := opts.Language
	if language == "" {
		language = "en"
	}
	adminUser := opts.AdminUser
	if adminUser == "" {
		adminUser = "admin"
	}
	version := opts.Version
	if version == "" {
		version = "v2.0.0"
	}

	serverConfig.Base.Mode = mode
	serverConfig.Base.InstallDir = opts.InstallDir
	serverConfig.Base.Version = version
	serverConfig.Base.Username = adminUser
	serverConfig.Base.Language = language
	serverConfig.Base.IsEnterprise = false
	serverConfig.Base.Edition = "cn"
	serverConfig.Base.IsDemo = v.GetBool("base.is_demo")
	serverConfig.Base.IsOffline = v.GetBool("base.is_offline")
	if opts.AdminPassword != "" {
		serverConfig.Base.Password = opts.AdminPassword
	}
	// 迁移会把这个端口写入设置并被 agent 的防火墙白名单读取；
	// 为空会生成非法白名单，所以必须有确定值。
	if serverConfig.Conn.Port == "" {
		serverConfig.Conn.Port = "9999"
	}
	if serverConfig.Conn.BindAddress == "" {
		serverConfig.Conn.BindAddress = "0.0.0.0"
	}

	global.CONF = serverConfig
	global.Viper = v
}
