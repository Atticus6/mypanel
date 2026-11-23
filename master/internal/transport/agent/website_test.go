package agent

import (
	"context"
	"strings"
	"testing"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/bootstrap"
)

// setupSingleProcess 启动 core 与 agent，模拟 master 的真实初始化顺序。
func setupSingleProcess(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	if err := bootstrap.InitCore(bootstrap.CoreOptions{
		DataDir:       dir,
		Version:       "v2.5.1-test",
		AdminUser:     "admin",
		AdminPassword: strings.Repeat("x", 12),
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
}

// TestSearchAndGetWebsite 验证网站查询走真实数据库：
// 插入一条网站记录后，Search 能按名称命中，Get 能按 ID 取回同样的站点。
func TestSearchAndGetWebsite(t *testing.T) {
	setupSingleProcess(t)

	site := model.Website{
		Protocol:      "http",
		PrimaryDomain: "example.com",
		Type:          "static",
		Alias:         "example.com",
		Status:        "Running",
		SiteDir:       "index",
	}
	if err := agentglobal.DB.Create(&site).Error; err != nil {
		t.Fatalf("插入网站失败: %v", err)
	}

	server := NewWebsiteServer()

	list, err := server.Search(context.Background(), connect.NewRequest(&agentv1.SearchWebsitesRequest{
		Page:     1,
		PageSize: 10,
		Name:     "example",
	}))
	if err != nil {
		t.Fatalf("Search 返回错误: %v", err)
	}
	if list.Msg.GetTotal() != 1 {
		t.Fatalf("total = %d, 期望 1", list.Msg.GetTotal())
	}
	if len(list.Msg.GetItems()) != 1 {
		t.Fatalf("items = %d, 期望 1", len(list.Msg.GetItems()))
	}
	if got := list.Msg.GetItems()[0]; got.GetPrimaryDomain() != "example.com" || got.GetType() != "static" {
		t.Fatalf("item = %+v, 期望 example.com/static", got)
	}

	detail, err := server.Get(context.Background(), connect.NewRequest(&agentv1.GetWebsiteRequest{
		Id: uint32(site.ID),
	}))
	if err != nil {
		t.Fatalf("Get 返回错误: %v", err)
	}
	if detail.Msg.GetPrimaryDomain() != "example.com" {
		t.Fatalf("primary_domain = %q, 期望 example.com", detail.Msg.GetPrimaryDomain())
	}
	if detail.Msg.GetSitePath() == "" {
		t.Fatal("site_path 为空，详情没有带上站点目录")
	}
}

// TestSearchWebsiteNotFound 验证不存在的 ID 映射为 NotFound。
func TestGetWebsiteNotFound(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	_, err := server.Get(context.Background(), connect.NewRequest(&agentv1.GetWebsiteRequest{Id: 9999}))
	if err == nil {
		t.Fatal("不存在的网站应返回错误")
	}
	connectErr, ok := err.(*connect.Error)
	if !ok {
		t.Fatalf("错误类型 = %T, 期望 *connect.Error", err)
	}
	if connectErr.Code() != connect.CodeNotFound {
		t.Fatalf("code = %v, 期望 not_found", connectErr.Code())
	}
}

// TestWebsiteManageTolerant 验证网站详情/列表/操作在空库时安全失败或返回空列表。
func TestWebsiteManageTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	ctx := context.Background()
	if _, err := server.GetWebsite(ctx, connect.NewRequest(&agentv1.GetWebsiteRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("get: %T", err)
		}
	}
	list, err := server.List(ctx, connect.NewRequest(&agentv1.ListWebsitesRequest{}))
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list.Msg.GetItems()) != 0 {
		t.Fatalf("空库应返回空列表: %d", len(list.Msg.GetItems()))
	}
	options, err := server.Options(ctx, connect.NewRequest(&agentv1.WebsiteOptionsRequest{}))
	if err != nil {
		t.Fatalf("Options: %v", err)
	}
	if len(options.Msg.GetItems()) != 0 {
		t.Fatalf("空库应返回空选项: %d", len(options.Msg.GetItems()))
	}
}

// TestWebsiteCustomRewrite 验证自定义伪静态列表可读。
func TestWebsiteCustomRewrite(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	resp, err := server.ListCustomRewrite(context.Background(), connect.NewRequest(&agentv1.ListCustomRewriteRequest{}))
	if err != nil {
		t.Fatalf("ListCustomRewrite: %v", err)
	}
	if resp.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}
}

// TestWebsiteProxyAndAuthTolerant 验证代理/认证/域名接口在空库时安全失败。
func TestWebsiteProxyAndAuthTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	ctx := context.Background()
	checks := []func() error{
		func() error {
			_, err := server.DeleteProxy(ctx, connect.NewRequest(&agentv1.DeleteProxyRequest{Id: 9999, Name: "x"}))
			return err
		},
		func() error {
			_, err := server.ClearProxyCache(ctx, connect.NewRequest(&agentv1.ClearProxyCacheRequest{WebsiteId: 9999}))
			return err
		},
		func() error {
			_, err := server.GetAuth(ctx, connect.NewRequest(&agentv1.GetAuthRequest{WebsiteId: 9999}))
			return err
		},
		func() error {
			_, err := server.DeleteDomain(ctx, connect.NewRequest(&agentv1.DeleteDomainRequest{Id: 9999}))
			return err
		},
		func() error {
			_, err := server.GetResource(ctx, connect.NewRequest(&agentv1.GetWebsiteResourceRequest{Id: 9999}))
			return err
		},
	}
	for i, check := range checks {
		if err := check(); err != nil {
			if _, ok := err.(*connect.Error); !ok {
				t.Fatalf("第 %d 项错误类型 = %T", i, err)
			}
		}
	}
}

// TestWebsiteDnsAndDatabaseTolerant 验证 DNS 账号与数据库接口的安全失败行为。
func TestWebsiteDnsAndDatabaseTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewWebsiteServer()
	ctx := context.Background()
	if _, err := server.DeleteDNSAccount(ctx, connect.NewRequest(&agentv1.DeleteDNSAccountRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("dns: %T", err)
		}
	}
	list, err := server.ListDatabases(ctx, connect.NewRequest(&agentv1.ListWebsiteDatabasesRequest{}))
	if err != nil {
		t.Fatalf("ListDatabases: %v", err)
	}
	if list.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}
	if _, err := server.UpdateProxy(ctx, connect.NewRequest(&agentv1.UpdateProxyRequest{
		Id: 9999, Operate: "create", Name: "p", Match: "/", ProxyPass: "http://127.0.0.1:1", ProxyHost: "$host",
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("proxy: %T", err)
		}
	}
	if _, err := server.OperateLog(ctx, connect.NewRequest(&agentv1.OperateWebsiteLogRequest{
		Id: 9999, Operate: "enable", LogType: "access.log",
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("log: %T", err)
		}
	}
}
