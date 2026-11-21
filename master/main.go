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
	"flag"
	"io/fs"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"mypanel/master/internal/app"
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
		"shutdown_timeout", cfg.ShutdownTimeout.String(),
	)

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
