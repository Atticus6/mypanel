package core

import (
	"context"
	"net/http"
	"testing"

	"connectrpc.com/connect"

	"mypanel/master/internal/bootstrap"
	"mypanel/master/internal/transport/bridge"
	corev1 "mypanel/proto/gen/go/panel/core/v1"
)

// setupSettingCore 启动一次 core，用于读取系统设置。
//
// 设置项由初始化流程写入数据库，所以必须走 InitCore 而不能只构造 server。
func setupSettingCore(t *testing.T) {
	t.Helper()
	err := bootstrap.InitCore(bootstrap.CoreOptions{
		DataDir:       t.TempDir(),
		Version:       "v2.5.1-test",
		AdminUser:     "admin",
		AdminPassword: "pppppppppppp",
		Mode:          "stable",
		Language:      "zh",
	})
	if err != nil {
		t.Fatalf("InitCore: %v", err)
	}
}

// TestGetSettingInfo 验证完整设置按字段映射到 proto。
func TestGetSettingInfo(t *testing.T) {
	setupSettingCore(t)

	server := NewSettingServer()
	resp, err := server.GetInfo(context.Background(), connect.NewRequest(&corev1.GetSettingInfoRequest{}))
	if err != nil {
		t.Fatalf("GetInfo: %v", err)
	}
	if resp.Msg.GetSystemVersion() != "v2.5.1-test" {
		t.Fatalf("system_version = %q, 期望 v2.5.1-test", resp.Msg.GetSystemVersion())
	}
	if resp.Msg.GetPanelName() == "" {
		t.Fatal("panel_name 为空")
	}
}

// TestUpdateAndGetMemo 验证备忘录写入后可读回。
func TestUpdateAndGetMemo(t *testing.T) {
	setupSettingCore(t)

	server := NewSettingServer()
	if _, err := server.UpdateMemo(context.Background(), connect.NewRequest(&corev1.UpdateMemoRequest{Content: "记事"})); err != nil {
		t.Fatalf("UpdateMemo: %v", err)
	}
	resp, err := server.GetMemo(context.Background(), connect.NewRequest(&corev1.GetMemoRequest{}))
	if err != nil {
		t.Fatalf("GetMemo: %v", err)
	}
	if resp.Msg.GetContent() != "记事" {
		t.Fatalf("memo = %q, 期望 记事", resp.Msg.GetContent())
	}
}

// TestUpdateSettingKey 验证单项设置写入落到数据库。
func TestUpdateSettingKey(t *testing.T) {
	setupSettingCore(t)

	c, _ := bridge.New(context.Background(), http.Header{}, "", http.MethodPost, "/rpc")
	ctx := bridge.WithGinContext(context.Background(), c)

	server := NewSettingServer()
	if _, err := server.UpdateSetting(ctx, connect.NewRequest(&corev1.UpdateSettingRequest{
		Key: "PanelName", Value: "mypanel",
	})); err != nil {
		t.Fatalf("UpdateSetting: %v", err)
	}
	resp, err := server.GetBaseInfo(context.Background(), connect.NewRequest(&corev1.GetSettingBaseInfoRequest{}))
	if err != nil {
		t.Fatalf("GetBaseInfo: %v", err)
	}
	if resp.Msg.GetPanelName() != "mypanel" {
		t.Fatalf("panel_name = %q, 期望 mypanel", resp.Msg.GetPanelName())
	}
}

// TestGetInterfaceAddresses 验证访问地址列表非空。
func TestGetInterfaceAddresses(t *testing.T) {
	setupSettingCore(t)

	server := NewSettingServer()
	resp, err := server.GetInterface(context.Background(), connect.NewRequest(&corev1.GetInterfaceRequest{}))
	if err != nil {
		t.Fatalf("GetInterface: %v", err)
	}
	if len(resp.Msg.GetAddrs()) == 0 {
		t.Fatal("addrs 为空")
	}
}

