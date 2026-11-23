package transport_test

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	"mypanel/core/app/repo"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
	"mypanel/proto/gen/go/panel/agent/v1/agentv1connect"
	corev1 "mypanel/proto/gen/go/panel/core/v1"
	"mypanel/proto/gen/go/panel/core/v1/corev1connect"

	"mypanel/master/internal/bootstrap"
	"mypanel/master/internal/server"
	"mypanel/master/internal/transport"
)

// TestWebsiteSearchOverHTTP 走完整的 HTTP 链路：
// 登录拿 Cookie → 带 CSRF Token 调 WebsiteService.Search → 命中数据库里的网站。
//
// 这条用例同时覆盖 Connect 挂载、会话拦截器、CSRF 校验与 agent adapter，
// 比单独测 handler 更接近浏览器的真实调用。
func TestWebsiteSearchOverHTTP(t *testing.T) {
	password := setupSingleProcess(t)

	site := model.Website{
		Protocol:      "http",
		PrimaryDomain: "http-test.example.com",
		Type:          "static",
		Alias:         "http-test.example.com",
		Status:        "Running",
		SiteDir:       "index",
	}
	if err := agentglobal.DB.Create(&site).Error; err != nil {
		t.Fatalf("插入网站失败: %v", err)
	}

	upload, download := transport.FileHandlers()
	handler := server.New(server.Options{
		Logger:       slog.New(slog.NewTextHandler(io.Discard, nil)),
		Services:     transport.Services(),
		FileUpload:   upload,
		FileDownload: download,
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
		t.Fatalf("Login 失败: %v", err)
	}
	if login.Msg.GetName() != "admin" {
		t.Fatalf("登录用户 = %q, 期望 admin", login.Msg.GetName())
	}

	websiteClient := agentv1connect.NewWebsiteServiceClient(
		httpClient,
		ts.URL,
		connect.WithInterceptors(csrfInterceptor(t, jar, ts.URL)),
	)
	list, err := websiteClient.Search(context.Background(), connect.NewRequest(&agentv1.SearchWebsitesRequest{
		Page:     1,
		PageSize: 10,
		Name:     "http-test",
	}))
	if err != nil {
		t.Fatalf("Search 失败: %v", err)
	}
	if list.Msg.GetTotal() != 1 {
		t.Fatalf("total = %d, 期望 1", list.Msg.GetTotal())
	}
	if got := list.Msg.GetItems()[0].GetPrimaryDomain(); got != "http-test.example.com" {
		t.Fatalf("primary_domain = %q", got)
	}

	// 同一会话下再调一个 agent 服务，确认多个服务的挂载与策略都生效。
	hostClient := agentv1connect.NewHostServiceClient(
		httpClient,
		ts.URL,
		connect.WithInterceptors(csrfInterceptor(t, jar, ts.URL)),
	)
	hosts, err := hostClient.Search(context.Background(), connect.NewRequest(&agentv1.SearchHostsRequest{
		Page:     1,
		PageSize: 10,
	}))
	if err != nil {
		t.Fatalf("HostService.Search 失败: %v", err)
	}
	if hosts.Msg.GetTotal() != 0 {
		t.Fatalf("host total = %d, 期望 0", hosts.Msg.GetTotal())
	}
}

// TestWebsiteSearchRequiresLogin 验证未登录时返回 Unauthenticated 而不是 Internal。
func TestWebsiteSearchRequiresLogin(t *testing.T) {
	setupSingleProcess(t)

	upload, download := transport.FileHandlers()
	handler := server.New(server.Options{
		Logger:       slog.New(slog.NewTextHandler(io.Discard, nil)),
		Services:     transport.Services(),
		FileUpload:   upload,
		FileDownload: download,
	})
	ts := httptest.NewServer(handler)
	defer ts.Close()

	client := agentv1connect.NewWebsiteServiceClient(&http.Client{}, ts.URL)
	_, err := client.Search(context.Background(), connect.NewRequest(&agentv1.SearchWebsitesRequest{
		Page:     1,
		PageSize: 10,
	}))
	if err == nil {
		t.Fatal("未登录请求应失败")
	}
	connectErr, ok := err.(*connect.Error)
	if !ok {
		t.Fatalf("错误类型 = %T, 期望 *connect.Error", err)
	}
	if connectErr.Code() != connect.CodeUnauthenticated {
		t.Fatalf("code = %v, 期望 unauthenticated", connectErr.Code())
	}
}

// setupSingleProcess 启动 core 与 agent，并在测试结束后保持进程内单例可用。
func setupSingleProcess(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	password := strings.Repeat("p", 12)
	if err := bootstrap.InitCore(bootstrap.CoreOptions{
		DataDir:       dir,
		Version:       "v2.5.1-test",
		AdminUser:     "admin",
		AdminPassword: password,
		Mode:          "stable",
		Language:      "zh",
	}); err != nil {
		t.Fatalf("InitCore: %v", err)
	}
	if err := bootstrap.InitAgent(bootstrap.AgentOptions{
		DataDir:  dir,
		Version:  "v2.5.1-test",
		Mode:     "stable",
		Language: "zh",
	}); err != nil {
		t.Fatalf("InitAgent: %v", err)
	}
	return password
}

// csrfInterceptor 从 cookie jar 读取 pcsrftoken 并写入请求头。
//
// 浏览器由 axios/Connect 拦截器做同样的事；这里模拟浏览器行为。
func csrfInterceptor(t *testing.T, jar http.CookieJar, baseURL string) connect.Interceptor {
	t.Helper()
	return connect.UnaryInterceptorFunc(func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			parsed, err := http.NewRequest(http.MethodPost, baseURL, nil)
			if err != nil {
				return nil, err
			}
			for _, cookie := range jar.Cookies(parsed.URL) {
				if cookie.Name == "pcsrftoken" {
					req.Header().Set("X-CSRF-Token", cookie.Value)
				}
			}
			return next(ctx, req)
		}
	})
}

