package core

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	corev1 "mypanel/proto/gen/go/panel/core/v1"
)

// TestCoreLogsAndScripts 验证日志与脚本查询在空库时返回空列表。
func TestCoreLogsAndScripts(t *testing.T) {
	setupSettingCore(t)

	logs := NewLogServer()
	resp, err := logs.SearchOperationLogs(context.Background(), connect.NewRequest(&corev1.SearchOperationLogsRequest{
		Page: 1, PageSize: 10,
	}))
	if err != nil {
		t.Fatalf("SearchOperationLogs: %v", err)
	}
	if resp.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	scripts := NewScriptServer()
	list, err := scripts.Search(context.Background(), connect.NewRequest(&corev1.SearchScriptsRequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("SearchScripts: %v", err)
	}
	if list.Msg.GetItems() == nil {
		t.Fatal("script items 为 nil")
	}
}

// TestCoreLogsSearchRejectsBadTime 验证非法时间格式被拒绝。
func TestCoreLogsSearchRejectsBadTime(t *testing.T) {
	setupSettingCore(t)

	logs := NewLogServer()
	_, err := logs.SearchLoginLogs(context.Background(), connect.NewRequest(&corev1.SearchLoginLogsRequest{
		Page: 1, PageSize: 10, StartTime: "bad",
	}))
	if err == nil {
		t.Fatal("非法时间应被拒绝")
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestCoreScriptCreateAndDelete 验证脚本创建后可按 ID 删除。
func TestCoreScriptCreateAndDelete(t *testing.T) {
	setupSettingCore(t)

	scripts := NewScriptServer()
	if _, err := scripts.Create(context.Background(), connect.NewRequest(&corev1.CreateScriptRequest{
		Name: "demo.sh", Script: "echo hi", Groups: "1",
	})); err != nil {
		t.Fatalf("Create: %v", err)
	}
	list, err := scripts.Search(context.Background(), connect.NewRequest(&corev1.SearchScriptsRequest{Page: 1, PageSize: 10}))
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(list.Msg.GetItems()) != 1 {
		t.Fatalf("脚本数量 = %d, 期望 1", len(list.Msg.GetItems()))
	}
	if _, err := scripts.Delete(context.Background(), connect.NewRequest(&corev1.DeleteScriptsRequest{
		Ids: []uint32{list.Msg.GetItems()[0].GetId()},
	})); err != nil {
		t.Fatalf("Delete: %v", err)
	}
}
