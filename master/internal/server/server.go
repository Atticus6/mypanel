// Package server 把 Connect 服务处理器与 web 前端组装到同一个 HTTP server 上。
//
// 路由层用 gin，但整个 handler 仍然挂在标准库的 http.Server 上：
// gRPC 需要 HTTP/2（明文下是 h2c），而 gin 基于 net/http，可以与之共存。
// 如果换成基于 fasthttp 的框架（如 Fiber），gRPC 就无法工作了。
package server

import (
	"compress/gzip"
	"io/fs"
	"log/slog"
	"mime"
	"net/http"
	"path"
	"strings"

	"connectrpc.com/grpcreflect"
	"github.com/gin-gonic/gin"
)

// RPCPrefix 是浏览器访问 RPC 时额外使用的路径前缀。
//
// 服务处理器同时挂载在根路径和该前缀下，原因如下：
//   - gRPC 客户端按「服务全限定名」拼路径（如 /panel.v1.PanelService/Ping），
//     并且 server reflection 也只认根路径，所以根路径的挂载是必需的；
//   - 浏览器侧统一走 /rpc，好处是 SPA 只有一个稳定的代理目标，
//     并且 /rpc 不可能和任何前端路由撞名。
const RPCPrefix = "/rpc"

// Options 是构造 master HTTP handler 的配置项。
type Options struct {
	// Version 由 Ping 接口原样回传，一般填构建版本号。
	Version string
	// WebFS 提供前端静态文件，根目录下必须有 index.html。
	// 为空时所有页面请求返回 404 并提示先构建前端。
	WebFS fs.FS
	// Logger 接收请求日志。为 nil 时使用 slog.Default()。
	Logger *slog.Logger
	// Debug 打开 gin 的调试输出。生产环境应保持 false。
	Debug bool
	// FileUpload 是 /files/upload 的处理器；为 nil 时不注册。
	FileUpload http.Handler
	// FileDownload 是 /files/download 的处理器；为 nil 时不注册。
	FileDownload http.Handler
	// TerminalWS 是 /ws/terminal 的 WebSocket 处理器；为 nil 时不注册。
	TerminalWS gin.HandlerFunc
	// MCPHandler 是 /mcp 的处理器；为 nil 时不注册。
	MCPHandler gin.HandlerFunc
	// Services 是要挂载的 Connect 服务集合。
	//
	// 每个服务同时挂载在根路径与 /rpc 前缀下，见 RPCPrefix 的说明。
	Services []RPCService
}

// RPCService 是一个待挂载的 Connect 服务。
type RPCService struct {
	// Name 是服务全限定名，例如 panel.core.v1.AuthService，用于 gRPC 反射。
	Name string
	// Path 是生成 handler 返回的服务前缀，例如 /panel.core.v1.AuthService/。
	Path string
	// Handler 是生成的 Connect handler，同时支持 Connect、gRPC 与 gRPC-Web。
	Handler http.Handler
}

