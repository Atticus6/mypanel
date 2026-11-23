package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	"mypanel/agent/app/model"
	agentglobal "mypanel/agent/global"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestHostSearchGetAndTree 验证主机查询走真实数据库：
// 建分组与主机后，Search 能命中、Get 能取回、Tree 能按分组归集。
func TestHostSearchGetAndTree(t *testing.T) {
	setupSingleProcess(t)

	group := model.Group{Name: "生产环境", Type: "host"}
	if err := agentglobal.DB.Create(&group).Error; err != nil {
		t.Fatalf("插入分组失败: %v", err)
	}
	host := model.Host{
		GroupID:     group.ID,
		Name:        "web-01",
		Addr:        "10.0.0.11",
		Port:        22,
		User:        "root",
		AuthMode:    "password",
		Password:    "should-not-leak",
		Description: "测试主机",
	}
	if err := agentglobal.DB.Create(&host).Error; err != nil {
		t.Fatalf("插入主机失败: %v", err)
	}

	server := NewHostServer()

	list, err := server.Search(context.Background(), connect.NewRequest(&agentv1.SearchHostsRequest{
		Page:     1,
		PageSize: 10,
		Info:     "web-01",
	}))
	if err != nil {
		t.Fatalf("Search 返回错误: %v", err)
	}
	if list.Msg.GetTotal() != 1 {
		t.Fatalf("total = %d, 期望 1", list.Msg.GetTotal())
	}
	item := list.Msg.GetItems()[0]
	if item.GetName() != "web-01" || item.GetAddr() != "10.0.0.11" || item.GetPort() != 22 {
		t.Fatalf("host = %+v, 期望 web-01/10.0.0.11/22", item)
	}
	if item.GetGroupBelong() != "生产环境" {
		t.Fatalf("group_belong = %q, 期望 生产环境", item.GetGroupBelong())
	}

	detail, err := server.Get(context.Background(), connect.NewRequest(&agentv1.GetHostRequest{Id: uint32(host.ID)}))
	if err != nil {
		t.Fatalf("Get 返回错误: %v", err)
	}
	if detail.Msg.GetUser() != "root" {
		t.Fatalf("user = %q, 期望 root", detail.Msg.GetUser())
	}

	tree, err := server.Tree(context.Background(), connect.NewRequest(&agentv1.HostTreeRequest{}))
	if err != nil {
		t.Fatalf("Tree 返回错误: %v", err)
	}
	if len(tree.Msg.GetGroups()) != 1 {
		t.Fatalf("groups = %d, 期望 1", len(tree.Msg.GetGroups()))
	}
	if got := tree.Msg.GetGroups()[0].GetChildren(); len(got) != 1 || got[0].GetLabel() == "" {
		t.Fatalf("children = %+v, 期望 1 个带名称的节点", got)
	}
}

// TestHostGetNotFound 验证不存在的主机返回 NotFound。
func TestHostGetNotFound(t *testing.T) {
	setupSingleProcess(t)

	server := NewHostServer()
	_, err := server.Get(context.Background(), connect.NewRequest(&agentv1.GetHostRequest{Id: 4242}))
	if err == nil {
		t.Fatal("不存在的主机应返回错误")
	}
	connectErr, ok := err.(*connect.Error)
	if !ok {
		t.Fatalf("错误类型 = %T", err)
	}
	if connectErr.Code() != connect.CodeNotFound {
		t.Fatalf("code = %v, 期望 not_found", connectErr.Code())
	}
}
