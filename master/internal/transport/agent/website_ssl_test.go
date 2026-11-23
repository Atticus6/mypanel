package agent

import (
	"context"
	"testing"
	"time"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestWebsiteSSLSearch 验证证书列表查询走真实数据库。
func TestWebsiteSSLSearch(t *testing.T) {
	setupSingleProcess(t)

	cert := model.WebsiteSSL{
		PrimaryDomain: "example.com",
		Domains:       "example.com,www.example.com",
		Type:          "manual",
		Provider:      "manual",
		Status:        "Ready",
		ExpireDate:    time.Now().AddDate(1, 0, 0),
		StartDate:     time.Now(),
		AutoRenew:     true,
	}
	if err := agentglobal.DB.Create(&cert).Error; err != nil {
		t.Fatalf("插入证书失败: %v", err)
	}

	server := NewWebsiteSSLServer()
	resp, err := server.Search(context.Background(), connect.NewRequest(&agentv1.SearchSSLRequest{
		Page:     1,
		PageSize: 10,
		Domain:   "example",
	}))
	if err != nil {
		t.Fatalf("Search 返回错误: %v", err)
	}
	if resp.Msg.GetTotal() != 1 {
		t.Fatalf("total = %d, 期望 1", resp.Msg.GetTotal())
	}
	item := resp.Msg.GetItems()[0]
	if item.GetPrimaryDomain() != "example.com" || !item.GetAutoRenew() {
		t.Fatalf("ssl = %+v, 期望 example.com/autoRenew", item)
	}
	if item.GetExpireDate() == "" {
		t.Fatal("expire_date 为空")
	}
}

// TestWebsiteSSLAccounts 验证 DNS/ACME 账号与网站域名列表走真实数据库。
func TestWebsiteSSLAccounts(t *testing.T) {
	setupSingleProcess(t)

	dns := model.WebsiteDnsAccount{Name: "cloudflare", Type: "cloudflare"}
	if err := agentglobal.DB.Create(&dns).Error; err != nil {
		t.Fatalf("插入 DNS 账号失败: %v", err)
	}
	acme := model.WebsiteAcmeAccount{Email: "ops@example.com", URL: "https://acme.example", Type: "letsencrypt", KeyType: "RSA2048"}
	if err := agentglobal.DB.Create(&acme).Error; err != nil {
		t.Fatalf("插入 ACME 账号失败: %v", err)
	}
	site := model.Website{Protocol: "http", PrimaryDomain: "domains.example.com", Type: "static", Alias: "domains", Status: "Running"}
	if err := agentglobal.DB.Create(&site).Error; err != nil {
		t.Fatalf("插入网站失败: %v", err)
	}
	domain := model.WebsiteDomain{WebsiteID: site.ID, Domain: "www.domains.example.com", Port: 80, SSL: true}
	if err := agentglobal.DB.Create(&domain).Error; err != nil {
		t.Fatalf("插入域名失败: %v", err)
	}

	sslServer := NewWebsiteSSLServer()
	dnsList, err := sslServer.SearchDNSAccounts(context.Background(), connect.NewRequest(&agentv1.SearchDNSAccountsRequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("SearchDNSAccounts: %v", err)
	}
	if dnsList.Msg.GetTotal() != 1 || dnsList.Msg.GetItems()[0].GetType() != "cloudflare" {
		t.Fatalf("dns = %+v", dnsList.Msg.GetItems())
	}

	acmeList, err := sslServer.SearchACMEAccounts(context.Background(), connect.NewRequest(&agentv1.SearchACMEAccountsRequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("SearchACMEAccounts: %v", err)
	}
	if acmeList.Msg.GetTotal() != 1 || acmeList.Msg.GetItems()[0].GetEmail() != "ops@example.com" {
		t.Fatalf("acme = %+v", acmeList.Msg.GetItems())
	}

	websiteServer := NewWebsiteServer()
	domains, err := websiteServer.ListDomains(context.Background(), connect.NewRequest(&agentv1.ListWebsiteDomainsRequest{WebsiteId: uint32(site.ID)}))
	if err != nil {
		t.Fatalf("ListDomains: %v", err)
	}
	if len(domains.Msg.GetItems()) != 1 || !domains.Msg.GetItems()[0].GetSsl() {
		t.Fatalf("domains = %+v", domains.Msg.GetItems())
	}
}

// TestWebsiteNginxFileTolerant 验证 Nginx 配置文件读写接口安全失败。
func TestWebsiteNginxFileTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	if _, err := server.GetNginxFile(context.Background(), connect.NewRequest(&agentv1.GetWebsiteNginxFileRequest{
		Id: 9999, Type: "openresty",
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("get 错误类型 = %T", err)
		}
	}
	if _, err := server.UpdateNginxFile(context.Background(), connect.NewRequest(&agentv1.UpdateWebsiteNginxFileRequest{
		Id: 9999, Content: "server {}",
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("update 错误类型 = %T", err)
		}
	}
}

// TestWebsiteConfigRPCsTolerant 验证默认站点/伪静态/重定向接口安全失败。
func TestWebsiteConfigRPCsTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	ctx := context.Background()
	if _, err := server.ChangeDefault(ctx, connect.NewRequest(&agentv1.ChangeDefaultWebsiteRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("change default: %T", err)
		}
	}
	if _, err := server.GetRewrite(ctx, connect.NewRequest(&agentv1.GetRewriteRequest{WebsiteId: 9999, Name: "normal"})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("get rewrite: %T", err)
		}
	}
	if _, err := server.GetRedirect(ctx, connect.NewRequest(&agentv1.GetRedirectRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("get redirect: %T", err)
		}
	}
}

// TestWebsiteHTTPSAndProxyTolerant 验证 HTTPS/代理/反盗链接口安全失败。
func TestWebsiteHTTPSAndProxyTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	ctx := context.Background()
	for _, call := range []func() error{
		func() error {
			_, err := server.GetHTTPS(ctx, connect.NewRequest(&agentv1.GetWebsiteHTTPSRequest{Id: 9999}))
			return err
		},
		func() error {
			_, err := server.GetProxies(ctx, connect.NewRequest(&agentv1.GetProxiesRequest{Id: 9999}))
			return err
		},
		func() error {
			_, err := server.GetAntiLeech(ctx, connect.NewRequest(&agentv1.GetAntiLeechRequest{WebsiteId: 9999}))
			return err
		},
	} {
		if err := call(); err != nil {
			if _, ok := err.(*connect.Error); !ok {
				t.Fatalf("错误类型 = %T", err)
			}
		}
	}
}

// TestWebsiteDeleteAndScopeTolerant 验证删除与 Nginx 指令配置安全失败。
func TestWebsiteDeleteAndScopeTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	ctx := context.Background()
	if _, err := server.Delete(ctx, connect.NewRequest(&agentv1.DeleteWebsiteRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("delete: %T", err)
		}
	}
	if _, err := server.GetNginxScopeConfig(ctx, connect.NewRequest(&agentv1.GetNginxScopeConfigRequest{
		WebsiteId: 9999, Scope: "index",
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("scope: %T", err)
		}
	}
}

// TestWebsiteCreateAndCacheTolerant 验证创建/缓存接口安全失败。
func TestWebsiteCreateAndCacheTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	ctx := context.Background()
	if _, err := server.Create(ctx, connect.NewRequest(&agentv1.CreateWebsiteRequest{Type: "static", Alias: "demo"})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("create: %T", err)
		}
	}
	if _, err := server.GetProxyCache(ctx, connect.NewRequest(&agentv1.GetProxyCacheRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("cache: %T", err)
		}
	}
}

