package bootstrap

import (
	"fmt"
	"os"
	"path/filepath"

	agentservice "mypanel/agent/app/service"
	"mypanel/agent/global"
	agenti18n "mypanel/agent/i18n"
	agentapp "mypanel/agent/init/app"
	"mypanel/agent/init/cache"
	"mypanel/agent/init/db"
	"mypanel/agent/init/dir"
	"mypanel/agent/init/firewall"
	"mypanel/agent/init/hook"
	"mypanel/agent/init/log"
	"mypanel/agent/init/migration"
	"mypanel/agent/init/validator"
	agentviper "mypanel/agent/init/viper"
	agentlog "mypanel/agent/log"
	"mypanel/agent/utils/re"
	coreglobal "mypanel/core/global"
)

// AgentOptions 是初始化 agent 所需的参数。
type AgentOptions struct {
	// DataDir 是面板数据目录，agent 的数据库与运行目录都写在其下。
	DataDir string
	// Version 是面板版本号。
	Version string
	// Mode 是运行模式：stable 或 dev。
	Mode string
	// Language 是默认语言。
	Language string
}

// InitAgent 初始化 1Panel 的 agent 侧依赖。
//
// 不启动 agent 自己的 HTTP server、不注册任何 REST 路由，也不启动 socket 监听：
// 单进程下所有请求由 master 的 Connect 服务进入，agent 只提供业务实现。
//
// 顺序与 agent/server.Start 保持一致：目录必须在日志之前（日志写入 Dir.LogDir），
// 数据库必须在迁移之前，缓存/语言/校验器必须在 hook 之前。
func InitAgent(opts AgentOptions) error {
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
	// agent 的部分迁移会读取 core 的设置（面板端口、脚本库等），
	// 单进程下 core 必须先完成初始化，否则 CoreDB 为空会在迁移里空指针。
	if coreglobal.DB == nil {
		return fmt.Errorf("agent 初始化前必须先初始化 core")
	}

	re.Init()
	agentviper.InitProcess(agentviper.ProcessOptions{
		InstallDir: abs,
		Version:    opts.Version,
		Mode:       opts.Mode,
		Language:   opts.Language,
	})
	dir.Init()
	// 单进程下不能把 stderr 重定向进 agent 日志文件，否则 master 的日志与 panic 都会消失。
	agentlog.DisableStderrRedirect()
	log.Init()
	db.Init()
	migration.Init()
	agenti18n.Init()
	cache.Init()
	// app.Init 只在后台准备 Docker 网络，没有 Docker 时自行失败，不阻塞启动。
	agentapp.Init()
	// lang.Init 会联网下载系统语言包与 GeoIP 库；单进程启动不依赖它们，
	// 缺文件时还会打错误日志，所以放到后续的离线初始化任务里做。
	validator.Init()
	hook.Init()
	// 任务可见性策略原本在 router 初始化时注册；单进程不启动 router，必须在这里补上，
	// 否则任务中心会报「task scope policy is unavailable」。
	if err := agentservice.ConfigurePanelMCPTasks(); err != nil {
		global.LOG.Warnf("configure task scope policy failed: %v", err)
	}
	// 防火墙子系统需要探测 iptables/ufw/firewalld；没有可用后端时会自行记录日志并退出，
	// 不阻塞 master 启动，因此放到后台执行。
	go firewall.Init()

	global.LOG.Infof("agent 初始化完成，数据目录 %s", abs)
	return nil
}
