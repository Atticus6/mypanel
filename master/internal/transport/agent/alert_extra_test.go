package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestAlertQueries 验证告警相关的查询接口可调用。
func TestAlertQueries(t *testing.T) {
	setupSingleProcess(t)

	server := NewAlertServer()
	disks, err := server.GetAlertDisks(context.Background(), connect.NewRequest(&agentv1.GetAlertDisksRequest{}))
	if err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("GetAlertDisks 错误类型 = %T", err)
		}
	} else if disks.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	clams, err := server.GetAlertClams(context.Background(), connect.NewRequest(&agentv1.GetAlertClamsRequest{}))
	if err != nil {
		t.Fatalf("GetAlertClams: %v", err)
	}
	if clams.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	jobs, err := server.GetAlertCronJobs(context.Background(), connect.NewRequest(&agentv1.GetAlertCronJobsRequest{}))
	if err != nil {
		t.Fatalf("GetAlertCronJobs: %v", err)
	}
	if jobs.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	configs, err := server.GetAlertConfig(context.Background(), connect.NewRequest(&agentv1.GetAlertConfigRequest{}))
	if err != nil {
		t.Fatalf("GetAlertConfig: %v", err)
	}
	if configs.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	page, err := server.SearchAlertConfigs(context.Background(), connect.NewRequest(&agentv1.SearchAlertConfigsRequest{
		Page: 1, PageSize: 10,
	}))
	if err != nil {
		t.Fatalf("SearchAlertConfigs: %v", err)
	}
	if page.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	logs, err := server.SearchAlertLogs(context.Background(), connect.NewRequest(&agentv1.SearchAlertLogsRequest{
		Page: 1, PageSize: 10,
	}))
	if err != nil {
		t.Fatalf("SearchAlertLogs: %v", err)
	}
	if logs.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}
}

// TestAlertInvalidInputs 验证不存在的告警 ID 只返回 Connect 错误。
func TestAlertInvalidInputs(t *testing.T) {
	setupSingleProcess(t)

	server := NewAlertServer()
	calls := map[string]func() error{
		"DeleteAlert": func() error {
			_, err := server.DeleteAlert(context.Background(), connect.NewRequest(&agentv1.DeleteAlertRequest{Id: 999999}))
			return err
		},
		"UpdateAlertStatus": func() error {
			_, err := server.UpdateAlertStatus(context.Background(), connect.NewRequest(&agentv1.UpdateAlertStatusRequest{
				Id: 999999, Status: "Enable",
			}))
			return err
		},
		"DeleteAlertConfig": func() error {
			_, err := server.DeleteAlertConfig(context.Background(), connect.NewRequest(&agentv1.DeleteAlertConfigRequest{Id: 999999}))
			return err
		},
	}
	for name, call := range calls {
		if err := call(); err != nil {
			if _, ok := err.(*connect.Error); !ok {
				t.Fatalf("%s 错误类型 = %T", name, err)
			}
		}
	}
}
