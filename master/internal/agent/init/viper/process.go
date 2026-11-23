package viper

import (
	"bytes"
	"fmt"
	"path/filepath"

	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"

	"mypanel/agent/cmd/server/conf"
	"mypanel/agent/global"
)

// ProcessOptions 是单进程模式下初始化 agent 配置所需的输入。
type ProcessOptions struct {
	// InstallDir 是面板数据目录；agent 的库、日志、应用目录都写在其下。
	InstallDir string
	// Version 是面板版本号。
	Version string
	// Mode 是运行模式：stable 或 dev。
	Mode string
	// Language 是默认语言，写入配置供 i18n 兜底。
	Language string
}

// InitProcess 用进程级数据目录初始化 agent 配置。
//
// 与 Init 的差异：不读取 /usr/local/bin/1pctl，也不启动多节点探测。
// 单进程模式下节点恒为本地主节点，安装目录由 master 注入。
func InitProcess(opts ProcessOptions) {
	v := viper.NewWithOptions()
	v.SetConfigType("yaml")

	serverConfig := global.ServerConfig{}
	if err := yaml.Unmarshal(conf.AppYaml, &serverConfig); err != nil {
		panic(fmt.Errorf("parse embedded agent app.yaml: %w", err))
	}
	if err := v.ReadConfig(bytes.NewReader(conf.AppYaml)); err != nil {
		panic(fmt.Errorf("load embedded agent app.yaml: %w", err))
	}

	// 已有安装目录中的 conf/app.yaml 优先，保留用户配置。
	configPath := filepath.Join(opts.InstallDir, "1panel", "conf", "app.yaml")
	v.SetConfigFile(configPath)
	if err := v.ReadInConfig(); err != nil {
		v.SetConfigFile("")
		if readErr := v.ReadConfig(bytes.NewReader(conf.AppYaml)); readErr != nil {
			panic(fmt.Errorf("reload embedded agent app.yaml: %w", readErr))
		}
	}

	reloaded := global.ServerConfig{}
	if err := v.Unmarshal(&reloaded); err != nil {
		panic(fmt.Errorf("unmarshal agent app.yaml: %w", err))
	}
	serverConfig = reloaded

	mode := opts.Mode
	if mode == "" {
		mode = "stable"
	}
	version := opts.Version
	if version == "" {
		version = "v2.0.0"
	}

	serverConfig.Base.InstallDir = opts.InstallDir
	serverConfig.Base.Version = version
	serverConfig.Base.Mode = mode
	serverConfig.Base.Edition = "cn"
	serverConfig.Base.IsEnterprise = false

	global.CONF = serverConfig
	global.Viper = v
	// 单进程下永远是本地主节点，不再有多节点转发。
	global.IsMaster = true
}