// encryptLoginPassword 复刻前端的 RSA+AES 密码加密。
func encryptLoginPassword(t *testing.T, password string) string {
	t.Helper()
	publicKeyPEM, err := repo.NewISettingRepo().GetValueByKey("PASSWORD_PUBLIC_KEY")
	if err != nil {
		t.Fatalf("读取公钥失败: %v", err)
	}
	block, _ := pem.Decode([]byte(publicKeyPEM))
	if block == nil {
		t.Fatal("公钥 PEM 解析失败")
	}
	parsed, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		t.Fatalf("解析公钥失败: %v", err)
	}
	publicKey, ok := parsed.(*rsa.PublicKey)
	if !ok {
		t.Fatal("公钥类型不是 RSA")
	}

	aesKey := make([]byte, 16)
	if _, err := rand.Read(aesKey); err != nil {
		t.Fatalf("生成 AES 密钥失败: %v", err)
	}
	iv := make([]byte, aes.BlockSize)
	if _, err := rand.Read(iv); err != nil {
		t.Fatalf("生成 IV 失败: %v", err)
	}

	padding := aes.BlockSize - len(password)%aes.BlockSize
	plain := append([]byte(password), bytes.Repeat([]byte{byte(padding)}, padding)...)

	blockCipher, err := aes.NewCipher(aesKey)
	if err != nil {
		t.Fatalf("AES 初始化失败: %v", err)
	}
	ciphertext := make([]byte, len(plain))
	cipher.NewCBCEncrypter(blockCipher, iv).CryptBlocks(ciphertext, plain)

	encryptedKey, err := rsa.EncryptPKCS1v15(rand.Reader, publicKey, aesKey)
	if err != nil {
		t.Fatalf("RSA 加密失败: %v", err)
	}
	return strings.Join([]string{
		base64.StdEncoding.EncodeToString(encryptedKey),
		base64.StdEncoding.EncodeToString(iv),
		base64.StdEncoding.EncodeToString(ciphertext),
	}, ":")
}

