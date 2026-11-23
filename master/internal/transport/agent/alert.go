package agent

import (
	"context"
	"net/url"
	"strings"
	"time"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentmodel "mypanel/agent/app/model"
	agentservice "mypanel/agent/app/service"
	"mypanel/agent/constant"
	agenti18n "mypanel/agent/i18n"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/bridge"
	"mypanel/master/internal/transport/errmap"
)

// AlertServer 实现 panel.agent.v1.AlertService。
type AlertServer struct {
	service agentservice.AlertService
}

// NewAlertServer 构造告警服务。
func NewAlertServer() *AlertServer {
	return &AlertServer{service: agentservice.AlertService{}}
}

// Page 分页查询告警配置。
func (s *AlertServer) Page(
	_ context.Context,
	req *connect.Request[agentv1.SearchAlertsRequest],
) (*connect.Response[agentv1.SearchAlertsResponse], error) {
	total, alerts, err := s.service.PageAlert(agentdto.AlertSearch{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		OrderBy: defaultString(req.Msg.GetOrderBy(), "createdAt"),
		Order:   defaultString(req.Msg.GetOrder(), "descending"),
		Type:    req.Msg.GetType(),
		Status:  req.Msg.GetStatus(),
		Method:  req.Msg.GetMethod(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	items := make([]*agentv1.Alert, 0, len(alerts))
	for _, alert := range alerts {
		items = append(items, fromAlertDTO(alert))
	}
	return connect.NewResponse(&agentv1.SearchAlertsResponse{
		Items: items,
		Total: total,
	}), nil
}

// fromAlertDTO 把告警信息转成 proto。
func fromAlertDTO(item agentdto.AlertDTO) *agentv1.Alert {
	return &agentv1.Alert{
		Id:             uint32(item.ID),
		Type:           item.Type,
		Cycle:          uint32(item.Cycle),
		Count:          uint32(item.Count),
		Method:         item.Method,
		Title:          item.Title,
		Project:        item.Project,
		TaskName:       item.TaskName,
		Status:         item.Status,
		SendCount:      uint32(item.SendCount),
		AdvancedParams: item.AdvancedParams,
		CreateUser:     item.CreateUser,
		UpdateUser:     item.UpdateUser,
		CreatedAt:      formatTime(item.CreatedAt),
		UpdatedAt:      formatTime(item.UpdatedAt),
	}
}

// CreateAlert 创建告警任务。
func (s *AlertServer) CreateAlert(
	ctx context.Context,
	req *connect.Request[agentv1.CreateAlertRequest],
) (*connect.Response[agentv1.CreateAlertResponse], error) {
	if err := s.service.CreateAlert(agentdto.AlertCreate{
		Type:           req.Msg.GetType(),
		Cycle:          uint(req.Msg.GetCycle()),
		Count:          uint(req.Msg.GetCount()),
		Method:         req.Msg.GetMethod(),
		Title:          req.Msg.GetTitle(),
		Project:        req.Msg.GetProject(),
		Status:         req.Msg.GetStatus(),
		SendCount:      uint(req.Msg.GetSendCount()),
		AdvancedParams: req.Msg.GetAdvancedParams(),
	}, alertAuditUser(ctx)); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateAlertResponse{}), nil
}

// DeleteAlert 删除告警任务。
func (s *AlertServer) DeleteAlert(
	_ context.Context,
	req *connect.Request[agentv1.DeleteAlertRequest],
) (*connect.Response[agentv1.DeleteAlertResponse], error) {
	if err := s.service.DeleteAlert(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteAlertResponse{}), nil
}

// UpdateAlert 更新告警任务。
func (s *AlertServer) UpdateAlert(
	ctx context.Context,
	req *connect.Request[agentv1.UpdateAlertRequest],
) (*connect.Response[agentv1.UpdateAlertResponse], error) {
	if err := s.service.UpdateAlert(agentdto.AlertUpdate{
		ID:             uint(req.Msg.GetId()),
		Type:           req.Msg.GetType(),
		Cycle:          uint(req.Msg.GetCycle()),
		Count:          uint(req.Msg.GetCount()),
		Method:         req.Msg.GetMethod(),
		Title:          req.Msg.GetTitle(),
		Project:        req.Msg.GetProject(),
		Status:         req.Msg.GetStatus(),
		SendCount:      uint(req.Msg.GetSendCount()),
		AdvancedParams: req.Msg.GetAdvancedParams(),
	}, alertAuditUser(ctx)); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateAlertResponse{}), nil
}

// UpdateAlertStatus 更新告警任务状态。
func (s *AlertServer) UpdateAlertStatus(
	_ context.Context,
	req *connect.Request[agentv1.UpdateAlertStatusRequest],
) (*connect.Response[agentv1.UpdateAlertStatusResponse], error) {
	if err := s.service.UpdateStatus(uint(req.Msg.GetId()), req.Msg.GetStatus()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateAlertStatusResponse{}), nil
}

// GetAlertDisks 列出可用于告警的磁盘。
func (s *AlertServer) GetAlertDisks(
	_ context.Context,
	_ *connect.Request[agentv1.GetAlertDisksRequest],
) (*connect.Response[agentv1.AlertDisksResponse], error) {
	disks, err := s.service.GetDisks()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.AlertDisk, 0, len(disks))
	for _, disk := range disks {
		items = append(items, &agentv1.AlertDisk{
			Path:              disk.Path,
			Type:              disk.Type,
			Device:            disk.Device,
			Total:             disk.Total,
			Free:              disk.Free,
			Used:              disk.Used,
			UsedPercent:       disk.UsedPercent,
			InodesTotal:       disk.InodesTotal,
			InodesUsed:        disk.InodesUsed,
			InodesFree:        disk.InodesFree,
			InodesUsedPercent: disk.InodesUsedPercent,
		})
	}
	return connect.NewResponse(&agentv1.AlertDisksResponse{Items: items}), nil
}