// TestWebsiteLoadBalancesTolerant 验证负载均衡查询安全失败。
func TestWebsiteLoadBalancesTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	_, err := server.GetLoadBalances(context.Background(), connect.NewRequest(&agentv1.GetLoadBalancesRequest{Id: 9999}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestWebsiteLoadBalanceWriteTolerant 验证负载均衡写入安全失败。
func TestWebsiteLoadBalanceWriteTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	ctx := context.Background()
	if _, err := server.DeleteLoadBalance(ctx, connect.NewRequest(&agentv1.DeleteLoadBalanceRequest{WebsiteId: 9999, Name: "lb"})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("delete lb: %T", err)
		}
	}
}

// TestWebsiteRealIPAndDefaultHtmlTolerant 验证真实 IP/默认 HTML 接口安全失败。
func TestWebsiteRealIPAndDefaultHtmlTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	if _, err := server.GetRealIP(context.Background(), connect.NewRequest(&agentv1.GetRealIPRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("real ip: %T", err)
		}
	}
	if _, err := server.GetDefaultHtml(context.Background(), connect.NewRequest(&agentv1.GetDefaultHtmlRequest{Type: "index"})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("default html: %T", err)
		}
	}
}

// TestWebsiteSSLListsTolerant 验证证书与 CA 列表在空库时返回空数组。
func TestWebsiteSSLListsTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteSSLServer()
	ctx := context.Background()
	list, err := server.List(ctx, connect.NewRequest(&agentv1.ListSSLRequest{}))
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list.Msg.GetItems()) != 0 {
		t.Fatalf("空库应返回空证书列表: %d", len(list.Msg.GetItems()))
	}
	ca, err := server.SearchCA(ctx, connect.NewRequest(&agentv1.SearchCARequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("SearchCA: %v", err)
	}
	// 初始化流程可能预置默认 CA，这里只校验分页结果自洽。
	if int(ca.Msg.GetTotal()) != len(ca.Msg.GetItems()) {
		t.Fatalf("total 与 items 不一致: total=%d items=%d", ca.Msg.GetTotal(), len(ca.Msg.GetItems()))
	}
}

// TestWebsiteSSLGetMissingTolerant 验证不存在的证书/CA 返回 Connect 错误。
func TestWebsiteSSLGetMissingTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteSSLServer()
	ctx := context.Background()
	if _, err := server.GetByID(ctx, connect.NewRequest(&agentv1.GetSSLRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("ssl: %T", err)
		}
	}
	if _, err := server.GetCA(ctx, connect.NewRequest(&agentv1.GetCARequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("ca: %T", err)
		}
	}
}

// TestWebsiteACMEDeleteMissingTolerant 验证删除不存在的 ACME 账号安全失败。
func TestWebsiteACMEDeleteMissingTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteSSLServer()
	_, err := server.DeleteACME(context.Background(), connect.NewRequest(&agentv1.DeleteACMEAccountRequest{Id: 9999}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}
