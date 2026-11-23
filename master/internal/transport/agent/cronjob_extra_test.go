package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestCronjobOptionsAndNext 验证脚本选项与 Cron 表达式计算。
func TestCronjobOptionsAndNext(t *testing.T) {
	setupSingleProcess(t)

	server := NewCronjobServer()
	options, err := server.LoadScriptOptions(context.Background(), connect.NewRequest(&agentv1.LoadScriptOptionsRequest{}))
	if err != nil {
		t.Fatalf("LoadScriptOptions: %v", err)
	}
	if options.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}

	next, err := server.LoadNextHandle(context.Background(), connect.NewRequest(&agentv1.LoadNextHandleRequest{
		Spec: "0 0 * * * ?",
	}))
	if err != nil {
		if _, ok := err.(*connect.Error); !ok {
			t.Fatalf("LoadNextHandle 错误类型 = %T", err)
		}
	} else if next.Msg.GetItems() == nil {
		t.Fatal("items 为 nil")
	}
}

// TestCronjobInvalidInputs 验证异常输入只返回 Connect 错误。
func TestCronjobInvalidInputs(t *testing.T) {
	setupSingleProcess(t)

	server := NewCronjobServer()
	if _, err := server.CreateCronjob(context.Background(), connect.NewRequest(&agentv1.CreateCronjobRequest{
		PayloadJson: "{not-json",
	})); err == nil {
		t.Fatal("非法 JSON 应返回错误")
	} else if connectErr, ok := err.(*connect.Error); !ok || connectErr.Code() != connect.CodeInvalidArgument {
		t.Fatalf("err = %v, 期望 invalid_argument", err)
	}

	calls := map[string]func() error{
		"UpdateCronjobStatus": func() error {
			_, err := server.UpdateCronjobStatus(context.Background(), connect.NewRequest(&agentv1.UpdateCronjobStatusRequest{
				Id: 999999, Status: "Enable",
			}))
			return err
		},
		"UpdateCronjobGroup": func() error {
			_, err := server.UpdateCronjobGroup(context.Background(), connect.NewRequest(&agentv1.UpdateCronjobGroupRequest{
				Id: 999999, GroupId: 1,
			}))
			return err
		},
		"StopCronjob": func() error {
			_, err := server.StopCronjob(context.Background(), connect.NewRequest(&agentv1.StopCronjobRequest{Id: 999999}))
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
