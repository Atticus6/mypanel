// Package app 用 wire 组装 master 的依赖图。
//
// 把「构造哪些对象、谁依赖谁」集中在这里，main 只负责解析参数与启停。
// 新增依赖时改 providers 与 injector 签名，然后运行 scripts/gen-wire.sh。
package app

import (
	"context"
	"io/fs"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/wire"

	"mypanel/master/internal/server"
	"mypanel/master/internal/transport"
)

// Config 是从命令行解析出来、供依赖图使用的配置。
type Config struct {
	// Addr 是 HTTP 监听地址，例如 ":8080"。
	Addr string
	// Version 由构建时注入，Ping 接口会原样回传。
	Version string
	// WebFS 提供前端静态文件。
	WebFS fs.FS
	// Logger 是全局结构化日志器。
	Logger *slog.Logger
	// Debug 打开 gin 调试模式。
	Debug bool
	// ShutdownTimeout 是优雅退出的最长等待时间。
	// 为 0 时回退到 defaultShutdownTimeout，避免测试里忘记设置就立即超时。
	ShutdownTimeout time.Duration
}

// defaultShutdownTimeout 是 ShutdownTimeout 未配置时的回退值。
const defaultShutdownTimeout = 5 * time.Second

// provideRPCServices 返回已实现的 Connect 服务集合。
func provideRPCServices() []server.RPCService {
	return transport.Services()
}

// provideLogger 从 Config 取出日志器，供 App 字段注入使用。
//
// App 需要 *slog.Logger 作为字段，而它来自 Config，所以单独提供一个
// provider，让 wire 能把这个类型接上。
func provideLogger(cfg Config) *slog.Logger {
	return cfg.Logger
}

// provideHandler 把 Config 与 Service 组装成 HTTP handler。
//
// wire 需要知道每个构造函数的入参从哪来，所以用这个函数把 Config
// 的字段映射到 server.Options，避免 server 包反向依赖 Config。
func provideHandler(cfg Config, services []server.RPCService) http.Handler {
	upload, download := transport.FileHandlers()
	return server.New(server.Options{
		Version:       cfg.Version,
		WebFS:         cfg.WebFS,
		Logger:        cfg.Logger,
		Debug:         cfg.Debug,
		Services:      services,
		FileUpload:    upload,
		FileDownload:  download,
		TerminalWS:    transport.TerminalWSHandler(),
		ProcessWS:     transport.ProcessWSHandler(),
		MCPHandler:    transport.MCPHandler(),
		ContainerLogs: transport.ContainerLogsHandler(),
	})
}

// newHTTPServer 构造底层 http.Server。
//
// Protocols 同时开启 HTTP/1.1 与明文 HTTP/2（h2c）：
//   - 浏览器走 HTTP/1.1；
//   - 原生 gRPC 客户端（grpcurl、Go client）需要 HTTP/2，
//     开发环境通常没有 TLS，所以必须显式打开 h2c。
//
// 这里用标准库自带的 http.Protocols，避免引入 golang.org/x/net。
func newHTTPServer(cfg Config, handler http.Handler) *http.Server {
	p := new(http.Protocols)
	p.SetHTTP1(true)
	p.SetUnencryptedHTTP2(true)

	return &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		Protocols:         p,
	}
}

// newApp 组装运行单元。
//
// 不用 wire.Struct(new(App), "*")：App 含 time.Duration 字段，
// 用结构体注入会让 wire 无法区分「哪个 Duration 对应哪个字段」。
// 显式构造函数更清楚，也便于在这里做默认值回退。
func newApp(cfg Config, srv *http.Server, logger *slog.Logger) *App {
	timeout := cfg.ShutdownTimeout
	if timeout <= 0 {
		timeout = defaultShutdownTimeout
	}
	return &App{
		Server:          srv,
		Logger:          logger,
		ShutdownTimeout: timeout,
	}
}

// ProviderSet 是依赖图的完整声明，供 wire.Build 引用。
var ProviderSet = wire.NewSet(
	provideRPCServices,
	provideLogger,
	provideHandler,
	newHTTPServer,
	newApp,
)

// App 是组装完成的运行单元。
type App struct {
	Server *http.Server
	Logger *slog.Logger
	// ShutdownTimeout 是优雅退出的最长等待时间。
	ShutdownTimeout time.Duration
}

// Run 启动 HTTP 服务并阻塞，直到 ctx 被取消后优雅退出。
//
// 关闭超时由配置决定，给在途请求（包括未结束的流式 RPC）留出收尾时间。
func (a *App) Run(ctx context.Context) error {
	timeout := a.ShutdownTimeout
	if timeout <= 0 {
		timeout = defaultShutdownTimeout
	}

	errCh := make(chan error, 1)
	go func() {
		a.Logger.Info("master listening", "addr", a.Server.Addr)
		errCh <- a.Server.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		// 正常关闭时 ListenAndServe 返回 ErrServerClosed，不算错误。
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	case <-ctx.Done():
		a.Logger.Info("shutting down", "timeout", timeout.String())
		shutdownCtx, cancel := context.WithTimeout(context.Background(), timeout)
		defer cancel()
		return a.Server.Shutdown(shutdownCtx)
	}
}
