package core

import (
	"context"

	"connectrpc.com/connect"

	"mypanel/core/app/dto"
	"mypanel/core/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
	corev1 "mypanel/proto/gen/go/panel/core/v1"

	"mypanel/master/internal/transport/conv"
	"mypanel/master/internal/transport/errmap"
)

// DiagnosticsServer 实现 panel.core.v1.DiagnosticsService。
type DiagnosticsServer struct {
	service service.IRuntimeDiagnosticsService
}

// NewDiagnosticsServer 构造控制面运行时诊断服务。
func NewDiagnosticsServer() *DiagnosticsServer {
	return &DiagnosticsServer{service: service.NewIRuntimeDiagnosticsService()}
}

// Summary 读取运行时概况。
func (s *DiagnosticsServer) Summary(
	_ context.Context,
	_ *connect.Request[corev1.SummaryRequest],
) (*connect.Response[agentv1.DiagnosticsSummary], error) {
	info, err := s.service.Summary()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.DiagnosticsSummary{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// Goroutines 读取 goroutine 快照。
func (s *DiagnosticsServer) Goroutines(
	_ context.Context,
	_ *connect.Request[corev1.GoroutinesRequest],
) (*connect.Response[agentv1.GoroutineSnapshot], error) {
	info, err := s.service.Goroutines()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.GoroutineSnapshot{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// CreateProfile 采集性能剖析文件。
func (s *DiagnosticsServer) CreateProfile(
	_ context.Context,
	req *connect.Request[corev1.CreateProfileRequest],
) (*connect.Response[agentv1.DiagnosticsProfile], error) {
	result, err := s.service.CreateProfile(dto.RuntimeProfileCreate{
		Type:     req.Msg.GetType(),
		Duration: int(req.Msg.GetDuration()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DiagnosticsProfile{Path: result.Path, Name: result.Name}), nil
}
