package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestTaskSearch 验证任务中心查询走真实任务库。
func TestTaskSearch(t *testing.T) {
	setupSingleProcess(t)

	task := model.Task{
		ID:      "task-test-1",
		Name:    "压缩文件",
		Type:    "file",
		Operate: "compress",
		Status:  "Success",
	}
	if err := agentglobal.TaskDB.Create(&task).Error; err != nil {
		t.Fatalf("插入任务失败: %v", err)
	}

	server := NewTaskServer()
	resp, err := server.Search(context.Background(), connect.NewRequest(&agentv1.SearchTasksRequest{
		Page:     1,
		PageSize: 10,
		Status:   "Success",
	}))
	if err != nil {
		t.Fatalf("Search 返回错误: %v", err)
	}
	if resp.Msg.GetTotal() != 1 {
		t.Fatalf("total = %d, 期望 1", resp.Msg.GetTotal())
	}
	item := resp.Msg.GetItems()[0]
	if item.GetId() != "task-test-1" || item.GetName() != "压缩文件" {
		t.Fatalf("task = %+v, 期望 task-test-1/压缩文件", item)
	}
}

// TestTaskCountExecuting 验证执行中任务统计。
func TestTaskCountExecuting(t *testing.T) {
	setupSingleProcess(t)

	server := NewTaskServer()
	resp, err := server.CountExecuting(context.Background(), connect.NewRequest(&agentv1.CountExecutingTasksRequest{}))
	if err != nil {
		t.Fatalf("CountExecuting 返回错误: %v", err)
	}
	if resp.Msg.GetCount() < 0 {
		t.Fatalf("count = %d，不应为负数", resp.Msg.GetCount())
	}
}
