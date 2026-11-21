// Command master 启动 mypanel 控制面：同时提供 Connect/gRPC API 与 web 前端。
//
// 依赖装配交给 wire（见 internal/app），这里只负责解析参数、准备配置、
// 处理信号与退出码。
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
	"mypanel/master/internal/webdist"
)

// version 由构建时通过 -ldflags "-X main.version=..." 注入。
var version = "dev"

func main() {
	addr := flag.String("addr", ":8080", "监听地址")
	webDir := flag.String("web-dir", "", "从该目录读取前端产物，留空则使用编译进二进制的版本")
	debug := flag.Bool("debug", false, "打开 gin 调试模式")
	flag.Parse()

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	webFS, err := resolveWebFS(*webDir)
	if err != nil {
		logger.Error("resolve web assets", "err", err)
		os.Exit(1)
	}

	// wire 生成的 InitApp 负责把 Config 串成完整依赖图。
	application, err := app.InitApp(app.Config{
		Addr:    *addr,
		Version: version,
		WebFS:   webFS,
		Logger:  logger,
		Debug:   *debug,
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