// TestGetSystemAvailable 验证可用性探测始终返回成功。
func TestGetSystemAvailable(t *testing.T) {
	setupSettingCore(t)

	server := NewSettingServer()
	if _, err := server.GetSystemAvailable(context.Background(), connect.NewRequest(&corev1.GetSystemAvailableRequest{})); err != nil {
		t.Fatalf("GetSystemAvailable: %v", err)
	}
}

// TestGetTerminalInfo 验证终端设置可读。
func TestGetTerminalInfo(t *testing.T) {
	setupSettingCore(t)

	server := NewSettingServer()
	resp, err := server.GetTerminal(context.Background(), connect.NewRequest(&corev1.GetTerminalRequest{}))
	if err != nil {
		t.Fatalf("GetTerminal: %v", err)
	}
	if resp.Msg.GetFontSize() == "" {
		t.Fatal("font_size 为空")
	}
}

// TestGetSSLInfo 验证默认（未开启 HTTPS）时返回空结构而不是报错。
func TestGetSSLInfo(t *testing.T) {
	setupSettingCore(t)

	server := NewSettingServer()
	resp, err := server.GetSSLInfo(context.Background(), connect.NewRequest(&corev1.GetSSLInfoRequest{}))
	if err != nil {
		t.Fatalf("GetSSLInfo: %v", err)
	}
	if resp.Msg.GetDomain() != "" || resp.Msg.GetCert() != "" {
		t.Fatalf("未开启 HTTPS 时不应带证书信息: %+v", resp.Msg)
	}
}

// TestUpdateAppStoreConfig 验证应用商店开关写入后可读回。
func TestUpdateAppStoreConfig(t *testing.T) {
	setupSettingCore(t)

	server := NewSettingServer()
	if _, err := server.UpdateAppStoreConfig(context.Background(), connect.NewRequest(&corev1.UpdateAppStoreConfigRequest{
		Scope: "UpgradeBackup", Status: "Enable",
	})); err != nil {
		t.Fatalf("UpdateAppStoreConfig: %v", err)
	}
	resp, err := server.GetAppStoreConfig(context.Background(), connect.NewRequest(&corev1.GetAppStoreConfigRequest{}))
	if err != nil {
		t.Fatalf("GetAppStoreConfig: %v", err)
	}
	if resp.Msg.GetUpgradeBackup() != "Enable" {
		t.Fatalf("upgrade_backup = %q, 期望 Enable", resp.Msg.GetUpgradeBackup())
	}
}

// TestDefaultMenu 验证重置菜单不报错。
func TestDefaultMenu(t *testing.T) {
	setupSettingCore(t)

	server := NewSettingServer()
	if _, err := server.DefaultMenu(context.Background(), connect.NewRequest(&corev1.DefaultMenuRequest{})); err != nil {
		t.Fatalf("DefaultMenu: %v", err)
	}
}

// TestUpdateProxyTolerant 验证代理不可用时返回 Connect 错误而不是 panic。
//
// service 层会先探测代理是否可达，测试环境没有可用代理，
// 因此这里只断言错误被正确包装。
func TestUpdateProxyTolerant(t *testing.T) {
	setupSettingCore(t)

	server := NewSettingServer()
	_, err := server.UpdateProxy(context.Background(), connect.NewRequest(&corev1.UpdateProxyRequest{
		ProxyUrl: "http://127.0.0.1", ProxyType: "http", ProxyPort: "7890",
	}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestReloadSSLRejectsRemote 验证非本机调用被拒绝。
func TestReloadSSLRejectsRemote(t *testing.T) {
	setupSettingCore(t)

	c, _ := bridge.New(context.Background(), http.Header{}, "192.0.2.10:5000", http.MethodPost, "/rpc")
	ctx := bridge.WithGinContext(context.Background(), c)

	server := NewSettingServer()
	_, err := server.ReloadSSL(ctx, connect.NewRequest(&corev1.ReloadSSLRequest{}))
	if err == nil {
		t.Fatal("远程调用应被拒绝")
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}
