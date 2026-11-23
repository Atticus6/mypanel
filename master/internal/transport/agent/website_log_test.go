package agent

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentservice "mypanel/agent/app/service"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestWebsiteGetLog 验证网站日志读取：按站点目录写入 access.log 后能按行返回。
func TestWebsiteGetLog(t *testing.T) {
	setupSingleProcess(t)

	site := model.Website{
		Protocol: "http", PrimaryDomain: "log.example.com", Type: "static",
		Alias: "log-example", Status: "Running", AccessLog: true,
	}
	if err := agentglobal.DB.Create(&site).Error; err != nil {
		t.Fatalf("插入网站失败: %v", err)
	}
	logDir := filepath.Join(agentservice.GetSitePath(site, agentservice.SiteDir), "log")
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		t.Fatalf("创建日志目录失败: %v", err)
	}
	if err := os.WriteFile(filepath.Join(logDir, "access.log"), []byte("line1\nline2\n"), 0o644); err != nil {
		t.Fatalf("写入日志失败: %v", err)
	}

	server := NewWebsiteServer()
	resp, err := server.GetLog(context.Background(), connect.NewRequest(&agentv1.GetWebsiteLogRequest{
		Id: uint32(site.ID), LogType: "access.log", Page: 1, PageSize: 100,
	}))
	if err != nil {
		t.Fatalf("GetLog 返回错误: %v", err)
	}
	if !resp.Msg.GetEnable() || resp.Msg.GetContent() == "" {
		t.Fatalf("log = %+v, 期望启用且有内容", resp.Msg)
	}
}
