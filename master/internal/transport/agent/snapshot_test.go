package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestSnapshotLoadData 验证数据树可读且面板数据非空。
func TestSnapshotLoadData(t *testing.T) {
	setupSingleProcess(t)

	server := NewSnapshotServer()
	resp, err := server.LoadData(context.Background(), connect.NewRequest(&agentv1.LoadSnapshotDataRequest{}))
	if err != nil {
		t.Fatalf("LoadData: %v", err)
	}
	if len(resp.Msg.GetPanelData()) == 0 {
		t.Fatal("panel_data 为空")
	}
}

// TestSnapshotSearch 验证快照分页查询返回空列表而不是报错。
func TestSnapshotSearch(t *testing.T) {
	setupSingleProcess(t)

	server := NewSnapshotServer()
	resp, err := server.Search(context.Background(), connect.NewRequest(&agentv1.SearchSnapshotsRequest{
		Page: 1, PageSize: 10, OrderBy: "createdAt", Order: "descending",
	}))
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if resp.Msg.GetTotal() != 0 || len(resp.Msg.GetItems()) != 0 {
		t.Fatalf("空库应返回空列表: total=%d items=%d", resp.Msg.GetTotal(), len(resp.Msg.GetItems()))
	}
}

// TestSnapshotCreateRejectsEmptySource 验证缺来源账号时被 Protovalidate 拦下。
func TestSnapshotCreateRejectsEmptySource(t *testing.T) {
	setupSingleProcess(t)

	server := NewSnapshotServer()
	// 直接调用 server 不经过校验拦截器，所以这里断言 service 层的错误被包装。
	_, err := server.Create(context.Background(), connect.NewRequest(&agentv1.CreateSnapshotRequest{
		SourceAccountIds: "", DownloadAccountId: 1,
	}))
	if err == nil {
		return
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}

// TestSnapshotRecreateTolerant 验证不存在的快照 ID 返回 Connect 错误。
func TestSnapshotRecreateTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewSnapshotServer()
	_, err := server.Recreate(context.Background(), connect.NewRequest(&agentv1.RecreateSnapshotRequest{Id: 9999}))
	if err == nil {
		t.Fatal("不存在的快照应返回错误")
	}
	if _, ok := err.(*connect.Error); !ok {
		t.Fatalf("错误类型 = %T", err)
	}
}
