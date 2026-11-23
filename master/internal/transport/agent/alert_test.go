package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestAlertPage 验证告警列表查询走真实数据库。
func TestAlertPage(t *testing.T) {
	setupSingleProcess(t)

	alert := model.Alert{
		Title:     "磁盘告警",
		Type:      "disk",
		Cycle:     5,
		Count:     3,
		Status:    "Enable",
		Method:    "email",
		Project:   "disk",
		SendCount: 2,
	}
	if err := agentglobal.AlertDB.Create(&alert).Error; err != nil {
		t.Fatalf("插入告警失败: %v", err)
	}

	server := NewAlertServer()
	resp, err := server.Page(context.Background(), connect.NewRequest(&agentv1.SearchAlertsRequest{
		Page:     1,
		PageSize: 10,
	}))
	if err != nil {
		t.Fatalf("Page 返回错误: %v", err)
	}
	if resp.Msg.GetTotal() != 1 {
		t.Fatalf("total = %d, 期望 1", resp.Msg.GetTotal())
	}
	item := resp.Msg.GetItems()[0]
	if item.GetTitle() != "磁盘告警" || item.GetStatus() != "Enable" || item.GetSendCount() != 2 {
		t.Fatalf("alert = %+v, 期望 磁盘告警/Enable/2", item)
	}
}

// TestAlertPageFilter 验证按状态过滤。
func TestAlertPageFilter(t *testing.T) {
	setupSingleProcess(t)

	if err := agentglobal.AlertDB.Create(&model.Alert{
		Title: "停用告警", Type: "disk", Cycle: 5, Count: 3, Status: "Disable", Method: "email",
	}).Error; err != nil {
		t.Fatalf("插入告警失败: %v", err)
	}

	server := NewAlertServer()
	resp, err := server.Page(context.Background(), connect.NewRequest(&agentv1.SearchAlertsRequest{
		Page:     1,
		PageSize: 10,
		Status:   "Enable",
	}))
	if err != nil {
		t.Fatalf("Page 返回错误: %v", err)
	}
	if resp.Msg.GetTotal() != 0 {
		t.Fatalf("total = %d, 期望 0（只有停用告警）", resp.Msg.GetTotal())
	}
}
