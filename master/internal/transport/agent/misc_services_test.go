package agent

import (
	"context"
	"os"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestHealthCheck 验证健康检查无需业务数据即可成功。
func TestHealthCheck(t *testing.T) {
	setupSingleProcess(t)

	server := NewHealthServer()
	if _, err := server.Check(context.Background(), connect.NewRequest(&agentv1.CheckHealthRequest{})); err != nil {
		t.Fatalf("Check: %v", err)
	}
}

// TestGroupLifecycle 验证分组的创建、查询、更新与删除。
func TestGroupLifecycle(t *testing.T) {
	setupSingleProcess(t)

	server := NewGroupServer()
	if _, err := server.CreateGroup(context.Background(), connect.NewRequest(&agentv1.CreateGroupRequest{
		Name: "测试分组",
		Type: "website",
	})); err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}

	list, err := server.SearchGroups(context.Background(), connect.NewRequest(&agentv1.SearchGroupsRequest{
		Type: "website",
	}))
	if err != nil {
		t.Fatalf("SearchGroups: %v", err)
	}
	var target *agentv1.Group
	for _, item := range list.Msg.GetItems() {
		if item.GetName() == "测试分组" {
			target = item
		}
	}
	if target == nil {
		t.Fatalf("items = %+v, 期望包含测试分组", list.Msg.GetItems())
	}

	if _, err := server.UpdateGroup(context.Background(), connect.NewRequest(&agentv1.UpdateGroupRequest{
		Id:   target.GetId(),
		Name: "测试分组-改",
		Type: "website",
	})); err != nil {
		t.Fatalf("UpdateGroup: %v", err)
	}
	list, err = server.SearchGroups(context.Background(), connect.NewRequest(&agentv1.SearchGroupsRequest{
		Type: "website",
	}))
	if err != nil {
		t.Fatalf("SearchGroups after update: %v", err)
	}
	found := false
	for _, item := range list.Msg.GetItems() {
		if item.GetId() == target.GetId() && item.GetName() == "测试分组-改" {
			found = true
		}
	}
	if !found {
		t.Fatalf("items = %+v, 期望包含更新后的分组", list.Msg.GetItems())
	}

	if _, err := server.DeleteGroup(context.Background(), connect.NewRequest(&agentv1.DeleteGroupRequest{
		Id: target.GetId(),
	})); err != nil {
		t.Fatalf("DeleteGroup: %v", err)
	}
}

// TestProcessInfoAndListening 验证进程详情与监听列表可调用。
func TestProcessInfoAndListening(t *testing.T) {
	setupSingleProcess(t)

	server := NewProcessServer()
	info, err := server.GetProcessInfo(context.Background(), connect.NewRequest(&agentv1.GetProcessInfoRequest{
		Pid: int32(os.Getpid()),
	}))
	if err != nil {
		t.Fatalf("GetProcessInfo: %v", err)
	}
	if info.Msg.GetPid() != int32(os.Getpid()) {
		t.Fatalf("pid = %d, 期望 %d", info.Msg.GetPid(), os.Getpid())
	}

	// macOS 上 gopsutil 未实现连接枚举，只要求返回 Connect 错误而不是 panic。
	if list, err := server.ListListeningProcess(context.Background(), connect.NewRequest(&agentv1.ListListeningProcessRequest{})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("ListListeningProcess 错误类型 = %T", err)
		}
	} else if list.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	// 不存在的 PID 只要求返回 Connect 错误，不能 panic。
	if _, err := server.GetProcessInfo(context.Background(), connect.NewRequest(&agentv1.GetProcessInfoRequest{
		Pid: 999999,
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("错误类型 = %T", err)
		}
	}
}

// TestSystemAndTaskLogsTolerant 验证日志读取在平台能力受限时也能安全返回。
func TestSystemAndTaskLogsTolerant(t *testing.T) {
	setupSingleProcess(t)

	server := NewLogServer()
	if _, err := server.ReadSystemLogs(context.Background(), connect.NewRequest(&agentv1.ReadSystemLogsRequest{
		PageSize: 10,
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("ReadSystemLogs 错误类型 = %T", err)
		}
	}

	if _, err := server.ReadTaskLogs(context.Background(), connect.NewRequest(&agentv1.ReadTaskLogsRequest{
		Page:     1,
		PageSize: 10,
		TaskId:   "missing",
	})); err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("ReadTaskLogs 错误类型 = %T", err)
		}
	}

	// 非法的 RFC3339 时间必须被拒绝。
	if _, err := server.ReadSystemLogs(context.Background(), connect.NewRequest(&agentv1.ReadSystemLogsRequest{
		PageSize:  10,
		StartTime: "not-a-time",
	})); err == nil {
		t.Fatal("非法时间应返回错误")
	} else if connectErr, ok := err.(*connect.Error); !ok || connectErr.Code() != connect.CodeInvalidArgument {
		t.Fatalf("err = %v, 期望 invalid_argument", err)
	}
}
