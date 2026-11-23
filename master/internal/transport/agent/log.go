package agent

import (
	"context"
	"time"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	"mypanel/agent/app/dto/request"
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

// ReadSystemLogs 分页读取系统日志。
func (s *LogServer) ReadSystemLogs(
	_ context.Context,
	req *connect.Request[agentv1.ReadSystemLogsRequest],
) (*connect.Response[agentv1.SystemLogBatch], error) {
	start, err := parseOptionalTime(req.Msg.GetStartTime())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	end, err := parseOptionalTime(req.Msg.GetEndTime())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	data, err := s.service.ReadSystemLog(agentdto.SystemLogReq{
		PageSize:  int(req.Msg.GetPageSize()),
		Cursor:    req.Msg.GetCursor(),
		StartTime: start,
		EndTime:   end,
		Keyword:   req.Msg.GetKeyword(),
		Priority:  req.Msg.GetPriority(),
		Service:   req.Msg.GetService(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.SystemLogEntry, 0, len(data.Items))
	for _, item := range data.Items {
		items = append(items, &agentv1.SystemLogEntry{
			Time:     item.Time,
			Priority: item.Priority,
			Service:  item.Service,
			Message:  item.Message,
			Raw:      item.Raw,
		})
	}
	return connect.NewResponse(&agentv1.SystemLogBatch{
		Source:     data.Source,
		Items:      items,
		HasMore:    data.HasMore,
		NextCursor: data.NextCursor,
	}), nil
}

// ReadTaskLogs 按行读取任务日志。
func (s *LogServer) ReadTaskLogs(
	_ context.Context,
	req *connect.Request[agentv1.ReadTaskLogsRequest],
) (*connect.Response[agentv1.TaskLogLines], error) {
	data, err := agentservice.NewITaskService().ReadByLine(request.TaskLogReadReq{
		Page:     int(req.Msg.GetPage()),
		PageSize: int(req.Msg.GetPageSize()),
		Latest:   req.Msg.GetLatest(),
		TaskReq: request.TaskReq{
			TaskID:      req.Msg.GetTaskId(),
			TaskType:    req.Msg.GetTaskType(),
			TaskOperate: req.Msg.GetTaskOperate(),
			ResourceID:  uint(req.Msg.GetResourceId()),
		},
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.TaskLogLines{
		End:        data.End,
		Path:       data.Path,
		Total:      int32(data.Total),
		TaskStatus: data.TaskStatus,
		Lines:      data.Lines,
		Scope:      data.Scope,
		TotalLines: int32(data.TotalLines),
	}), nil
}

// parseOptionalTime 解析可选的 RFC3339 时间；空串返回零值。
func parseOptionalTime(value string) (time.Time, error) {
	if value == "" {
		return time.Time{}, nil
	}
	return time.Parse(time.RFC3339, value)
}
