package agent

import (
	"context"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// DashboardServer 实现 panel.agent.v1.DashboardService。
type DashboardServer struct {
	service *agentservice.DashboardService
}

// NewDashboardServer 构造首页概览服务。
func NewDashboardServer() *DashboardServer {
	return &DashboardServer{service: &agentservice.DashboardService{}}
}

// GetOsInfo 读取操作系统与磁盘概况。
func (s *DashboardServer) GetOsInfo(
	_ context.Context,
	_ *connect.Request[agentv1.OsInfoRequest],
) (*connect.Response[agentv1.OsInfo], error) {
	info, err := s.service.LoadOsInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OsInfo{
		Os:             info.OS,
		Platform:       info.Platform,
		PlatformFamily: info.PlatformFamily,
		KernelArch:     info.KernelArch,
		KernelVersion:  info.KernelVersion,
		PrettyDistro:   info.PrettyDistro,
		DiskSize:       info.DiskSize,
	}), nil
}

// BaseInfo 读取首页基础信息。
func (s *DashboardServer) BaseInfo(
	_ context.Context,
	req *connect.Request[agentv1.BaseInfoRequest],
) (*connect.Response[agentv1.DashboardBase], error) {
	info, err := s.service.LoadBaseInfo(defaultString(req.Msg.GetIoOption(), "all"), defaultString(req.Msg.GetNetOption(), "all"))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(fromDashboardBase(info)), nil
}

// CurrentInfo 读取当前负载。
func (s *DashboardServer) CurrentInfo(
	_ context.Context,
	req *connect.Request[agentv1.CurrentInfoRequest],
) (*connect.Response[agentv1.DashboardCurrent], error) {
	info := s.service.LoadCurrentInfo(defaultString(req.Msg.GetIoOption(), "all"), defaultString(req.Msg.GetNetOption(), "all"))
	return connect.NewResponse(fromDashboardCurrent(info)), nil
}

// QuickJumps 读取首页快捷入口。
func (s *DashboardServer) QuickJumps(
	_ context.Context,
	_ *connect.Request[agentv1.QuickJumpsRequest],
) (*connect.Response[agentv1.QuickJumpsResponse], error) {
	items := s.service.LoadQuickOptions()
	return connect.NewResponse(&agentv1.QuickJumpsResponse{Items: fromQuickJumps(items)}), nil
}

// fromDashboardBase 把 1Panel 的首页基础信息转成 proto。
func fromDashboardBase(info *agentdto.DashboardBase) *agentv1.DashboardBase {
	if info == nil {
		return &agentv1.DashboardBase{}
	}
	return &agentv1.DashboardBase{
		WebsiteNumber:        int32(info.WebsiteNumber),
		AgentNumber:          int32(info.AgentNumber),
		DatabaseNumber:       int32(info.DatabaseNumber),
		CronjobNumber:        int32(info.CronjobNumber),
		AppInstalledNumber:   int32(info.AppInstalledNumber),
		Hostname:             info.Hostname,
		Os:                   info.OS,
		Platform:             info.Platform,
		PlatformFamily:       info.PlatformFamily,
		PlatformVersion:      info.PlatformVersion,
		PrettyDistro:         info.PrettyDistro,
		KernelArch:           info.KernelArch,
		KernelVersion:        info.KernelVersion,
		VirtualizationSystem: info.VirtualizationSystem,
		IpV4Addr:             info.IpV4Addr,
		SystemProxy:          info.SystemProxy,
		CpuCores:             int32(info.CPUCores),
		CpuLogicalCores:      int32(info.CPULogicalCores),
		CpuModelName:         info.CPUModelName,
		CpuMhz:               info.CPUMhz,
		QuickJumps:           fromQuickJumps(info.QuickJumps),
		CurrentInfo:          fromDashboardCurrent(&info.CurrentInfo),
	}
}

// fromDashboardCurrent 把当前负载转成 proto。
func fromDashboardCurrent(info *agentdto.DashboardCurrent) *agentv1.DashboardCurrent {
	if info == nil {
		return &agentv1.DashboardCurrent{}
	}
	disks := make([]*agentv1.DiskInfo, 0, len(info.DiskData))
	for _, disk := range info.DiskData {
		disks = append(disks, &agentv1.DiskInfo{
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
	return &agentv1.DashboardCurrent{
		Uptime:          info.Uptime,
		TimeSinceUptime: info.TimeSinceUptime,
		RunningTime: &agentv1.RunningTime{
			Days:    info.RunningTime.Days,
			Hours:   info.RunningTime.Hours,
			Minutes: info.RunningTime.Minutes,
			Seconds: info.RunningTime.Seconds,
		},
		Procs:                 info.Procs,
		Load1:                 info.Load1,
		Load5:                 info.Load5,
		Load15:                info.Load15,
		LoadUsagePercent:      info.LoadUsagePercent,
		CpuPercent:            info.CPUPercent,
		CpuUsedPercent:        info.CPUUsedPercent,
		CpuUsed:               info.CPUUsed,
		CpuTotal:              int32(info.CPUTotal),
		CpuDetailedPercent:    info.CPUDetailedPercent,
		MemoryTotal:           info.MemoryTotal,
		MemoryUsed:            info.MemoryUsed,
		MemoryFree:            info.MemoryFree,
		MemoryShard:           info.MemoryShard,
		MemoryCache:           info.MemoryCache,
		MemoryAvailable:       info.MemoryAvailable,
		MemoryUsedPercent:     info.MemoryUsedPercent,
		SwapMemoryTotal:       info.SwapMemoryTotal,
		SwapMemoryAvailable:   info.SwapMemoryAvailable,
		SwapMemoryUsed:        info.SwapMemoryUsed,
		SwapMemoryUsedPercent: info.SwapMemoryUsedPercent,
		IoReadBytes:           info.IOReadBytes,
		IoWriteBytes:          info.IOWriteBytes,
		IoCount:               info.IOCount,
		IoReadTime:            info.IOReadTime,
		IoWriteTime:           info.IOWriteTime,
		DiskData:              disks,
		NetBytesSent:          info.NetBytesSent,
		NetBytesRecv:          info.NetBytesRecv,
		ShotTime:              formatTime(info.ShotTime),
	}
}

// fromQuickJumps 转换快捷入口列表。
func fromQuickJumps(items []agentdto.QuickJump) []*agentv1.QuickJump {
	result := make([]*agentv1.QuickJump, 0, len(items))
	for _, item := range items {
		result = append(result, &agentv1.QuickJump{
			Id:        uint32(item.ID),
			Name:      item.Name,
			Alias:     item.Alias,
			Title:     item.Title,
			Detail:    item.Detail,
			Recommend: int32(item.Recommend),
			IsShow:    item.IsShow,
			Router:    item.Router,
		})
	}
	return result
}
