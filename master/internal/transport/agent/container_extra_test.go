package agent

import (
	"context"
	"testing"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// TestContainerNewQueries 验证镜像列表在无 Docker 环境也能安全返回。
func TestContainerNewQueries(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	calls := map[string]func() error{
		"ListImages": func() error {
			_, err := server.ListImages(context.Background(), connect.NewRequest(&agentv1.ListImagesRequest{}))
			return err
		},
		"ListAllImages": func() error {
			_, err := server.ListAllImages(context.Background(), connect.NewRequest(&agentv1.ListAllImagesRequest{}))
			return err
		},
		"ContainerInfo": func() error {
			_, err := server.ContainerInfo(context.Background(), connect.NewRequest(&agentv1.ContainerInfoRequest{Name: "missing"}))
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

// TestContainerBadPayload 验证非法 JSON 被拒绝。
func TestContainerBadPayload(t *testing.T) {
	setupSingleProcess(t)

	server := NewContainerServer()
	calls := map[string]func() error{
		"CreateContainer": func() error {
			_, err := server.CreateContainer(context.Background(), connect.NewRequest(&agentv1.CreateContainerRequest{PayloadJson: "{not-json"}))
			return err
		},
		"CreateCompose": func() error {
			_, err := server.CreateCompose(context.Background(), connect.NewRequest(&agentv1.CreateComposeRequest{PayloadJson: "{not-json"}))
			return err
		},
		"UpdateCompose": func() error {
			_, err := server.UpdateCompose(context.Background(), connect.NewRequest(&agentv1.UpdateComposeRequest{PayloadJson: "{not-json"}))
			return err
		},
		"CommitContainer": func() error {
			_, err := server.CommitContainer(context.Background(), connect.NewRequest(&agentv1.CommitContainerRequest{PayloadJson: "{not-json"}))
			return err
		},
		"UpdateContainer": func() error {
			_, err := server.UpdateContainer(context.Background(), connect.NewRequest(&agentv1.UpdateContainerRequest{PayloadJson: "{not-json"}))
			return err
		},
		"UpgradeContainer": func() error {
			_, err := server.UpgradeContainer(context.Background(), connect.NewRequest(&agentv1.UpgradeContainerRequest{PayloadJson: "{not-json"}))
			return err
		},
	}
	for name, call := range calls {
		if err := call(); err == nil {
			t.Fatalf("%s 非法 JSON 应返回错误", name)
		} else if connectErr, ok := err.(*connect.Error); !ok || connectErr.Code() != connect.CodeInvalidArgument {
			t.Fatalf("%s err = %v, 期望 invalid_argument", name, err)
		}
	}
}
