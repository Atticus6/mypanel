// Command master 启动 mypanel 控制面：同时提供 Connect/gRPC API 与 web 前端。
//
// 依赖装配交给 wire（见 internal/app），这里只负责解析参数、准备配置、
// 处理信号与退出码。
//
// 配置优先级（高到低）：命令行参数 > 环境变量 > 默认值。
// 环境变量统一带 MYPANEL_ 前缀，例如 MYPANEL_ADDR=:9000。
package main

import (
	"context"
	"crypto/rand"
	"flag"
	"io/fs"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"mypanel/master/internal/app"
	"mypanel/master/internal/bootstrap"
	"mypanel/master/internal/config"
	"mypanel/master/internal/webdist"
)

// version 由构建时通过 -ldflags "-X main.version=..." 注入。
var version = "dev"

func main() {
	// flag 的默认值留空/特殊值，用来判断用户是否显式指定过。
	// 直接给默认值会让 flag 永远「有值」，从而压掉环境变量与配置文件。
	configPath := flag.String("config", "", "YAML 配置文件路径（默认在 . / ./config / /etc/mypanel 下查找 config.yaml）")
	addr := flag.String("addr", "", "监听地址（默认取 MYPANEL_ADDR 或 :8080）")
	webDir := flag.String("web-dir", "", "前端产物目录（默认取 MYPANEL_WEB_DIR；留空则用内置版本）")
	debug := flag.Bool("debug", false, "打开 gin 调试模式（默认取 MYPANEL_DEBUG）")
	flag.Parse()

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	v := config.NewViper()
	// 只覆盖用户显式传入的 flag，其余继续走环境变量、配置文件与默认值。
	// v.Set 的优先级最高，因此 flag > env > yaml > default。
	if isFlagSet("addr") {
		v.Set("addr", *addr)
	}
	if isFlagSet("web-dir") {
		v.Set("web_dir", *webDir)
	}
	if isFlagSet("debug") {
		v.Set("debug", *debug)
	}

	cfg, err := config.Load(v, config.Options{Path: *configPath})
	if err != nil {
		logger.Error("load config", "err", err)
		os.Exit(1)
	}
	logger.Info("config loaded",
		"file", cfg.ConfigFile,
		"addr", cfg.Addr,
		"web_dir", cfg.WebDir,
		"debug", cfg.Debug,
		"data_dir", config.ResolvePath(cfg.DataDir),
		"shutdown_timeout", cfg.ShutdownTimeout.String(),
	)

	// core/agent 是独立 module，无法直接读 master 的 Config；把它们需要的发布源
	// 地址写成环境变量（进程内可见），由各自的 global 函数读取。环境变量优先级
	// 高于配置文件，因此这里用 os.Setenv 覆盖是安全的。
	setUpgradeEnv("MYPANEL_UPGRADE_REPO_URL", cfg.UpgradeRepoURL)
	setUpgradeEnv("MYPANEL_UPGRADE_RESOURCE_URL", cfg.UpgradeResourceURL)
	setUpgradeEnv("MYPANEL_UPGRADE_APP_URL", cfg.UpgradeAppURL)

	adminPassword := cfg.AdminPassword
	if adminPassword == "" {
		// 空密码会让所有请求都能登录，必须显式生成一个并打印一次。
		adminPassword = randomPassword()
		logger.Warn("admin_password 未配置，已生成随机密码，请立即记录并修改", "password", adminPassword)
	}
	if err := bootstrap.InitCore(bootstrap.CoreOptions{
		DataDir:       cfg.DataDir,
		Version:       version,
		AdminUser:     cfg.AdminUser,
		AdminPassword: adminPassword,
		Mode:          "stable",
		Language:      "zh",
	}); err != nil {
		logger.Error("init core", "err", err)
		os.Exit(1)
	}
	// agent 的部分迁移会读 core 的设置，所以顺序必须是 core → agent。
	if err := bootstrap.InitAgent(bootstrap.AgentOptions{
		DataDir:  cfg.DataDir,
		Version:  version,
		Mode:     "stable",
		Language: "zh",
	}); err != nil {
		logger.Error("init agent", "err", err)
		os.Exit(1)
	}

	webFS, err := resolveWebFS(cfg.WebDir)
	if err != nil {
		logger.Error("resolve web assets", "err", err)
		os.Exit(1)
	}

	// wire 生成的 InitApp 负责把 Config 串成完整依赖图。
	application, err := app.InitApp(app.Config{
		Addr:            cfg.Addr,
		Version:         version,
		WebFS:           webFS,
		Logger:          logger,
		Debug:           cfg.Debug,
		ShutdownTimeout: cfg.ShutdownTimeout,
	})
	if err != nil {
		logger.Error("init app", "err", err)
		os.Exit(1)
	}

	// 收到 Ctrl-C 或 SIGTERM 时取消 ctx，触发优雅退出。
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := application.Run(ctx); err != nil {
		logger.Error("run", "err", err)
		os.Exit(1)
	}
}

// randomPassword 生成 16 位随机密码，用于未配置 admin_password 的首次启动。
func randomPassword() string {
	const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "1panel-please-change"
	}
	for i := range buf {
		buf[i] = alphabet[int(buf[i])%len(alphabet)]
	}
	return string(buf)
}

// setUpgradeEnv 把发布源配置写成进程内环境变量。
//
// 仅当值非空时设置：配置为空意味着「用回内置默认」，此时应保留调用方
// 已经通过真实环境变量传入的值（viper 已处理过优先级）。
func setUpgradeEnv(key, value string) {
	if value == "" {
		return
	}
	_ = os.Setenv(key, value)
}

// isFlagSet 判断某个 flag 是否被显式指定。
//
// 用 flag.Visit 而不是比较默认值：用户可能显式传入与默认值相同的值，
// 那也应该算「指定过」并覆盖环境变量。
func isFlagSet(name string) bool {
	set := false
	flag.Visit(func(f *flag.Flag) {
		if f.Name == name {
			set = true
		}
	})
	return set
}

// resolveWebFS 决定前端资源从哪读取。
//
// webDir 为空时使用 go:embed 编译进二进制的产物（生产模式）；
// 非空时直接读磁盘目录（开发模式，改完前端只需重启进程）。
func resolveWebFS(webDir string) (fs.FS, error) {
	if webDir == "" {
		return fs.Sub(webdist.FS, "dist")
	}
	if _, err := os.Stat(webDir); err != nil {
		return nil, err
	}
	return os.DirFS(webDir), nil
}
