package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestAppTagsAndIgnoreUpgrade 验证标签查询与忽略升级的增删。
func TestAppTagsAndIgnoreUpgrade(t *testing.T) {
	setupSingleProcess(t)

	server := NewAppServer()
	tags, err := server.GetAppTags(context.Background(), connect.NewRequest(&agentv1.GetAppTagsRequest{}))
	if err != nil {
		t.Fatalf("GetAppTags: %v", err)
	}
	if tags.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	app := model.App{Name: "Redis", Key: "test-ignore-redis", Type: "app", Status: "Normal", Limit: 1}
	if err := agentglobal.DB.Create(&app).Error; err != nil {
		t.Fatalf("插入应用失败: %v", err)
	}
	if _, err := server.IgnoreAppUpgrade(context.Background(), connect.NewRequest(&agentv1.IgnoreAppUpgradeRequest{
		AppId: uint32(app.ID),
		Scope: "all",
	})); err != nil {
		t.Fatalf("IgnoreAppUpgrade: %v", err)
	}

	list, err := server.ListIgnoredApps(context.Background(), connect.NewRequest(&agentv1.ListIgnoredAppsRequest{}))
	if err != nil {
		t.Fatalf("ListIgnoredApps: %v", err)
	}
	if len(list.Msg.GetItems()) != 1 {
		t.Fatalf("items = %d, 期望 1", len(list.Msg.GetItems()))
	}
	record := list.Msg.GetItems()[0]
	if record.GetAppId() != uint32(app.ID) || record.GetScope() != "all" {
		t.Fatalf("record = %+v, 期望 app_id=%d scope=all", record, app.ID)
	}

	if _, err := server.CancelIgnoreAppUpgrade(context.Background(), connect.NewRequest(&agentv1.CancelIgnoreAppUpgradeRequest{
		Id: record.GetId(),
	})); err != nil {
		t.Fatalf("CancelIgnoreAppUpgrade: %v", err)
	}
	list, err = server.ListIgnoredApps(context.Background(), connect.NewRequest(&agentv1.ListIgnoredAppsRequest{}))
	if err != nil {
		t.Fatalf("ListIgnoredApps after cancel: %v", err)
	}
	if len(list.Msg.GetItems()) != 0 {
		t.Fatalf("items = %d, 期望 0", len(list.Msg.GetItems()))
	}
}

// TestInstalledBriefAndInfo 验证已安装摘要、运行信息与删除前检查。
func TestInstalledBriefAndInfo(t *testing.T) {
	setupSingleProcess(t)

	app := model.App{Name: "Nginx", Key: "test-nginx-brief", Type: "app", Status: "Normal", Limit: 1}
	if err := agentglobal.DB.Create(&app).Error; err != nil {
		t.Fatalf("插入应用失败: %v", err)
	}
	install := model.AppInstall{
		Name:          "nginx-brief",
		AppId:         app.ID,
		Version:       "1.25",
		Status:        "Running",
		ContainerName: "nginx-brief",
		ServiceName:   "nginx",
		HttpPort:      8080,
		Env:           "{}",
	}
	if err := agentglobal.DB.Create(&install).Error; err != nil {
		t.Fatalf("插入已安装应用失败: %v", err)
	}

	server := NewAppServer()
	list, err := server.ListInstalled(context.Background(), connect.NewRequest(&agentv1.ListInstalledRequest{}))
	if err != nil {
		t.Fatalf("ListInstalled: %v", err)
	}
	found := false
	for _, item := range list.Msg.GetItems() {
		if item.GetName() == "nginx-brief" {
			found = true
		}
	}
	if !found {
		t.Fatalf("items = %+v, 期望包含 nginx-brief", list.Msg.GetItems())
	}

	info, err := server.GetInstalledInfo(context.Background(), connect.NewRequest(&agentv1.GetInstalledInfoRequest{
		AppInstallId: uint32(install.ID),
	}))
	if err != nil {
		t.Fatalf("GetInstalledInfo: %v", err)
	}
	if info.Msg.GetName() != "nginx-brief" || info.Msg.GetHttpPort() != 8080 {
		t.Fatalf("info = %+v, 期望 nginx-brief/8080", info.Msg)
	}

	if _, err := server.CheckDeleteInstalled(context.Background(), connect.NewRequest(&agentv1.CheckDeleteInstalledRequest{
		AppInstallId: uint32(install.ID),
	})); err != nil {
		t.Fatalf("CheckDeleteInstalled: %v", err)
	}
}

// TestAppQueriesTolerant 验证不存在资源时的查询只返回 Connect 错误。
func TestAppQueriesTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewAppServer()
	calls := map[string]func() error{
		"GetAppDetailByID": func() error {
			_, err := server.GetAppDetailByID(context.Background(), connect.NewRequest(&agentv1.GetAppDetailByIDRequest{Id: 999999}))
			return err
		},
		"GetInstalledParams": func() error {
			_, err := server.GetInstalledParams(context.Background(), connect.NewRequest(&agentv1.GetInstalledParamsRequest{AppInstallId: 999999}))
			return err
		},
		"LoadAppPort": func() error {
			_, err := server.LoadAppPort(context.Background(), connect.NewRequest(&agentv1.LoadAppPortRequest{Type: "runtime"}))
			return err
		},
		"LoadAppConnInfo": func() error {
			_, err := server.LoadAppConnInfo(context.Background(), connect.NewRequest(&agentv1.LoadAppConnInfoRequest{Type: "runtime"}))
			return err
		},
		"ChangeAppPort": func() error {
			_, err := server.ChangeAppPort(context.Background(), connect.NewRequest(&agentv1.ChangeAppPortRequest{Port: 8080}))
			return err
		},
		"GetAppServices": func() error {
			_, err := server.GetAppServices(context.Background(), connect.NewRequest(&agentv1.GetAppServicesRequest{Key: "missing"}))
			return err
		},
	}
	for name, call := range calls {
		if err := call(); err != nil {
			if _, ok := err.(*connect.Error); !ok {
				t.Fatalf("%s 错误类型 = %T", name, err)
			}
		}
	}
}

// TestUpdateInstalledRejectsBadPayload 验证参数更新在 JSON 非法时返回参数错误。
func TestUpdateInstalledRejectsBadPayload(t *testing.T) {
	setupSingleProcess(t)

	server := NewAppServer()
	_, err := server.UpdateInstalled(context.Background(), connect.NewRequest(&agentv1.UpdateInstalledRequest{
		InstallId:   1,
		PayloadJson: "{not-json",
	}))
	if err == nil {
		t.Fatal("非法 JSON 应返回错误")
	}
	connectErr, ok := err.(*connect.Error)
	if !ok {
		t.Fatalf("错误类型 = %T", err)
	}
	if connectErr.Code() != connect.CodeInvalidArgument {
		t.Fatalf("code = %v, 期望 invalid_argument", connectErr.Code())
	}
}
