package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestWebsiteExtraInvalidInputs 验证新增接口在异常输入下只返回 Connect 错误。
func TestWebsiteExtraInvalidInputs(t *testing.T) {
	setupSingleProcess(t)

	website := NewWebsiteServer()
	ssl := NewWebsiteSSLServer()

	if _, err := ssl.ImportSSL(context.Background(), connect.NewRequest(&agentv1.ImportSSLRequest{
		PayloadJson: "{not-json",
	})); err == nil {
		t.Fatal("非法 JSON 应返回错误")
	} else if connectErr, ok := err.(*connect.Error); !ok || connectErr.Code() != connect.CodeInvalidArgument {
		t.Fatalf("ImportSSL err = %v, 期望 invalid_argument", err)
	}

	calls := map[string]func() error{
		"ExecComposer": func() error {
			_, err := website.ExecComposer(context.Background(), connect.NewRequest(&agentv1.ExecComposerRequest{}))
			return err
		},
		"ObtainCA": func() error {
			_, err := ssl.ObtainCA(context.Background(), connect.NewRequest(&agentv1.ObtainCARequest{
				Id: 999999, Domains: "example.com", KeyType: "EC256", Time: 1, Unit: "year",
			}))
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
