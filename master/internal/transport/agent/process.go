package agent

import (
	"context"

	"connectrpc.com/connect"

	"mypanel/agent/app/dto/request"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// ProcessServer 实现 panel.agent.v1.ProcessService。
type ProcessServer struct {
	service agentservice.IProcessService
}

// NewProcessServer 构造进程服务。
func NewProcessServer() *ProcessServer {
	return &ProcessServer{service: agentservice.NewIProcessService()}
}

// StopProcess 终止指定进程。
func (s *ProcessServer) StopProcess(
	_ context.Context,
	req *connect.Request[agentv1.StopProcessRequest],
) (*connect.Response[agentv1.StopProcessResponse], error) {
	if err := s.service.StopProcess(request.ProcessReq{PID: req.Msg.GetPid()}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.StopProcessResponse{}), nil
}

// GetProcessInfo 查询单个进程详情。
func (s *ProcessServer) GetProcessInfo(
	_ context.Context,
	req *connect.Request[agentv1.GetProcessInfoRequest],
) (*connect.Response[agentv1.ProcessInfo], error) {
	info, err := s.service.GetProcessInfoByPID(req.Msg.GetPid())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", err)
	}
	return connect.NewResponse(&agentv1.ProcessInfo{
		Pid:            info.PID,
		Name:           info.Name,
		Ppid:           info.PPID,
		Username:       info.Username,
		Status:         info.Status,
		StartTime:      info.StartTime,
		NumThreads:     info.NumThreads,
		NumConnections: int32(info.NumConnections),
		CpuPercent:     info.CpuPercent,
		DiskRead:       info.DiskRead,
		DiskWrite:      info.DiskWrite,
		CmdLine:        info.CmdLine,
		Rss:            info.Rss,
		Vms:            info.VMS,
		Hwm:            info.HWM,
		Data:           info.Data,
		Stack:          info.Stack,
		Locked:         info.Locked,
		Swap:           info.Swap,
		Dirty:          info.Dirty,
		Pss:            info.PSS,
		Uss:            info.USS,
		Shared:         info.Shared,
		Text:           info.Text,
		CpuValue:       info.CpuValue,
		RssValue:       info.RssValue,
		DetailJson:     marshalJSON(info),
	}), nil
}

// ListListeningProcess 列出正在监听的进程。
func (s *ProcessServer) ListListeningProcess(
	ctx context.Context,
	_ *connect.Request[agentv1.ListListeningProcessRequest],
) (*connect.Response[agentv1.ListListeningProcessResponse], error) {
	list, err := s.service.GetListeningProcess(ctx)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.ListeningProcess, 0, len(list))
	for _, item := range list {
		ports := make([]uint32, 0, len(item.Port))
		for port := range item.Port {
			ports = append(ports, port)
		}
		items = append(items, &agentv1.ListeningProcess{
			Pid:      item.PID,
			Ports:    ports,
			Protocol: item.Protocol,
			Name:     item.Name,
		})
	}
	return connect.NewResponse(&agentv1.ListListeningProcessResponse{Items: items}), nil
}
