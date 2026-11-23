package agent

import (
	"context"
	"time"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentmodel "mypanel/agent/app/model"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/conv"
	"mypanel/master/internal/transport/errmap"
)

// 监控序列里 Value 元素的实际类型，用于按 param 断言。
type (
	monitorBaseModel    = agentmodel.MonitorBase
	monitorIOModel      = agentmodel.MonitorIO
	monitorNetworkModel = agentmodel.MonitorNetwork
)

// MonitorServer 实现 panel.agent.v1.MonitorService。
type MonitorServer struct {
	service *agentservice.MonitorService
}

// NewMonitorServer 构造主机监控服务。
func NewMonitorServer() *MonitorServer {
	return &MonitorServer{service: &agentservice.MonitorService{}}
}

// Search 按时间范围查询监控数据。
func (s *MonitorServer) Search(
	_ context.Context,
	req *connect.Request[agentv1.SearchMonitorRequest],
) (*connect.Response[agentv1.SearchMonitorResponse], error) {
	start, err := time.Parse(time.RFC3339, req.Msg.GetStartTime())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	end, err := time.Parse(time.RFC3339, req.Msg.GetEndTime())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	list, err := s.service.LoadMonitorData(agentdto.MonitorSearch{
		Param:     req.Msg.GetParam(),
		IO:        req.Msg.GetIo(),
		Network:   req.Msg.GetNetwork(),
		StartTime: start,
		EndTime:   end,
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.MonitorSeries, 0, len(list))
	for _, item := range list {
		items = append(items, monitorSeriesFromDTO(item))
	}
	return connect.NewResponse(&agentv1.SearchMonitorResponse{Items: items}), nil
}

// GetSetting 读取监控设置。
func (s *MonitorServer) GetSetting(
	_ context.Context,
	_ *connect.Request[agentv1.GetMonitorSettingRequest],
) (*connect.Response[agentv1.MonitorSetting], error) {
	info, err := s.service.LoadSetting()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.MonitorSetting{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	// DTO 的 json tag 是 defaultIO，protojson 只认 defaultIo，需要手动补一次。
	msg.DefaultIo = info.DefaultIO
	return connect.NewResponse(msg), nil
}

// UpdateSetting 修改监控设置的单项。
func (s *MonitorServer) UpdateSetting(
	_ context.Context,
	req *connect.Request[agentv1.UpdateMonitorSettingRequest],
) (*connect.Response[agentv1.UpdateMonitorSettingResponse], error) {
	if err := s.service.UpdateSetting(req.Msg.GetKey(), req.Msg.GetValue()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateMonitorSettingResponse{}), nil
}

// Clean 清空监控历史数据。
func (s *MonitorServer) Clean(
	_ context.Context,
	req *connect.Request[agentv1.CleanMonitorRequest],
) (*connect.Response[agentv1.CleanMonitorResponse], error) {
	if err := s.service.CleanData(req.Msg.GetType()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CleanMonitorResponse{}), nil
}

// ListIOOptions 读取磁盘设备列表。
func (s *MonitorServer) ListIOOptions(
	_ context.Context,
	_ *connect.Request[agentv1.ListMonitorIOOptionsRequest],
) (*connect.Response[agentv1.MonitorOptions], error) {
	return connect.NewResponse(&agentv1.MonitorOptions{Items: s.service.LoadIOOptions()}), nil
}

// ListNetworkOptions 读取网卡列表。
func (s *MonitorServer) ListNetworkOptions(
	_ context.Context,
	_ *connect.Request[agentv1.ListMonitorNetworkOptionsRequest],
) (*connect.Response[agentv1.MonitorOptions], error) {
	return connect.NewResponse(&agentv1.MonitorOptions{Items: s.service.LoadNetworkOptions()}), nil
}

// monitorSeriesFromDTO 把监控序列转成 proto。
//
// DTO 的 Value 是 []interface{}（不同 param 装不同结构），
// 这里按 param 断言到具体类型，避免在 proto 里用 google.protobuf.Value。
func monitorSeriesFromDTO(item agentdto.MonitorData) *agentv1.MonitorSeries {
	series := &agentv1.MonitorSeries{Param: item.Param}
	for _, date := range item.Date {
		series.Dates = append(series.Dates, date.Format(time.RFC3339))
	}
	for _, value := range item.Value {
		switch data := value.(type) {
		case monitorBaseModel:
			series.Base = append(series.Base, &agentv1.MonitorBasePoint{
				Cpu:         data.Cpu,
				Memory:      data.Memory,
				LoadUsage:   data.LoadUsage,
				CpuLoad1:    data.CpuLoad1,
				CpuLoad5:    data.CpuLoad5,
				CpuLoad15:   data.CpuLoad15,
				TopCpuItems: processesToProto(data.TopCPUItems),
				TopMemItems: processesToProto(data.TopMemItems),
			})
		case monitorIOModel:
			series.Io = append(series.Io, &agentv1.MonitorIOPoint{
				Name: data.Name, Read: data.Read, Write: data.Write, Count: data.Count, Time: data.Time,
			})
		case monitorNetworkModel:
			series.Network = append(series.Network, &agentv1.MonitorNetworkPoint{
				Name: data.Name, Up: data.Up, Down: data.Down,
			})
		}
	}
	return series
}

// processesToProto 转换进程列表；非 []dto.Process 时返回空。
func processesToProto(value any) []*agentv1.MonitorProcess {
	list, ok := value.([]agentdto.Process)
	if !ok {
		return nil
	}
	result := make([]*agentv1.MonitorProcess, 0, len(list))
	for _, item := range list {
		result = append(result, &agentv1.MonitorProcess{
			Name:    item.Name,
			Pid:     item.Pid,
			Percent: item.Percent,
			Memory:  item.Memory,
			Cmd:     item.Cmd,
			User:    item.User,
		})
	}
	return result
}
