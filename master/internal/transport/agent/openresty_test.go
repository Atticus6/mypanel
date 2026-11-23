package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestOpenrestyQueries 验证 OpenResty 查询接口在无 Nginx 环境也能安全返回。
func TestOpenrestyQueries(t *testing.T) {
	setupSingleProcess(t)

	server := NewOpenrestyServer()
	calls := map[string]func() error{
		"GetConfig": func() error {
			_, err := server.GetConfig(context.Background(), connect.NewRequest(&agentv1.GetOpenrestyConfigRequest{}))
			return err
		},
		"GetConfigByScope": func() error {
			_, err := server.GetConfigByScope(context.Background(), connect.NewRequest(&agentv1.GetOpenrestyConfigByScopeRequest{
				Scope: "server",
			}))
			return err
		},
		"GetStatus": func() error {
			_, err := server.GetStatus(context.Background(), connect.NewRequest(&agentv1.GetOpenrestyStatusRequest{}))
			return err
		},
		"GetModules": func() error {
			_, err := server.GetModules(context.Background(), connect.NewRequest(&agentv1.GetOpenrestyModulesRequest{}))
			return err
		},
		"GetDefaultHTTPSStatus": func() error {
			_, err := server.GetDefaultHTTPSStatus(context.Background(), connect.NewRequest(&agentv1.GetDefaultHTTPSStatusRequest{}))
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

// TestOpenrestyBadParams 验证非法参数在 adapter 层被拒绝。
func TestOpenrestyBadParams(t *testing.T) {
	setupSingleProcess(t)

	server := NewOpenrestyServer()
	if _, err := server.UpdateConfigByScope(context.Background(), connect.NewRequest(&agentv1.UpdateOpenrestyConfigRequest{
		Scope: "server", Operate: "add", ParamsJson: "{not-json",
	})); err == nil {
		t.Fatal("非法 JSON 应返回错误")
	} else if connectErr, ok := err.(*connect.Error); !ok || connectErr.Code() != connect.CodeInvalidArgument {
		t.Fatalf("err = %v, 期望 invalid_argument", err)
	}
}