// New 组装并返回 master 的完整 HTTP handler。
//
// gin 负责常规 HTTP 路由，gRPC/Connect 处理器作为普通 http.Handler
// 挂进 gin，因此仍由底层 http.Server 的 h2c 支持。
func New(opts Options) http.Handler {
	logger := opts.Logger
	if logger == nil {
		logger = slog.Default()
	}

	if opts.Debug {
		gin.SetMode(gin.DebugMode)
	} else {
		// 生产环境关掉 gin 的调试模式，避免它打印路由表与警告。
		gin.SetMode(gin.ReleaseMode)
	}

	// gin.New() 不带默认中间件；日志由下方基于 slog 的中间件统一处理。
	r := gin.New()
	r.Use(logRequests(logger))

	// 同一个生成处理器同时支持 Connect、gRPC 与 gRPC-Web，因此只需注册一次，
	// 然后按上文的理由挂载到两个路径。
	//
	// 注意 gin 的路径匹配语义：生成的 handler 拿到的是「服务前缀」
	// （如 /panel.v1.PanelService/），其内部再按完整 procedure 路径分发。
	// 所以这里必须用通配 /*filepath 覆盖其下所有子路径，
	// 用精确路径注册会导致所有 RPC 落到 NoRoute。
	for _, svc := range opts.Services {
		r.Any(svc.Path+"*filepath", gin.WrapH(svc.Handler))
		r.Any(RPCPrefix+svc.Path+"*filepath", gin.WrapH(http.StripPrefix(RPCPrefix, svc.Handler)))
	}

	// gRPC server reflection 让 grpcurl、grpcui 等工具无需本地 .proto 就能
	// 发现 schema。反射接口依赖双向流，只能在 HTTP/2 上工作。
	// 服务名由注册表提供，新增服务时不需要改这里。
	names := make([]string, 0, len(opts.Services))
	for _, svc := range opts.Services {
		names = append(names, svc.Name)
	}
	reflector := grpcreflect.NewStaticReflector(names...)
	reflectPath, reflectHandler := grpcreflect.NewHandlerV1(reflector)
	r.Any(reflectPath+"*filepath", gin.WrapH(reflectHandler))
	// 部分老工具仍使用 v1alpha 版本的反射协议，一并提供。
	reflectAlphaPath, reflectAlphaHandler := grpcreflect.NewHandlerV1Alpha(reflector)
	r.Any(reflectAlphaPath+"*filepath", gin.WrapH(reflectAlphaHandler))

	// MCP 是外部协议端点，客户端要求 streamable HTTP，不能改成 gRPC。
	if opts.MCPHandler != nil {
		r.POST("/mcp", opts.MCPHandler)
		r.GET("/mcp", opts.MCPHandler)
		r.DELETE("/mcp", opts.MCPHandler)
	}

	// 终端是唯一保留的双向流通道：浏览器端 Connect 不能可靠承载 PTY。
	if opts.TerminalWS != nil {
		r.GET("/ws/terminal", opts.TerminalWS)
	}

	// 大文件走专用二进制 HTTP 通道，与 RPC 共用票据存储。
	if opts.FileUpload != nil {
		r.POST("/files/upload", gin.WrapH(opts.FileUpload))
	}
	if opts.FileDownload != nil {
		r.GET("/files/download", gin.WrapH(opts.FileDownload))
		r.HEAD("/files/download", gin.WrapH(opts.FileDownload))
	}

	// 给负载均衡器/容器探针用的轻量健康检查，不依赖任何下游。
	r.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok\n")
	})

	// 其余路径交给前端：静态文件直出，未知路径回落到 index.html。
	// 用 NoRoute 而不是 r.NoRoute(gin.WrapH(...)) 的静态注册，是因为
	// 前端路由是运行时才知道的，必须由 SPA handler 自己判断。
	r.NoRoute(gin.WrapH(spaHandler(opts.WebFS)))

	return r
}

// spaHandler 返回一个处理器：存在的文件按静态资源返回，其余路径回落到
// index.html，使前端路由的深链接（如 /about）刷新后仍然可用。
//
// 文本类静态资源会按 Accept-Encoding 做 gzip 压缩。前端产物里 CSS 有
// 300KB 左右，gzip 后不到 50KB，压缩收益很大；不压缩等于每次冷启动
// 都多传 260KB。
func spaHandler(webFS fs.FS) http.Handler {
	if webFS == nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			http.Error(w, "web assets not built: run ./scripts/build.sh", http.StatusNotFound)
		})
	}

	fileServer := http.FileServer(http.FS(webFS))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" {
			name = "."
		}

		if info, err := fs.Stat(webFS, name); err == nil && !info.IsDir() {
			if shouldGzip(r, name) {
				serveGzipped(w, webFS, fileServer, r, name)
				return
			}
			fileServer.ServeHTTP(w, r)
			return
		}

		index, err := fs.ReadFile(webFS, "index.html")
		if err != nil {
			// 干净 checkout 下 dist/ 只有 embed 占位文件，没有 index.html。
			// 这不是服务端故障，而是前端还没构建，所以返回 404 加提示。
			http.Error(w, "web assets not built: run ./scripts/build.sh", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write(index)
	})
}

