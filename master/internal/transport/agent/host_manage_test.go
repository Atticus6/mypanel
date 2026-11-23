package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentmodel "mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestHostManageTolerant 验证主机增删改与连通性测试在无 SSH 环境时安全失败。
func TestHostManageTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewHostServer()
	ctx := context.Background()
	if _, err := server.DeleteHosts(ctx, connect.NewRequest(&agentv1.DeleteHostsRequest{Ids: []uint32{9999}})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("delete: %T", err)
		}
	}
	if _, err := server.UpdateHostGroup(ctx, connect.NewRequest(&agentv1.UpdateHostGroupRequest{Id: 9999})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("group: %T", err)
		}
	}
	resp, err := server.TestByInfo(ctx, connect.NewRequest(&agentv1.TestHostInfoRequest{
		Addr: "127.0.0.1", Port: 1, User: "root", AuthMode: "password", Password: "x",
	}))
	if err != nil {
		t.Fatalf("TestByInfo: %v", err)
	}
	if resp.Msg.GetOk() {
		t.Fatal("不应连接到 127.0.0.1:1")
	}
}

// TestHostComponentAndDisks 验证组件检查与磁盘信息。
func TestHostComponentAndDisks(t *testing.T) {
	setupSingleProcess(t)

	server := NewHostServer()
	comp, err := server.CheckComponent(context.Background(), connect.NewRequest(&agentv1.CheckComponentRequest{Name: "sh"}))
	if err != nil {
		t.Fatalf("CheckComponent: %v", err)
	}
	if !comp.Msg.GetExists() {
		t.Fatalf("sh 应存在，path=%q error=%q", comp.Msg.GetPath(), comp.Msg.GetError())
	}
	// 测试机（macOS）没有 lsblk，磁盘接口应返回 Connect 错误而不是 panic。
	disks, err := server.GetDisks(context.Background(), connect.NewRequest(&agentv1.GetDisksRequest{}))
	if err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("GetDisks 错误类型 = %T", err)
		}
		return
	}
	if disks.Msg.GetTotalDisks() < 0 {
		t.Fatalf("total_disks = %d", disks.Msg.GetTotalDisks())
	}
}

// TestHostDiagnostics 验证运行时诊断接口。
func TestHostDiagnostics(t *testing.T) {
	setupSingleProcess(t)

	server := NewHostServer()
	summary, err := server.GetDiagnosticsSummary(context.Background(), connect.NewRequest(&agentv1.GetDiagnosticsSummaryRequest{}))
	if err != nil {
		t.Fatalf("Summary: %v", err)
	}
	if summary.Msg.GetGoroutines() <= 0 {
		t.Fatalf("goroutines = %d", summary.Msg.GetGoroutines())
	}
	snapshot, err := server.GetDiagnosticsGoroutines(context.Background(), connect.NewRequest(&agentv1.GetDiagnosticsGoroutinesRequest{}))
	if err != nil {
		t.Fatalf("Goroutines: %v", err)
	}
	if snapshot.Msg.GetTotal() <= 0 {
		t.Fatalf("total = %d", snapshot.Msg.GetTotal())
	}
}

// TestTerminalSessionsRejectMissingIdentity 验证缺少终端身份头时被拒绝。
func TestTerminalSessionsRejectMissingIdentity(t *testing.T) {
	setupSingleProcess(t)

	server := NewTerminalServer()
	_, err := server.ListSessions(context.Background(), connect.NewRequest(&agentv1.ListTerminalSessionsRequest{}))
	if err == nil {
		t.Fatal("缺少身份头应被拒绝")
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestHostCreateEncryptsPassword 验证 RPC 传明文密码后库里存的是密文。
func TestHostCreateEncryptsPassword(t *testing.T) {
	setupSingleProcess(t)

	server := NewHostServer()
	resp, err := server.Create(context.Background(), connect.NewRequest(&agentv1.CreateHostRequest{
		Name: "demo", Addr: "10.0.0.9", Port: 22, User: "root",
		AuthMode: "password", Password: "secret-pass",
	}))
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if resp.Msg.GetAddr() != "10.0.0.9" {
		t.Fatalf("addr = %q", resp.Msg.GetAddr())
	}

	var host agentmodel.Host
	if err := agentglobal.DB.Where("addr = ?", "10.0.0.9").First(&host).Error; err != nil {
		t.Fatalf("查询主机失败: %v", err)
	}
	stored := host.Password
	if stored == "" || stored == "secret-pass" {
		t.Fatalf("密码未加密存储: %q", stored)
	}
}
