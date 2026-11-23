package core

import (
	"context"
	"time"

	"connectrpc.com/connect"

	"mypanel/core/app/dto"
	"mypanel/core/app/service"
	corev1 "mypanel/proto/gen/go/panel/core/v1"

	"mypanel/master/internal/transport/errmap"
)

// formatTime 把时间格式化成 RFC3339；零值返回空字符串。
func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format(time.RFC3339)
}

// LogServer 实现 panel.core.v1.LogService。
type LogServer struct {
	logService service.ILogService
}

// NewLogServer 构造日志服务。
func NewLogServer() *LogServer {
	return &LogServer{logService: service.NewILogService()}
}

// SearchLoginLogs 分页查询登录日志。
func (s *LogServer) SearchLoginLogs(
	ctx context.Context,
	req *connect.Request[corev1.SearchLoginLogsRequest],
) (*connect.Response[corev1.SearchLoginLogsResponse], error) {
	search := dto.SearchLgLogWithPage{
		PageInfo: dto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
		Info:     req.Msg.GetInfo(),
		Status:   req.Msg.GetStatus(),
	}
	if req.Msg.GetStartTime() != "" {
		value, err := time.Parse(time.RFC3339, req.Msg.GetStartTime())
		if err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		search.StartTime = value
	}
	if req.Msg.GetEndTime() != "" {
		value, err := time.Parse(time.RFC3339, req.Msg.GetEndTime())
		if err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		search.EndTime = value
	}
	// 登录日志需要按请求语言本地化归属地名称，沿用旧的 gin 上下文。
	total, rows, err := s.logService.PageLoginLog(requireGinContext(ctx), search)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*corev1.LoginLogEntry, 0)
	if list, ok := rows.([]dto.LoginLog); ok {
		for _, item := range list {
			items = append(items, &corev1.LoginLogEntry{
				Id:        uint32(item.ID),
				Ip:        item.IP,
				User:      item.User,
				Address:   item.Address,
				Agent:     item.Agent,
				Status:    item.Status,
				Message:   item.Message,
				CreatedAt: formatTime(item.CreatedAt),
			})
		}
	}
	return connect.NewResponse(&corev1.SearchLoginLogsResponse{Items: items, Total: total}), nil
}

// SearchOperationLogs 分页查询操作日志。
func (s *LogServer) SearchOperationLogs(
	_ context.Context,
	req *connect.Request[corev1.SearchOperationLogsRequest],
) (*connect.Response[corev1.SearchOperationLogsResponse], error) {
	total, rows, err := s.logService.PageOperationLog(dto.SearchOpLogWithPage{
		PageInfo:  dto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
		Source:    req.Msg.GetSource(),
		Status:    req.Msg.GetStatus(),
		Node:      req.Msg.GetNode(),
		Operation: req.Msg.GetOperation(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*corev1.OperationLogEntry, 0)
	if list, ok := rows.([]dto.OperationLog); ok {
		for _, item := range list {
			items = append(items, &corev1.OperationLogEntry{
				Id:         uint32(item.ID),
				Source:     item.Source,
				User:       item.User,
				ApiKeyId:   item.APIKeyID,
				ApiKeyName: item.APIKeyName,
				AuthMethod: item.AuthMethod,
				Node:       item.Node,
				Ip:         item.IP,
				Path:       item.Path,
				Method:     item.Method,
				UserAgent:  item.UserAgent,
				LatencyMs:  item.Latency.Milliseconds(),
				Status:     item.Status,
				Message:    item.Message,
				DetailZh:   item.DetailZH,
				DetailEn:   item.DetailEN,
				CreatedAt:  formatTime(item.CreatedAt),
			})
		}
	}
	return connect.NewResponse(&corev1.SearchOperationLogsResponse{Items: items, Total: total}), nil
}

// CleanLogs 清空指定类型日志。
func (s *LogServer) CleanLogs(
	_ context.Context,
	req *connect.Request[corev1.CleanLogsRequest],
) (*connect.Response[corev1.CleanLogsResponse], error) {
	if err := s.logService.CleanLogs(req.Msg.GetLogType()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.CleanLogsResponse{}), nil
}
