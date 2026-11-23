package core

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"connectrpc.com/connect"
	"github.com/gin-gonic/gin"

	corev1 "mypanel/proto/gen/go/panel/core/v1"

	"mypanel/master/internal/transport/bridge"
)

// TestCoreCommandsAndGroups 验证命令与分组的增查删链路。
func TestCoreCommandsAndGroups(t *testing.T) {
	setupSettingCore(t)

	ctx := context.Background()
	commander := NewCommandServer()
	if _, err := commander.Create(ctx, connect.NewRequest(&corev1.CreateCommandRequest{
		Type: "command", Name: "ls", Command: "ls -al",
	})); err != nil {
		t.Fatalf("Create command: %v", err)
	}
	list, err := commander.List(ctx, connect.NewRequest(&corev1.ListCommandsRequest{Type: "command"}))
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list.Msg.GetItems()) != 1 || list.Msg.GetItems()[0].GetName() != "ls" {
		t.Fatalf("命令列表不正确: %+v", list.Msg.GetItems())
	}
	tree, err := commander.Tree(ctx, connect.NewRequest(&corev1.CommandTreeRequest{Type: "command"}))
	if err != nil {
		t.Fatalf("Tree: %v", err)
	}
	if tree.Msg.GetItems() == nil {
		t.Fatal("tree items 为 nil")
	}

	groups := NewGroupServer()
	if _, err := groups.Create(ctx, connect.NewRequest(&corev1.CreateGroupRequest{
		Name: "运维", Type: "command",
	})); err != nil {
		t.Fatalf("Create group: %v", err)
	}
	groupList, err := groups.List(ctx, connect.NewRequest(&corev1.ListGroupsRequest{Type: "command"}))
	if err != nil {
		t.Fatalf("List groups: %v", err)
	}
	found := false
	for _, item := range groupList.Msg.GetItems() {
		if item.GetName() == "运维" {
			found = true
			if _, err := groups.Delete(ctx, connect.NewRequest(&corev1.DeleteGroupRequest{Id: item.GetId()})); err != nil {
				t.Fatalf("Delete group: %v", err)
			}
		}
	}
	if !found {
		t.Fatalf("未找到新分组: %+v", groupList.Msg.GetItems())
	}
}

// TestCoreCommandExport 验证导出返回文件路径。
func TestCoreCommandExport(t *testing.T) {
	setupSettingCore(t)

	commander := NewCommandServer()
	resp, err := commander.Export(context.Background(), connect.NewRequest(&corev1.ExportCommandsRequest{}))
	if err != nil {
		t.Fatalf("Export: %v", err)
	}
	if resp.Msg.GetPath() == "" {
		t.Fatal("导出路径为空")
	}
}

// TestCoreCommandSearchRejectsBadOrder 验证非法排序参数被拒绝。
func TestCoreCommandSearchRejectsBadOrder(t *testing.T) {
	setupSettingCore(t)

	commander := NewCommandServer()
	_, err := commander.Search(context.Background(), connect.NewRequest(&corev1.SearchCommandsRequest{
		Page: 1, PageSize: 10, OrderBy: "bad", Order: "bad", Type: "command",
	}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestCoreBackupAccountsTolerant 验证备份账号接口的容错行为。
func TestCoreBackupAccountsTolerant(t *testing.T) {
	setupSettingCore(t)

	server := NewBackupServer()
	ctx := context.Background()
	if _, err := server.Delete(ctx, connect.NewRequest(&corev1.DeleteBackupRequest{Name: "missing"})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("delete: %T", err)
		}
	}
	info, err := server.GetClientInfo(ctx, connect.NewRequest(&corev1.GetBackupClientInfoRequest{ClientType: "onedrive"}))
	if err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("client info: %T", err)
		}
		return
	}
	if info.Msg.GetRedirectUri() == "" {
		t.Fatal("redirect_uri 为空")
	}
}

// TestCoreGenerateAPIKey 验证通过真实登录链路生成 API 密钥。
func TestCoreGenerateAPIKey(t *testing.T) {
	password := setupCore(t)

	header := http.Header{}
	header.Set("User-Agent", "api-key-test")
	c, recorder := bridge.New(context.Background(), header, "127.0.0.1:5000", http.MethodPost, "/rpc")
	ctx := bridge.WithGinContext(context.Background(), c)

	auth := NewAuthServer()
	if _, err := auth.Login(ctx, connect.NewRequest(&corev1.LoginRequest{
		Name:     "admin",
		Password: encryptLoginPassword(t, password),
		Language: "zh",
	})); err != nil {
		t.Fatalf("Login: %v", err)
	}

	// 把登录下发的 Cookie 带进后续请求，模拟浏览器的第二次调用。
	nextHeader := http.Header{}
	for _, cookie := range recorder.Header().Values("Set-Cookie") {
		nextHeader.Add("Cookie", strings.SplitN(cookie, ";", 2)[0])
	}
	nextHeader.Set("User-Agent", "api-key-test")
	nextCtx := bridge.WithGinContext(context.Background(), mustGinContext(t, nextHeader))

	resp, err := auth.GenerateAPIKey(nextCtx, connect.NewRequest(&corev1.GenerateAPIKeyRequest{}))
	if err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("错误类型 = %T", err)
		}
		return
	}
	if resp.Msg.GetApiKey() == "" {
		t.Fatal("api_key 为空")
	}
}

// mustGinContext 构造一个带请求头的合成 gin 上下文。
func mustGinContext(t *testing.T, header http.Header) *gin.Context {
	t.Helper()
	c, _ := bridge.New(context.Background(), header, "127.0.0.1:5000", http.MethodPost, "/rpc")
	return c
}
