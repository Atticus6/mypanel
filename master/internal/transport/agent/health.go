package agent

import (
	"context"

	"connectrpc.com/connect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
)

// HealthServer 实现 panel.agent.v1.HealthService。
type HealthServer struct{}

// NewHealthServer 构造健康检查服务。
func NewHealthServer() *HealthServer {
	return &HealthServer{}
}

// Check 返回服务就绪状态；能进入 handler 即表示 core 与 agent 已初始化。
func (s *HealthServer) Check(
	_ context.Context,
	_ *connect.Request[agentv1.CheckHealthRequest],
) (*connect.Response[agentv1.CheckHealthResponse], error) {
	return connect.NewResponse(&agentv1.CheckHealthResponse{}), nil
}