// SearchAlertLogs 分页查询告警日志。
func (s *AlertServer) SearchAlertLogs(
	_ context.Context,
	req *connect.Request[agentv1.SearchAlertLogsRequest],
) (*connect.Response[agentv1.AlertLogsResponse], error) {
	start, err := parseOptionalTime(req.Msg.GetStartTime())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	end, err := parseOptionalTime(req.Msg.GetEndTime())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	total, logs, err := s.service.PageAlertLogs(agentdto.AlertLogSearch{
		PageInfo:  agentdto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
		Count:     uint(req.Msg.GetCount()),
		Status:    req.Msg.GetStatus(),
		StartTime: start,
		EndTime:   end,
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.AlertLogEntry, 0, len(logs))
	for _, item := range logs {
		items = append(items, &agentv1.AlertLogEntry{
			Id:              uint32(item.ID),
			Type:            item.Type,
			Count:           uint32(item.Count),
			AlertId:         uint32(item.AlertId),
			AlertDetailJson: marshalJSON(item.AlertDetail),
			AlertRuleJson:   marshalJSON(item.AlertRule),
			Status:          item.Status,
			Method:          item.Method,
			Message:         item.Message,
			CreatedAt:       formatTime(item.CreatedAt),
			UpdatedAt:       formatTime(item.UpdatedAt),
		})
	}
	return connect.NewResponse(&agentv1.AlertLogsResponse{Items: items, Total: total}), nil
}

// CleanAlertLogs 清空告警日志。
func (s *AlertServer) CleanAlertLogs(
	_ context.Context,
	_ *connect.Request[agentv1.CleanAlertLogsRequest],
) (*connect.Response[agentv1.CleanAlertLogsResponse], error) {
	if err := s.service.CleanAlertLogs(); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CleanAlertLogsResponse{}), nil
}

