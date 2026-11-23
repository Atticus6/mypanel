package agent

import (
	"context"
	"encoding/json"
	"net/http"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentmodel "mypanel/agent/app/model"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/bridge"
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

// GetAppLauncher 列出首页应用启动器。
func (s *DashboardServer) GetAppLauncher(
	ctx context.Context,
	_ *connect.Request[agentv1.GetAppLauncherRequest],
) (*connect.Response[agentv1.AppLauncherList], error) {
	c := bridge.GinContext(ctx)
	if c == nil {
		c, _ = bridge.New(ctx, http.Header{}, "", http.MethodPost, "/rpc")
	}
	list, err := s.service.LoadAppLauncher(c)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.AppLauncherEntry, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.AppLauncherEntry{
			Key:         item.Key,
			Type:        item.Type,
			Name:        item.Name,
			Icon:        item.Icon,
			Limit:       int32(item.Limit),
			Description: item.Description,
			Recommend:   int32(item.Recommend),
			IsInstall:   item.IsInstall,
			IsRecommend: item.IsRecommend,
			DetailJson:  marshalJSON(item.Detail),
		})
	}
	return connect.NewResponse(&agentv1.AppLauncherList{Items: items}), nil
}

// GetLauncherOptions 列出可添加到启动器的应用。
func (s *DashboardServer) GetLauncherOptions(
	_ context.Context,
	req *connect.Request[agentv1.GetLauncherOptionsRequest],
) (*connect.Response[agentv1.LauncherOptions], error) {
	list, err := s.service.ListLauncherOption(req.Msg.GetFilter())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.LauncherOption, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.LauncherOption{Key: item.Key, IsShow: item.IsShow})
	}
	return connect.NewResponse(&agentv1.LauncherOptions{Items: items}), nil
}

