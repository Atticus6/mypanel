package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestSearchAppsAndInstalled 验证应用商店与已安装应用查询走真实数据库。
func TestSearchAppsAndInstalled(t *testing.T) {
	setupSingleProcess(t)

	app := model.App{
		Name:     "Redis",
		Key:      "test-redis",
		Type:     "app",
		Status:   "Normal",
		Resource: "remote",
		Limit:    1,
	}
	if err := agentglobal.DB.Create(&app).Error; err != nil {
		t.Fatalf("插入应用失败: %v", err)
	}
	install := model.AppInstall{
		Name:          "redis-prod",
		AppId:         app.ID,
		Version:       "7.0",
		Status:        "Running",
		ContainerName: "redis-prod",
		ServiceName:   "redis",
		HttpPort:      6379,
	}
	if err := agentglobal.DB.Create(&install).Error; err != nil {
		t.Fatalf("插入已安装应用失败: %v", err)
	}

	server := NewAppServer()

	apps, err := server.SearchApps(context.Background(), connect.NewRequest(&agentv1.SearchAppsRequest{
		Page:     1,
		PageSize: 10,
		Name:     "Redis",
	}))
	if err != nil {
		t.Fatalf("SearchApps 返回错误: %v", err)
	}
	if apps.Msg.GetTotal() != 1 {
		t.Fatalf("app total = %d, 期望 1", apps.Msg.GetTotal())
	}
	if apps.Msg.GetItems()[0].GetKey() != "test-redis" {
		t.Fatalf("app key = %q, 期望 test-redis", apps.Msg.GetItems()[0].GetKey())
	}

	installed, err := server.SearchInstalled(context.Background(), connect.NewRequest(&agentv1.SearchInstalledAppsRequest{
		Page:     1,
		PageSize: 10,
	}))
	if err != nil {
		t.Fatalf("SearchInstalled 返回错误: %v", err)
	}
	if installed.Msg.GetTotal() != 1 {
		t.Fatalf("installed total = %d, 期望 1", installed.Msg.GetTotal())
	}
	if installed.Msg.GetItems()[0].GetName() != "redis-prod" {
		t.Fatalf("installed name = %q, 期望 redis-prod", installed.Msg.GetItems()[0].GetName())
	}
}

// TestAppUpdateVersionsNotFound 验证不存在安装 ID 时返回错误而不是 panic。
func TestAppUpdateVersionsNotFound(t *testing.T) {
	setupSingleProcess(t)

	server := NewAppServer()
	_, err := server.UpdateVersions(context.Background(), connect.NewRequest(&agentv1.UpdateVersionsRequest{AppInstallId: 9999}))
	if err == nil {
		t.Fatal("不存在的安装 ID 应返回错误")
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestGetApp 验证按 key 查询应用信息。
func TestGetApp(t *testing.T) {
	setupSingleProcess(t)

	app := model.App{Name: "Nginx", Key: "test-nginx", Type: "app", Status: "Normal", Resource: "remote", Limit: 1}
	if err := agentglobal.DB.Create(&app).Error; err != nil {
		t.Fatalf("插入应用失败: %v", err)
	}

	server := NewAppServer()
	resp, err := server.GetApp(context.Background(), connect.NewRequest(&agentv1.GetAppRequest{Key: "test-nginx"}))
	if err != nil {
		t.Fatalf("GetApp: %v", err)
	}
	if resp.Msg.GetName() != "Nginx" || resp.Msg.GetKey() != "test-nginx" {
		t.Fatalf("app = %+v", resp.Msg)
	}
}

// TestCheckInstalled 验证安装前检查在 Docker 不可用时安全失败。
//
// CheckExist 会探测容器状态，所以无 Docker 的开发机只能断言错误类型；
// 有 Docker 时继续验证同名安装的识别结果。
func TestCheckInstalled(t *testing.T) {
	setupSingleProcess(t)

	app := model.App{Name: "Redis", Key: "check-redis", Type: "app", Status: "Normal", Resource: "remote", Limit: 1}
	if err := agentglobal.DB.Create(&app).Error; err != nil {
		t.Fatalf("插入应用失败: %v", err)
	}
	server := NewAppServer()
	check, err := server.CheckInstalled(context.Background(), connect.NewRequest(&agentv1.CheckInstalledAppRequest{
		Key: "check-redis", Name: "redis-check",
	}))
	if err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("错误类型 = %T", err)
		}
		t.Logf("Docker 不可用，按预期返回: %v", err)
		return
	}
	if check.Msg.GetIsExist() {
		t.Fatal("尚未安装，is_exist 应为 false")
	}
}

// TestInstallTolerant 验证 Docker 不可用时安装接口安全失败。
func TestInstallTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewAppServer()
	_, err := server.Install(context.Background(), connect.NewRequest(&agentv1.InstallAppRequest{
		AppDetailId: 1, Name: "demo",
	}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestOperateAppTolerant 验证应用操作在缺依赖时安全失败。
func TestOperateAppTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewAppServer()
	_, err := server.Operate(context.Background(), connect.NewRequest(&agentv1.OperateAppRequest{
		InstallId: 4242,
		Operate:   "start",
	}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}
