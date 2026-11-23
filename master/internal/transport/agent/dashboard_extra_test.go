package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestDashboardNewQueries 验证首页新增查询接口可调用。
func TestDashboardNewQueries(t *testing.T) {
	setupSingleProcess(t)

	server := NewDashboardServer()
	launcher, err := server.GetAppLauncher(context.Background(), connect.NewRequest(&agentv1.GetAppLauncherRequest{}))
	if err != nil {
		t.Fatalf("GetAppLauncher: %v", err)
	}
	if launcher.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	options, err := server.GetLauncherOptions(context.Background(), connect.NewRequest(&agentv1.GetLauncherOptionsRequest{}))
	if err != nil {
		t.Fatalf("GetLauncherOptions: %v", err)
	}
	if options.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	current, err := server.GetNodeCurrent(context.Background(), connect.NewRequest(&agentv1.GetNodeCurrentRequest{}))
	if err != nil {
		t.Fatalf("GetNodeCurrent: %v", err)
	}
	if current.Msg.GetCpuTotal() < 0 {
		t.Fatal("cpu_total 不应为负")
	}

	for name, call := range map[string]func() error{
		"GetTopCPU": func() error {
			_, err := server.GetTopCPU(context.Background(), connect.NewRequest(&agentv1.GetTopCPURequest{}))
			return err
		},
		"GetTopMem": func() error {
			_, err := server.GetTopMem(context.Background(), connect.NewRequest(&agentv1.GetTopMemRequest{}))
			return err
		},
		"GetQuickDirectories": func() error {
			_, err := server.GetQuickDirectories(context.Background(), connect.NewRequest(&agentv1.GetQuickDirectoriesRequest{}))
			return err
		},
	} {
		if err := call(); err != nil {
			if _, ok := err.(*connect.Error); !ok {
				t.Fatalf("%s 错误类型 = %T", name, err)
			}
		}
	}
}

// TestDashboardBadInputs 验证非法 JSON 被拒绝。
func TestDashboardBadInputs(t *testing.T) {
	setupSingleProcess(t)

	server := NewDashboardServer()
	if _, err := server.ChangeQuickJump(context.Background(), connect.NewRequest(&agentv1.ChangeQuickJumpRequest{
		QuicksJson: "{not-json",
	})); err == nil {
		t.Fatal("非法 JSON 应返回错误")
	} else if connectErr, ok := err.(*connect.Error); !ok || connectErr.Code() != connect.CodeInvalidArgument {
		t.Fatalf("err = %v, 期望 invalid_argument", err)
	}
}

// TestDashboardQuickDirectoryLifecycle 验证快捷目录的增删改查。
func TestDashboardQuickDirectoryLifecycle(t *testing.T) {
	setupSingleProcess(t)

	server := NewDashboardServer()
	created, err := server.CreateQuickDirectory(context.Background(), connect.NewRequest(&agentv1.CreateQuickDirectoryRequest{
		Path:  "/tmp/dashboard-quick",
		Alias: "临时目录",
	}))
	if err != nil {
		t.Fatalf("CreateQuickDirectory: %v", err)
	}
	if created.Msg.GetPath() != "/tmp/dashboard-quick" {
		t.Fatalf("path = %q", created.Msg.GetPath())
	}

	updated, err := server.UpdateQuickDirectory(context.Background(), connect.NewRequest(&agentv1.UpdateQuickDirectoryRequest{
		Id:    created.Msg.GetId(),
		Path:  "/tmp/dashboard-quick",
		Alias: "临时目录-改",
	}))
	if err != nil {
		t.Fatalf("UpdateQuickDirectory: %v", err)
	}
	if updated.Msg.GetAlias() != "临时目录-改" {
		t.Fatalf("alias = %q", updated.Msg.GetAlias())
	}

	if _, err := server.DeleteQuickDirectory(context.Background(), connect.NewRequest(&agentv1.DeleteQuickDirectoryRequest{
		Id: created.Msg.GetId(),
	})); err != nil {
		t.Fatalf("DeleteQuickDirectory: %v", err)
	}
}