// compressibleExts 列出值得 gzip 的静态资源扩展名。
//
// 图片、字体、视频本身已是压缩格式，再 gzip 只会浪费 CPU 且几乎不减小体积，
// 所以按扩展名白名单放行，而不是对所有响应无差别压缩。
var compressibleExts = map[string]bool{
	".css":         true,
	".js":          true,
	".mjs":         true,
	".html":        true,
	".json":        true,
	".svg":         true,
	".map":         true,
	".txt":         true,
	".webmanifest": true,
}

// shouldGzip 判断某个请求是否应当 gzip 压缩。
//
// 三个条件缺一不可：客户端声明支持 gzip、扩展名在白名单内、
// 且不是 Range 请求（Range 与整体压缩语义冲突，交给原处理器处理）。
func shouldGzip(r *http.Request, name string) bool {
	if r.Header.Get("Range") != "" {
		return false
	}
	if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
		return false
	}
	return compressibleExts[strings.ToLower(path.Ext(name))]
}

// serveGzipped 读取整个文件后压缩写出。
//
// 选择整块压缩而非流式压缩：前端产物都是构建期生成的文件，最大几百 KB，
// 整块处理简单且能准确设置 Content-Length。
func serveGzipped(w http.ResponseWriter, webFS fs.FS, fileServer http.Handler, r *http.Request, name string) {
	data, err := fs.ReadFile(webFS, name)
	if err != nil {
		// 读失败时退回未压缩路径，让原处理器给出正确的状态码。
		fileServer.ServeHTTP(w, r)
		return
	}

	h := w.Header()
	// 必须自己设置 Content-Type：这里绕过了 http.FileServer，而浏览器对
	// ES module 强制要求 JS MIME 类型，缺失会直接拒绝执行脚本。
	h.Set("Content-Type", contentTypeFor(name))
	h.Set("Content-Encoding", "gzip")
	// Vary 让中间缓存知道响应随 Accept-Encoding 变化，
	// 避免把压缩版本发给不支持 gzip 的客户端。
	h.Add("Vary", "Accept-Encoding")
	// 压缩后长度未知，去掉原处理器可能设置的 Content-Length。
	h.Del("Content-Length")

	w.WriteHeader(http.StatusOK)

	gz := gzip.NewWriter(w)
	// 先写数据再关：Close 会 flush 尾部并写 gzip 结束标记，必须执行。
	_, writeErr := gz.Write(data)
	closeErr := gz.Close()
	if writeErr != nil || closeErr != nil {
		// 响应头已发出，无法再改状态码，客户端会因 gzip 流不完整而感知失败。
		return
	}
}

// contentTypeFor 按扩展名推断 Content-Type。
//
// mime.TypeByExtension 依赖系统 MIME 数据库，在精简容器里可能返回空，
// 所以对前端关键类型直接给出确定答案，其余再交给标准库。
func contentTypeFor(name string) string {
	switch strings.ToLower(path.Ext(name)) {
	case ".js", ".mjs":
		return "text/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".html":
		return "text/html; charset=utf-8"
	case ".json", ".map":
		return "application/json; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".txt":
		return "text/plain; charset=utf-8"
	case ".webmanifest":
		return "application/manifest+json"
	}
	if ct := mime.TypeByExtension(path.Ext(name)); ct != "" {
		return ct
	}
	return "application/octet-stream"
}

// logRequests 用 slog 记录每个请求的方法、路径与状态码。
//
// 不用 gin.Logger()：它输出带 ANSI 颜色的文本，与项目的结构化日志不一致。
func logRequests(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		logger.Info("request",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
		)
	}
}
