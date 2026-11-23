package transport_test

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"testing"

	"connectrpc.com/connect"
	"github.com/gin-gonic/gin"

	"mypanel/master/internal/server"
	"mypanel/master/internal/transport"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
	"mypanel/proto/gen/go/panel/agent/v1/agentv1connect"
	corev1 "mypanel/proto/gen/go/panel/core/v1"
	"mypanel/proto/gen/go/panel/core/v1/corev1connect"
)

// TestE2ETwelveModules 用真实 HTTP + 会话 + CSRF 串起 12 个前端模块的数据层。
//
// 这里不启动浏览器，而是复用浏览器同款链路：登录拿 Cookie → 每个 RPC 带
// CSRF Token → 校验响应没有 Connect 错误。Container 在测试机没有 Docker，
// 只要求返回 *connect.Error 而不是 panic。
func TestE2ETwelveModules(t *testing.T) {
	gin.SetMode(gin.TestMode)
	password := setupSingleProcess(t)

	handler := server.New(server.Options{
		Logger:   slog.New(slog.NewTextHandler(io.Discard, nil)),
		Services: transport.Services(),
	})
	ts := httptest.NewServer(handler)
	defer ts.Close()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("创建 cookie jar 失败: %v", err)
	}
	httpClient := &http.Client{Jar: jar}

	authClient := corev1connect.NewAuthServiceClient(httpClient, ts.URL)
	login, err := authClient.Login(context.Background(), connect.NewRequest(&corev1.LoginRequest{
		Name:     "admin",
		Password: encryptLoginPassword(t, password),
		Language: "zh",
	}))
	if err != nil {
		t.Fatalf("登录失败: %v", err)
	}
	if login.Msg.GetName() != "admin" {
		t.Fatalf("登录用户 = %q, 期望 admin", login.Msg.GetName())
	}

	csrf := connect.WithInterceptors(csrfInterceptor(t, jar, ts.URL))
	authWithCSRF := corev1connect.NewAuthServiceClient(httpClient, ts.URL, csrf)
	coreSetting := corev1connect.NewSettingServiceClient(httpClient, ts.URL, csrf)
	website := agentv1connect.NewWebsiteServiceClient(httpClient, ts.URL, csrf)
	host := agentv1connect.NewHostServiceClient(httpClient, ts.URL, csrf)
	dashboard := agentv1connect.NewDashboardServiceClient(httpClient, ts.URL, csrf)
	app := agentv1connect.NewAppServiceClient(httpClient, ts.URL, csrf)
	container := agentv1connect.NewContainerServiceClient(httpClient, ts.URL, csrf)
	cronjob := agentv1connect.NewCronjobServiceClient(httpClient, ts.URL, csrf)
	logService := agentv1connect.NewLogServiceClient(httpClient, ts.URL, csrf)
	file := agentv1connect.NewFileServiceClient(httpClient, ts.URL, csrf)
	health := agentv1connect.NewHealthServiceClient(httpClient, ts.URL, csrf)

	ctx := context.Background()
	checks := []struct {
		module string
		call   func() error
	}{
		{"登录", func() error {
			_, err := authWithCSRF.Current(ctx, connect.NewRequest(&corev1.CurrentRequest{}))
			return err
		}},
		{"首页", func() error {
			_, err := dashboard.GetOsInfo(ctx, connect.NewRequest(&agentv1.OsInfoRequest{}))
			return err
		}},
		{"主机", func() error {
			_, err := host.Search(ctx, connect.NewRequest(&agentv1.SearchHostsRequest{Page: 1, PageSize: 10}))
			return err
		}},
		{"网站", func() error {
			_, err := website.Search(ctx, connect.NewRequest(&agentv1.SearchWebsitesRequest{Page: 1, PageSize: 10}))
			return err
		}},
		{"应用商店", func() error {
			_, err := app.SearchApps(ctx, connect.NewRequest(&agentv1.SearchAppsRequest{Page: 1, PageSize: 10}))
			return err
		}},
		{"容器", func() error {
			// 无 Docker 的测试机只要求返回 Connect 错误，不能 panic。
			_, err := container.Status(ctx, connect.NewRequest(&agentv1.ContainerStatusRequest{}))
			if err != nil {
				if _, ok := err.(*connect.Error); !ok {
					t.Fatalf("容器状态错误类型 = %T", err)
				}
			}
			return nil
		}},
		{"计划任务", func() error {
			_, err := cronjob.Search(ctx, connect.NewRequest(&agentv1.SearchCronjobsRequest{Page: 1, PageSize: 10}))
			return err
		}},
		{"设置", func() error {
			_, err := coreSetting.GetBaseInfo(ctx, connect.NewRequest(&corev1.GetSettingBaseInfoRequest{}))
			return err
		}},
		{"日志", func() error {
			_, err := logService.ListSystemFiles(ctx, connect.NewRequest(&agentv1.ListSystemFilesRequest{}))
			return err
		}},
		{"终端", func() error {
			_, err := coreSetting.GetTerminal(ctx, connect.NewRequest(&corev1.GetTerminalRequest{}))
			return err
		}},
		{"分享", func() error {
			_, err := file.GetShare(ctx, connect.NewRequest(&agentv1.GetShareRequest{Path: "/e2e/missing"}))
			return err
		}},
		{"文件", func() error {
			res, err := file.CheckFile(ctx, connect.NewRequest(&agentv1.CheckFileRequest{Path: "/tmp"}))
			if err != nil {
				return err
			}
			if !res.Msg.GetExists() {
				t.Fatal("/tmp 应存在")
			}
			return nil
		}},
		{"健康检查", func() error {
			_, err := health.Check(ctx, connect.NewRequest(&agentv1.CheckHealthRequest{}))
			return err
		}},
	}

	for _, check := range checks {
		if err := check.call(); err != nil {
			t.Errorf("%s 模块调用失败: %v", check.module, err)
		}
	}
}
