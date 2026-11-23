package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestFirewallLifecycleTolerant 验证启停防火墙在无防火墙环境时安全失败。
func TestFirewallLifecycleTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewFirewallServer()
	_, err := server.Operate(context.Background(), connect.NewRequest(&agentv1.FirewallLifecycleRequest{
		Operation: "start",
	}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestFirewallForwardBaseTolerant 验证端口转发状态查询安全失败。
func TestFirewallForwardBaseTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewFirewallServer()
	_, err := server.GetForwardBase(context.Background(), connect.NewRequest(&agentv1.GetForwardBaseRequest{}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestFirewallSettingsTolerant 验证设置读取安全失败。
func TestFirewallSettingsTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewFirewallServer()
	_, err := server.GetSettings(context.Background(), connect.NewRequest(&agentv1.GetFirewallSettingsRequest{}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestFirewallDockerPortsTolerant 验证 Docker 防护总览在无 Docker 时安全失败。
func TestFirewallDockerPortsTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewFirewallServer()
	_, err := server.ListDockerPorts(context.Background(), connect.NewRequest(&agentv1.GetDockerPortsRequest{}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestFirewallUpdateRuleTolerant 验证修改不存在的规则返回 Connect 错误。
func TestFirewallUpdateRuleTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewFirewallServer()
	description := "x"
	_, err := server.UpdateRule(context.Background(), connect.NewRequest(&agentv1.UpdateFirewallRuleRequest{
		Scope:       &agentv1.FirewallScope{Provider: "iptables", Family: "ipv4", Chain: "INPUT"},
		InstanceKey: "missing",
		Description: &description,
	}))
	if err == nil {
		t.Fatal("修改不存在的规则应报错")
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}