// GetAlertClams 列出杀毒扫描结果。
func (s *AlertServer) GetAlertClams(
	_ context.Context,
	_ *connect.Request[agentv1.GetAlertClamsRequest],
) (*connect.Response[agentv1.AlertClamsResponse], error) {
	clams, err := s.service.GetClams()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.AlertClam, 0, len(clams))
	for _, item := range clams {
		items = append(items, &agentv1.AlertClam{
			Id:        uint32(item.ID),
			CreatedAt: formatTime(item.CreatedAt),
			UpdatedAt: formatTime(item.UpdatedAt),
			Name:      item.Name,
			Status:    item.Status,
			Path:      item.Path,
		})
	}
	return connect.NewResponse(&agentv1.AlertClamsResponse{Items: items}), nil
}

// GetAlertCronJobs 列出可用于告警的计划任务。
func (s *AlertServer) GetAlertCronJobs(
	_ context.Context,
	req *connect.Request[agentv1.GetAlertCronJobsRequest],
) (*connect.Response[agentv1.AlertCronJobsResponse], error) {
	jobs, err := s.service.GetCronJobs(agentdto.CronJobReq{
		Name:   req.Msg.GetName(),
		Status: req.Msg.GetStatus(),
		Type:   req.Msg.GetType(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.AlertCronJob, 0, len(jobs))
	for _, item := range jobs {
		items = append(items, &agentv1.AlertCronJob{
			Id:        uint32(item.ID),
			CreatedAt: formatTime(item.CreatedAt),
			UpdatedAt: formatTime(item.UpdatedAt),
			Name:      item.Name,
			Status:    item.Status,
			Type:      item.Type,
		})
	}
	return connect.NewResponse(&agentv1.AlertCronJobsResponse{Items: items}), nil
}

// GetAlertConfig 查询告警通知配置。
func (s *AlertServer) GetAlertConfig(
	_ context.Context,
	req *connect.Request[agentv1.GetAlertConfigRequest],
) (*connect.Response[agentv1.AlertConfigsResponse], error) {
	configs, err := s.service.GetAlertConfig(agentdto.AlertConfigQuery{ExcludeTypes: req.Msg.GetExcludeTypes()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.AlertConfigsResponse{Items: fromAlertConfigs(configs)}), nil
}

// SearchAlertConfigs 分页查询告警通知配置。
func (s *AlertServer) SearchAlertConfigs(
	_ context.Context,
	req *connect.Request[agentv1.SearchAlertConfigsRequest],
) (*connect.Response[agentv1.AlertConfigsResponse], error) {
	total, configs, err := s.service.PageAlertConfig(agentdto.AlertConfigPageReq{
		PageInfo:     agentdto.PageInfo{Page: int(req.Msg.GetPage()), PageSize: int(req.Msg.GetPageSize())},
		ExcludeTypes: req.Msg.GetExcludeTypes(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.AlertConfigsResponse{
		Items: fromAlertConfigs(configs),
		Total: total,
	}), nil
}

// UpdateAlertConfig 更新告警通知配置。
func (s *AlertServer) UpdateAlertConfig(
	ctx context.Context,
	req *connect.Request[agentv1.UpdateAlertConfigRequest],
) (*connect.Response[agentv1.UpdateAlertConfigResponse], error) {
	var revision *time.Time
	if raw := req.Msg.GetRevision(); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		revision = &parsed
	}
	if err := s.service.UpdateAlertConfig(agentdto.AlertConfigUpdate{
		ID:          uint(req.Msg.GetId()),
		Type:        req.Msg.GetType(),
		Title:       req.Msg.GetTitle(),
		Status:      req.Msg.GetStatus(),
		Config:      req.Msg.GetConfig(),
		DisplayName: req.Msg.GetDisplayName(),
		Revision:    revision,
	}, alertAuditUser(ctx)); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	return connect.NewResponse(&agentv1.UpdateAlertConfigResponse{}), nil
}

// UpdateAlertConfigStatus 更新告警通知配置状态。
func (s *AlertServer) UpdateAlertConfigStatus(
	ctx context.Context,
	req *connect.Request[agentv1.UpdateAlertConfigStatusRequest],
) (*connect.Response[agentv1.UpdateAlertConfigStatusResponse], error) {
	if _, err := s.service.UpdateAlertConfigStatus(agentdto.AlertConfigStatusUpdate{
		ID:     uint(req.Msg.GetId()),
		Status: req.Msg.GetStatus(),
	}, alertAuditUser(ctx)); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateAlertConfigStatusResponse{}), nil
}

// DeleteAlertConfig 删除告警通知配置。
func (s *AlertServer) DeleteAlertConfig(
	_ context.Context,
	req *connect.Request[agentv1.DeleteAlertConfigRequest],
) (*connect.Response[agentv1.DeleteAlertConfigResponse], error) {
	if _, err := s.service.DeleteAlertConfig(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteAlertConfigResponse{}), nil
}

// TestAlertConfig 测试告警通知配置。
func (s *AlertServer) TestAlertConfig(
	ctx context.Context,
	req *connect.Request[agentv1.TestAlertConfigRequest],
) (*connect.Response[agentv1.TestAlertConfigResponse], error) {
	data := agentdto.AlertConfigTest{
		ID:          uint(req.Msg.GetId()),
		Type:        req.Msg.GetType(),
		Config:      req.Msg.GetConfig(),
		Host:        req.Msg.GetHost(),
		Port:        int(req.Msg.GetPort()),
		Sender:      req.Msg.GetSender(),
		UserName:    req.Msg.GetUserName(),
		Password:    req.Msg.GetPassword(),
		DisplayName: req.Msg.GetDisplayName(),
		Encryption:  req.Msg.GetEncryption(),
		Recipient:   req.Msg.GetRecipient(),
	}
	if data.Type == constant.Custom {
		lang := alertLanguage(ctx)
		result, err := s.service.TestCustomAlertConfig(data, lang)
		if err != nil {
			result = agentdto.AlertConfigTestResult{Success: false}
		}
		// 响应体与错误详情可能包含凭据，不返回给前端。
		result.Response = ""
		result.Message = ""
		if !result.Success {
			result.Message = agenti18n.GetMsgByKeyAndLang(lang, "ErrWebhookTestFailed")
		}
		return connect.NewResponse(fromAlertTestResult(result)), nil
	}
	flag, err := s.service.TestAlertConfig(data)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.TestAlertConfigResponse{Success: flag}), nil
}

// alertAuditUser 从请求头读取操作人；上下文不是 HTTP 时回退为 system。
func alertAuditUser(ctx context.Context) string {
	c := bridge.GinContext(ctx)
	if c == nil {
		return "system"
	}
	name := strings.TrimSpace(c.GetHeader("X-Panel-User"))
	if name == "" {
		return "system"
	}
	if decoded, err := url.QueryUnescape(name); err == nil {
		return decoded
	}
	return name
}

// alertLanguage 读取请求语言；没有请求上下文时使用数据库配置。
func alertLanguage(ctx context.Context) string {
	c := bridge.GinContext(ctx)
	if c != nil {
		if lang := strings.TrimSpace(c.GetHeader("Accept-Language")); lang != "" {
			return lang
		}
	}
	return agenti18n.GetLanguageFromDB()
}

// fromAlertConfigs 把配置模型转成 proto。
func fromAlertConfigs(configs []agentmodel.AlertConfig) []*agentv1.AlertConfigEntry {
	items := make([]*agentv1.AlertConfigEntry, 0, len(configs))
	for _, item := range configs {
		items = append(items, &agentv1.AlertConfigEntry{
			Id:         uint32(item.ID),
			Uid:        item.UID,
			Type:       item.Type,
			Title:      item.Title,
			Status:     item.Status,
			Config:     item.Config,
			CreateUser: item.CreateUser,
			UpdateUser: item.UpdateUser,
			CreatedAt:  formatTime(item.CreatedAt),
			UpdatedAt:  formatTime(item.UpdatedAt),
		})
	}
	return items
}

// fromAlertTestResult 把测试结果转成 proto。
func fromAlertTestResult(result agentdto.AlertConfigTestResult) *agentv1.TestAlertConfigResponse {
	return &agentv1.TestAlertConfigResponse{
		Success:    result.Success,
		StatusCode: int32(result.StatusCode),
		Duration:   result.Duration,
		Message:    result.Message,
		Response:   result.Response,
	}
}
