package agent

import (
	"context"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

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
