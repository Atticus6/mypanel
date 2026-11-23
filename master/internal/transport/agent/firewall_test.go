package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestFirewallBaseInfoDoesNotPanic 验证防火墙状态查询在非 Linux 环境下安全失败。
//
// 防火墙探测依赖 iptables/ufw/firewalld，开发机通常没有；
// 这里断言「成功返回状态」或「返回可识别的 Connect 错误」，不允许 panic。
func TestFirewallBaseInfoDoesNotPanic(t *testing.T) {
	setupSingleProcess(t)

	server := NewFirewallServer()
	resp, err := server.BaseInfo(context.Background(), connect.NewRequest(&agentv1.FirewallBaseInfoRequest{
		Name: "system",
	}))
	if err != nil {
		connectErr, ok := err.(*connect.Error)
		if !ok {
			t.Fatalf("错误类型 = %T", err)
		}
		t.Logf("防火墙不可用，按预期返回 %v: %s", connectErr.Code(), connectErr.Message())
		return
	}
	if resp.Msg.GetName() == "" && resp.Msg.GetBackend() == "" {
		t.Logf("防火墙信息为空（当前环境无防火墙后端）")
	}
}
