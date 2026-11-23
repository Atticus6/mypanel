package agent

import (
	"context"

	"connectrpc.com/connect"

	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// LogServer 实现 panel.agent.v1.LogService。
type LogServer struct {
	service *agentservice.LogService
}

// NewLogServer 构造日志服务。
func NewLogServer() *LogServer {
	return &LogServer{service: &agentservice.LogService{}}
}

// ListSystemFiles 列出可读的系统日志文件。
func (s *LogServer) ListSystemFiles(
	_ context.Context,
	_ *connect.Request[agentv1.ListSystemFilesRequest],
) (*connect.Response[agentv1.ListSystemFilesResponse], error) {
	files, err := s.service.ListSystemLogFile()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ListSystemFilesResponse{Files: files}), nil
}

// ListRunningServices 列出运行中的系统服务。
func (s *LogServer) ListRunningServices(
	_ context.Context,
	_ *connect.Request[agentv1.ListRunningServicesRequest],
) (*connect.Response[agentv1.ListRunningServicesResponse], error) {
	services, err := s.service.ListRunningServices()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ListRunningServicesResponse{Services: services}), nil
}

// SystemStatus 读取系统日志能力与状态。
func (s *LogServer) SystemStatus(
	_ context.Context,
	_ *connect.Request[agentv1.SystemStatusRequest],
) (*connect.Response[agentv1.SystemLogStatus], error) {
	status, err := s.service.GetSystemLogStatus()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SystemLogStatus{
		Source:                 status.Source,
		Version:                status.Version,
		KeywordFilterSupported: status.KeywordFilterSupported,
		Message:                status.Message,
	}), nil
}
