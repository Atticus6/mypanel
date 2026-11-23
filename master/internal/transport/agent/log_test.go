package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestLogSystemFiles 验证日志文件列表读取不报错。
func TestLogSystemFiles(t *testing.T) {
	setupSingleProcess(t)

	server := NewLogServer()
	resp, err := server.ListSystemFiles(context.Background(), connect.NewRequest(&agentv1.ListSystemFilesRequest{}))
	if err != nil {
		t.Fatalf("ListSystemFiles 返回错误: %v", err)
	}
	if resp.Msg.GetFiles() == nil {
		t.Fatal("files 为 nil，应为空切片")
	}
}

// TestLogRunningServices 验证运行中服务列表在非 systemd 环境下返回空列表。
func TestLogRunningServices(t *testing.T) {
	setupSingleProcess(t)

	server := NewLogServer()
	resp, err := server.ListRunningServices(context.Background(), connect.NewRequest(&agentv1.ListRunningServicesRequest{}))
	if err != nil {
		t.Fatalf("ListRunningServices 返回错误: %v", err)
	}
	if resp.Msg.GetServices() == nil {
		t.Fatal("services 为 nil，应为空切片")
	}
}

// TestLogSystemStatus 验证系统日志状态读取。
func TestLogSystemStatus(t *testing.T) {
	setupSingleProcess(t)

	server := NewLogServer()
	_, err := server.SystemStatus(context.Background(), connect.NewRequest(&agentv1.SystemStatusRequest{}))
	if err != nil {
		t.Fatalf("SystemStatus 返回错误: %v", err)
	}
}