// SetLauncherShow 设置启动器应用的显示状态。
func (s *DashboardServer) SetLauncherShow(
	_ context.Context,
	req *connect.Request[agentv1.SetLauncherShowRequest],
) (*connect.Response[agentv1.SetLauncherShowResponse], error) {
	if err := s.service.ChangeShow(agentdto.SettingUpdate{
		Key:   req.Msg.GetKey(),
		Value: req.Msg.GetValue(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SetLauncherShowResponse{}), nil
}

// GetNodeCurrent 读取当前节点负载信息。
func (s *DashboardServer) GetNodeCurrent(
	_ context.Context,
	_ *connect.Request[agentv1.GetNodeCurrentRequest],
) (*connect.Response[agentv1.NodeCurrent], error) {
	data := s.service.LoadCurrentInfoForNode()
	return connect.NewResponse(&agentv1.NodeCurrent{
		Load1:                 data.Load1,
		Load5:                 data.Load5,
		Load15:                data.Load15,
		LoadUsagePercent:      data.LoadUsagePercent,
		CpuUsedPercent:        data.CPUUsedPercent,
		CpuUsed:               data.CPUUsed,
		CpuTotal:              int32(data.CPUTotal),
		CpuDetailedPercent:    data.CPUDetailedPercent,
		MemoryTotal:           data.MemoryTotal,
		MemoryAvailable:       data.MemoryAvailable,
		MemoryUsed:            data.MemoryUsed,
		MemoryUsedPercent:     data.MemoryUsedPercent,
		SwapMemoryTotal:       data.SwapMemoryTotal,
		SwapMemoryAvailable:   data.SwapMemoryAvailable,
		SwapMemoryUsed:        data.SwapMemoryUsed,
		SwapMemoryUsedPercent: data.SwapMemoryUsedPercent,
	}), nil
}

// GetTopCPU 读取 CPU 占用最高的进程。
func (s *DashboardServer) GetTopCPU(
	_ context.Context,
	_ *connect.Request[agentv1.GetTopCPURequest],
) (*connect.Response[agentv1.TopProcesses], error) {
	return connect.NewResponse(&agentv1.TopProcesses{Items: fromTopProcesses(s.service.LoadTopCPU())}), nil
}

// GetTopMem 读取内存占用最高的进程。
func (s *DashboardServer) GetTopMem(
	_ context.Context,
	_ *connect.Request[agentv1.GetTopMemRequest],
) (*connect.Response[agentv1.TopProcesses], error) {
	return connect.NewResponse(&agentv1.TopProcesses{Items: fromTopProcesses(s.service.LoadTopMem())}), nil
}

// ChangeQuickJump 修改首页快速跳转的显示状态。
func (s *DashboardServer) ChangeQuickJump(
	_ context.Context,
	req *connect.Request[agentv1.ChangeQuickJumpRequest],
) (*connect.Response[agentv1.ChangeQuickJumpResponse], error) {
	var quicks []agentdto.QuickVisibility
	if err := json.Unmarshal([]byte(req.Msg.GetQuicksJson()), &quicks); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.ChangeQuick(agentdto.ChangeQuicks{Quicks: quicks}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ChangeQuickJumpResponse{}), nil
}

// GetQuickDirectories 列出快捷目录。
func (s *DashboardServer) GetQuickDirectories(
	_ context.Context,
	_ *connect.Request[agentv1.GetQuickDirectoriesRequest],
) (*connect.Response[agentv1.QuickDirectories], error) {
	list, err := s.service.ListQuickDirectories()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.QuickDirectory, 0, len(list))
	for _, item := range list {
		items = append(items, fromQuickDirectory(&item))
	}
	return connect.NewResponse(&agentv1.QuickDirectories{Items: items}), nil
}

// CreateQuickDirectory 新建快捷目录。
func (s *DashboardServer) CreateQuickDirectory(
	_ context.Context,
	req *connect.Request[agentv1.CreateQuickDirectoryRequest],
) (*connect.Response[agentv1.QuickDirectory], error) {
	item, err := s.service.CreateQuickDirectory(agentdto.QuickDirectoryCreate{
		Path:  req.Msg.GetPath(),
		Alias: req.Msg.GetAlias(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(fromQuickDirectory(item)), nil
}

// UpdateQuickDirectory 更新快捷目录。
func (s *DashboardServer) UpdateQuickDirectory(
	_ context.Context,
	req *connect.Request[agentv1.UpdateQuickDirectoryRequest],
) (*connect.Response[agentv1.QuickDirectory], error) {
	item, err := s.service.UpdateQuickDirectory(agentdto.QuickDirectoryUpdate{
		QuickDirectoryDelete: agentdto.QuickDirectoryDelete{
			ID:     uint(req.Msg.GetId()),
			Legacy: req.Msg.GetLegacy(),
		},
		QuickDirectoryCreate: agentdto.QuickDirectoryCreate{
			Path:  req.Msg.GetPath(),
			Alias: req.Msg.GetAlias(),
		},
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(fromQuickDirectory(item)), nil
}

// DeleteQuickDirectory 删除快捷目录。
func (s *DashboardServer) DeleteQuickDirectory(
	_ context.Context,
	req *connect.Request[agentv1.DeleteQuickDirectoryRequest],
) (*connect.Response[agentv1.DeleteQuickDirectoryResponse], error) {
	if err := s.service.DeleteQuickDirectory(agentdto.QuickDirectoryDelete{
		ID:     uint(req.Msg.GetId()),
		Legacy: req.Msg.GetLegacy(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteQuickDirectoryResponse{}), nil
}

// SystemRestart 执行主机电源操作。
func (s *DashboardServer) SystemRestart(
	_ context.Context,
	req *connect.Request[agentv1.SystemRestartRequest],
) (*connect.Response[agentv1.SystemRestartResponse], error) {
	if err := s.service.Restart(req.Msg.GetOperation()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SystemRestartResponse{}), nil
}

// fromTopProcesses 把进程信息转成 proto。
func fromTopProcesses(list []agentdto.Process) []*agentv1.TopProcess {
	items := make([]*agentv1.TopProcess, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.TopProcess{
			Name:    item.Name,
			Pid:     item.Pid,
			Percent: item.Percent,
			Memory:  item.Memory,
			Cmd:     item.Cmd,
			User:    item.User,
		})
	}
	return items
}

// fromQuickDirectory 把快捷目录模型转成 proto。
func fromQuickDirectory(item *agentmodel.QuickDirectory) *agentv1.QuickDirectory {
	if item == nil {
		return &agentv1.QuickDirectory{}
	}
	return &agentv1.QuickDirectory{
		Id:     uint32(item.ID),
		Path:   item.Path,
		Alias:  item.Alias,
		Legacy: item.Legacy,
	}
}
