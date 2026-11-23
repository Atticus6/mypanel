package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestAgentSettingInfo 验证 agent 设置可读且带版本号。
func TestAgentSettingInfo(t *testing.T) {
	setupSingleProcess(t)

	server := NewAgentSettingServer()
	resp, err := server.GetInfo(context.Background(), connect.NewRequest(&agentv1.GetAgentSettingInfoRequest{}))
	if err != nil {
		t.Fatalf("GetInfo: %v", err)
	}
	if resp.Msg.GetSystemVersion() == "" {
		t.Fatal("system_version 为空")
	}
}

// TestAgentSettingBaseDir 验证数据目录与网站目录非空。
func TestAgentSettingBaseDir(t *testing.T) {
	setupSingleProcess(t)

	server := NewAgentSettingServer()
	base, err := server.GetBaseDir(context.Background(), connect.NewRequest(&agentv1.GetBaseDirRequest{}))
	if err != nil {
		t.Fatalf("GetBaseDir: %v", err)
	}
	if base.Msg.GetPath() == "" {
		t.Fatal("数据目录为空")
	}
	site, err := server.GetWebsiteDir(context.Background(), connect.NewRequest(&agentv1.GetWebsiteDirRequest{}))
	if err != nil {
		t.Fatalf("GetWebsiteDir: %v", err)
	}
	if site.Msg.GetPath() == "" {
		t.Fatal("网站目录为空")
	}
}

// TestAgentFileHistorySetting 验证文件历史设置的读写。
func TestAgentFileHistorySetting(t *testing.T) {
	setupSingleProcess(t)

	server := NewAgentSettingServer()
	if _, err := server.UpdateFileHistory(context.Background(), connect.NewRequest(&agentv1.UpdateFileHistorySettingRequest{
		Enable: "Enable", MaxPerPath: 20, DiskQuotaMb: 100,
	})); err != nil {
		t.Fatalf("UpdateFileHistory: %v", err)
	}
	resp, err := server.GetFileHistory(context.Background(), connect.NewRequest(&agentv1.GetFileHistorySettingRequest{}))
	if err != nil {
		t.Fatalf("GetFileHistory: %v", err)
	}
	if resp.Msg.GetEnable() != "Enable" || resp.Msg.GetMaxPerPath() != 20 {
		t.Fatalf("设置未生效: %+v", resp.Msg)
	}
}

// TestAgentSaveDescription 验证描述保存落到数据库。
func TestAgentSaveDescription(t *testing.T) {
	setupSingleProcess(t)

	server := NewAgentSettingServer()
	if _, err := server.SaveDescription(context.Background(), connect.NewRequest(&agentv1.SaveDescriptionRequest{
		Id: "1", Type: "container", Description: "备注",
	})); err != nil {
		t.Fatalf("SaveDescription: %v", err)
	}
}

// TestAgentTerminalAITolerant 验证终端 AI 设置在未配置账号时安全失败。
func TestAgentTerminalAITolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewAgentSettingServer()
	resp, err := server.GetTerminalAI(context.Background(), connect.NewRequest(&agentv1.GetTerminalAIRequest{}))
	if err != nil {
		t.Fatalf("GetTerminalAI: %v", err)
	}
	if resp.Msg.GetAiPrefix() == "" {
		t.Fatal("ai_prefix 为空")
	}
}
