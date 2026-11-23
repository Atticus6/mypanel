package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestSSHInfoTolerant 验证 SSH 状态可读，或在非 Linux 环境安全失败。
func TestSSHInfoTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewSSHServer()
	resp, err := server.GetInfo(context.Background(), connect.NewRequest(&agentv1.GetSSHInfoRequest{}))
	if err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("错误类型 = %T", err)
		}
		return
	}
	if resp.Msg.GetCurrentUser() == "" {
		t.Fatal("current_user 为空")
	}
}

// TestSSHOperateTolerant 验证启停 SSH 在无 systemd 环境时安全失败。
func TestSSHOperateTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewSSHServer()
	_, err := server.Operate(context.Background(), connect.NewRequest(&agentv1.OperateSSHRequest{Operation: "restart"}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestSSHLogSearchRejectsBadTime 验证非法时间格式被拒绝。
func TestSSHLogSearchRejectsBadTime(t *testing.T) {
	setupSingleProcess(t)

	server := NewSSHServer()
	_, err := server.SearchLogs(context.Background(), connect.NewRequest(&agentv1.SearchSSHLogsRequest{
		Page: 1, PageSize: 10, Status: "All", StartTime: "not-a-time",
	}))
	if err == nil {
		t.Fatal("非法时间应被拒绝")
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestSSHCertSearchIsEmptyList 验证密钥列表在空库时返回空数组。
func TestSSHCertSearchIsEmptyList(t *testing.T) {
	setupSingleProcess(t)

	server := NewSSHServer()
	resp, err := server.SearchCerts(context.Background(), connect.NewRequest(&agentv1.SearchSSHCertsRequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("SearchCerts: %v", err)
	}
	if resp.Msg.GetTotal() != 0 || len(resp.Msg.GetItems()) != 0 {
		t.Fatalf("空库应返回空列表: total=%d", resp.Msg.GetTotal())
	}
}

// TestSSHLoadFileTolerant 验证读取不存在的配置文件返回 Connect 错误。
func TestSSHLoadFileTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewSSHServer()
	_, err := server.LoadFile(context.Background(), connect.NewRequest(&agentv1.LoadSSHFileRequest{Name: "not-exist.conf"}))
	if err == nil {
		t.Fatal("不存在的文件应报错")
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}