// TestFileTicketOverHTTP 验证票据签发 + 二进制上传的完整链路。
func TestFileTicketOverHTTP(t *testing.T) {
	password := setupSingleProcess(t)

	upload, download := transport.FileHandlers()
	handler := server.New(server.Options{
		Logger:       slog.New(slog.NewTextHandler(io.Discard, nil)),
		Services:     transport.Services(),
		FileUpload:   upload,
		FileDownload: download,
	})
	ts := httptest.NewServer(handler)
	defer ts.Close()

	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatalf("cookie jar: %v", err)
	}
	httpClient := &http.Client{Jar: jar}
	authClient := corev1connect.NewAuthServiceClient(httpClient, ts.URL)
	if _, err := authClient.Login(context.Background(), connect.NewRequest(&corev1.LoginRequest{
		Name:     "admin",
		Password: encryptLoginPassword(t, password),
		Language: "zh",
	})); err != nil {
		t.Fatalf("Login: %v", err)
	}

	transferClient := agentv1connect.NewFileTransferServiceClient(
		httpClient,
		ts.URL,
		connect.WithInterceptors(csrfInterceptor(t, jar, ts.URL)),
	)
	dir := t.TempDir()
	ticket, err := transferClient.CreateUploadTicket(context.Background(), connect.NewRequest(&agentv1.CreateUploadTicketRequest{
		Dir:      dir,
		Filename: "ticket.txt",
		Size:     32,
	}))
	if err != nil {
		t.Fatalf("CreateUploadTicket: %v", err)
	}

	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/files/upload", strings.NewReader("ticket-body"))
	req.Header.Set("X-File-Ticket", ticket.Msg.GetToken())
	resp, err := httpClient.Do(req)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("upload status = %d (%s)", resp.StatusCode, body)
	}

	content, err := os.ReadFile(filepath.Join(dir, "ticket.txt"))
	if err != nil {
		t.Fatalf("读取上传文件失败: %v", err)
	}
	if string(content) != "ticket-body" {
		t.Fatalf("content = %q, want ticket-body", content)
	}
}

// TestTerminalWSRequiresLogin 验证 /ws/terminal 在未登录时返回 401 而不是升级连接。
func TestTerminalWSRequiresLogin(t *testing.T) {
	setupSingleProcess(t)

	handler := server.New(server.Options{
		Logger:     slog.New(slog.NewTextHandler(io.Discard, nil)),
		Services:   transport.Services(),
		TerminalWS: transport.TerminalWSHandler(),
	})
	ts := httptest.NewServer(handler)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/ws/terminal?kind=local")
	if err != nil {
		t.Fatalf("GET /ws/terminal: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, 期望 401", resp.StatusCode)
	}
}

// TestTerminalWSWithLoginNonUpgrade 验证登录后访问非 WebSocket 请求不会报错。
func TestTerminalWSWithLoginNonUpgrade(t *testing.T) {
	password := setupSingleProcess(t)

	handler := server.New(server.Options{
		Logger:     slog.New(slog.NewTextHandler(io.Discard, nil)),
		Services:   transport.Services(),
		TerminalWS: transport.TerminalWSHandler(),
	})
	ts := httptest.NewServer(handler)
	defer ts.Close()

	jar, _ := cookiejar.New(nil)
	httpClient := &http.Client{Jar: jar}
	authClient := corev1connect.NewAuthServiceClient(httpClient, ts.URL)
	if _, err := authClient.Login(context.Background(), connect.NewRequest(&corev1.LoginRequest{
		Name:     "admin",
		Password: encryptLoginPassword(t, password),
		Language: "zh",
	})); err != nil {
		t.Fatalf("Login: %v", err)
	}

	resp, err := httpClient.Get(ts.URL + "/ws/terminal?kind=local")
	if err != nil {
		t.Fatalf("GET /ws/terminal: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d (%s), 期望 200", resp.StatusCode, body)
	}
}

// TestMCPEndpointMounted 验证 /mcp 已挂载且未登录时不是 404。
func TestMCPEndpointMounted(t *testing.T) {
	setupSingleProcess(t)

	handler := server.New(server.Options{
		Logger:     slog.New(slog.NewTextHandler(io.Discard, nil)),
		Services:   transport.Services(),
		MCPHandler: transport.MCPHandler(),
	})
	ts := httptest.NewServer(handler)
	defer ts.Close()

	resp, err := http.Post(ts.URL+"/mcp", "application/json", strings.NewReader(`{}`))
	if err != nil {
		t.Fatalf("POST /mcp: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		t.Fatal("/mcp 返回 404，路由器未挂载")
	}
}

// TestContainerLogsRequiresLogin 验证容器日志 SSE 通道在未登录时返回 401。
func TestContainerLogsRequiresLogin(t *testing.T) {
	setupSingleProcess(t)

	handler := server.New(server.Options{
		Logger:        slog.New(slog.NewTextHandler(io.Discard, nil)),
		Services:      transport.Services(),
		ContainerLogs: transport.ContainerLogsHandler(),
	})
	ts := httptest.NewServer(handler)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/api/v2/containers/search/log?container=missing")
	if err != nil {
		t.Fatalf("GET container logs: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, 期望 401", resp.StatusCode)
	}
}
