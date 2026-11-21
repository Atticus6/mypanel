package app

import (
	"io"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"testing/fstest"
)

// newTestConfig 构造一个不依赖真实网络与磁盘的配置。
func newTestConfig(t *testing.T) Config {
	t.Helper()
	return Config{
		Addr:    "127.0.0.1:0",
		Version: "test",
		WebFS: fstest.MapFS{
			"index.html": {Data: []byte("<!doctype html><div id=app></div>")},
		},
		Logger: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

func TestInitAppWiresDependencies(t *testing.T) {
	app, err := InitApp(newTestConfig(t))
	if err != nil {
		t.Fatalf("InitApp() error = %v, want nil", err)
	}

	if app == nil {
		t.Fatal("InitApp() = nil, want *App")
	}
	if app.Server == nil {
		t.Fatal("Server = nil, want *http.Server")
	}
	if app.Logger == nil {
		t.Fatal("Logger = nil, want *slog.Logger")
	}
	if app.Server.Handler == nil {
		t.Fatal("Server.Handler = nil, want non-nil handler")
	}
}

func TestInitAppConfiguresH2C(t *testing.T) {
	app, err := InitApp(newTestConfig(t))
	if err != nil {
		t.Fatalf("InitApp() error = %v, want nil", err)
	}

	// gRPC 依赖明文 HTTP/2，配置丢失会让所有原生 gRPC 调用失败。
	p := app.Server.Protocols
	if p == nil {
		t.Fatal("Protocols = nil, want configured protocols")
	}
	if !p.HTTP1() {
		t.Error("HTTP1 not enabled, browsers would fail")
	}
	if !p.UnencryptedHTTP2() {
		t.Error("UnencryptedHTTP2 not enabled, gRPC would fail")
	}
}

func TestInitAppPassesAddr(t *testing.T) {
	cfg := newTestConfig(t)
	cfg.Addr = "127.0.0.1:12345"

	app, err := InitApp(cfg)
	if err != nil {
		t.Fatalf("InitApp() error = %v, want nil", err)
	}
	if app.Server.Addr != cfg.Addr {
		t.Fatalf("Addr = %q, want %q", app.Server.Addr, cfg.Addr)
	}
}

func TestInitAppHandlerServesRPC(t *testing.T) {
	app, err := InitApp(newTestConfig(t))
	if err != nil {
		t.Fatalf("InitApp() error = %v, want nil", err)
	}

	// 确认 wire 串起来的 handler 真的能响应 RPC，
	// 而不是只有依赖关系成立、路由却没挂上。
	// Connect 要求 JSON 请求带正确的 Content-Type，否则返回 415。
	req, _ := http.NewRequest(http.MethodPost,
		"/rpc/panel.v1.PanelService/Ping", strings.NewReader(`{"message":"wired"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := &statusRecorder{header: http.Header{}}
	app.Server.Handler.ServeHTTP(rec, req)

	if rec.status != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.status)
	}
	if !strings.Contains(string(rec.body), "wired") {
		t.Fatalf("body = %q, want echoed message", string(rec.body))
	}
}

// statusRecorder 是测试用的最小 ResponseWriter。
type statusRecorder struct {
	header http.Header
	status int
	body   []byte
}

func (r *statusRecorder) Header() http.Header { return r.header }

func (r *statusRecorder) Write(p []byte) (int, error) {
	r.body = append(r.body, p...)
	return len(p), nil
}

func (r *statusRecorder) WriteHeader(code int) { r.status = code }
