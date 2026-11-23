package agent

import (
	"context"
	"time"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// GetLimit 读取 Docker 资源限制。
func (s *ContainerServer) GetLimit(
	_ context.Context,
	_ *connect.Request[agentv1.GetContainerLimitRequest],
) (*connect.Response[agentv1.ContainerLimit], error) {
	info, err := s.service.LoadResourceLimit()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ContainerLimit{
		Cpu:    int32(info.CPU),
		Memory: info.Memory,
	}), nil
}

// OperateContainers 批量操作容器。
func (s *ContainerServer) OperateContainers(
	_ context.Context,
	req *connect.Request[agentv1.OperateContainersRequest],
) (*connect.Response[agentv1.OperateContainersResponse], error) {
	if err := s.service.ContainerOperation(agentdto.ContainerOperation{
		TaskID:    req.Msg.GetTaskId(),
		Names:     req.Msg.GetNames(),
		Operation: req.Msg.GetOperation(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateContainersResponse{}), nil
}

// RenameContainer 重命名容器。
func (s *ContainerServer) RenameContainer(
	_ context.Context,
	req *connect.Request[agentv1.RenameContainerRequest],
) (*connect.Response[agentv1.RenameContainerResponse], error) {
	if err := s.service.ContainerRename(agentdto.ContainerRename{
		Name:    req.Msg.GetName(),
		NewName: req.Msg.GetNewName(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RenameContainerResponse{}), nil
}

// Prune 清理容器资源。
func (s *ContainerServer) Prune(
	_ context.Context,
	req *connect.Request[agentv1.PruneContainersRequest],
) (*connect.Response[agentv1.PruneContainersResponse], error) {
	if err := s.service.Prune(agentdto.ContainerPrune{
		TaskID:     req.Msg.GetTaskId(),
		PruneType:  req.Msg.GetPruneType(),
		WithTagAll: req.Msg.GetWithTagAll(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.PruneContainersResponse{}), nil
}

// CleanLogs 清理容器日志。
func (s *ContainerServer) CleanLogs(
	_ context.Context,
	req *connect.Request[agentv1.CleanContainerLogsRequest],
) (*connect.Response[agentv1.CleanContainerLogsResponse], error) {
	if err := s.service.ContainerLogClean(agentdto.OperationWithName{Name: req.Msg.GetName()}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CleanContainerLogsResponse{}), nil
}

// ListNetworks 列出网络。
func (s *ContainerServer) ListNetworks(
	_ context.Context,
	_ *connect.Request[agentv1.ListNetworksRequest],
) (*connect.Response[agentv1.ContainerOptions], error) {
	list, err := s.service.ListNetwork()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ContainerOptions{Items: optionValues(list)}), nil
}

// CreateNetwork 创建网络。
func (s *ContainerServer) CreateNetwork(
	_ context.Context,
	req *connect.Request[agentv1.CreateNetworkRequest],
) (*connect.Response[agentv1.CreateNetworkResponse], error) {
	if err := s.service.CreateNetwork(agentdto.NetworkCreate{
		Name:         req.Msg.GetName(),
		Driver:       req.Msg.GetDriver(),
		Options:      req.Msg.GetOptions(),
		Ipv4:         req.Msg.GetIpv4(),
		Subnet:       req.Msg.GetSubnet(),
		Gateway:      req.Msg.GetGateway(),
		IPRange:      req.Msg.GetIpRange(),
		AuxAddress:   auxAddressToDTO(req.Msg.GetAuxAddress()),
		Ipv6:         req.Msg.GetIpv6(),
		SubnetV6:     req.Msg.GetSubnetV6(),
		GatewayV6:    req.Msg.GetGatewayV6(),
		IPRangeV6:    req.Msg.GetIpRangeV6(),
		AuxAddressV6: auxAddressToDTO(req.Msg.GetAuxAddressV6()),
		Labels:       req.Msg.GetLabels(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateNetworkResponse{}), nil
}

// DeleteNetworks 批量删除网络。
func (s *ContainerServer) DeleteNetworks(
	_ context.Context,
	req *connect.Request[agentv1.DeleteNetworksRequest],
) (*connect.Response[agentv1.DeleteNetworksResponse], error) {
	if err := s.service.DeleteNetwork(agentdto.BatchDelete{
		TaskID: req.Msg.GetTaskId(),
		Names:  req.Msg.GetNames(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteNetworksResponse{}), nil
}

// ListVolumes 列出卷。
func (s *ContainerServer) ListVolumes(
	_ context.Context,
	_ *connect.Request[agentv1.ListVolumesRequest],
) (*connect.Response[agentv1.ContainerOptions], error) {
	list, err := s.service.ListVolume()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ContainerOptions{Items: optionValues(list)}), nil
}

// CreateVolume 创建卷。
func (s *ContainerServer) CreateVolume(
	_ context.Context,
	req *connect.Request[agentv1.CreateVolumeRequest],
) (*connect.Response[agentv1.CreateVolumeResponse], error) {
	if err := s.service.CreateVolume(agentdto.VolumeCreate{
		Name:    req.Msg.GetName(),
		Driver:  req.Msg.GetDriver(),
		Options: req.Msg.GetOptions(),
		Labels:  req.Msg.GetLabels(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateVolumeResponse{}), nil
}

// DeleteVolumes 批量删除卷。
func (s *ContainerServer) DeleteVolumes(
	_ context.Context,
	req *connect.Request[agentv1.DeleteVolumesRequest],
) (*connect.Response[agentv1.DeleteVolumesResponse], error) {
	if err := s.service.DeleteVolume(agentdto.BatchDelete{
		TaskID: req.Msg.GetTaskId(),
		Names:  req.Msg.GetNames(),
		Force:  req.Msg.GetForce(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteVolumesResponse{}), nil
}

// RemoveImages 删除镜像。
func (s *ContainerServer) RemoveImages(
	_ context.Context,
	req *connect.Request[agentv1.RemoveImagesRequest],
) (*connect.Response[agentv1.RemoveImagesResponse], error) {
	if err := s.image.ImageRemove(agentdto.BatchDelete{
		TaskID: req.Msg.GetTaskId(),
		Names:  req.Msg.GetNames(),
		Force:  req.Msg.GetForce(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RemoveImagesResponse{}), nil
}

// TagImage 给镜像打标签。
func (s *ContainerServer) TagImage(
	_ context.Context,
	req *connect.Request[agentv1.TagImageRequest],
) (*connect.Response[agentv1.TagImageResponse], error) {
	if err := s.image.ImageTag(agentdto.ImageTag{
		SourceID: req.Msg.GetSourceId(),
		Tags:     req.Msg.GetTags(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.TagImageResponse{}), nil
}

// GetComposeEnv 读取 Compose 的 .env 内容。
func (s *ContainerServer) GetComposeEnv(
	_ context.Context,
	req *connect.Request[agentv1.GetComposeEnvRequest],
) (*connect.Response[agentv1.ComposeEnv], error) {
	content, err := s.service.LoadComposeEnv(req.Msg.GetName())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ComposeEnv{Content: content}), nil
}

// TestCompose 校验 Compose 文件。
func (s *ContainerServer) TestCompose(
	_ context.Context,
	req *connect.Request[agentv1.TestComposeRequest],
) (*connect.Response[agentv1.TestComposeResponse], error) {
	ok, err := s.service.TestCompose(agentdto.ComposeCreate{
		Name: "test",
		Path: req.Msg.GetPath(),
		From: "edit",
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.TestComposeResponse{Ok: ok}), nil
}

// OperateCompose 操作 Compose 项目。
func (s *ContainerServer) OperateCompose(
	_ context.Context,
	req *connect.Request[agentv1.OperateComposeRequest],
) (*connect.Response[agentv1.OperateComposeResponse], error) {
	if err := s.service.ComposeOperation(agentdto.ComposeOperation{
		Name:      req.Msg.GetName(),
		Path:      req.Msg.GetPath(),
		Operation: req.Msg.GetOperation(),
		WithFile:  req.Msg.GetWithFile(),
		Force:     req.Msg.GetForce(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateComposeResponse{}), nil
}

// PinCompose 置顶 Compose 项目。
func (s *ContainerServer) PinCompose(
	_ context.Context,
	req *connect.Request[agentv1.PinComposeRequest],
) (*connect.Response[agentv1.PinComposeResponse], error) {
	if err := s.service.ComposePin(agentdto.ComposePin{
		Name:     req.Msg.GetName(),
		IsPinned: req.Msg.GetIsPinned(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.PinComposeResponse{}), nil
}

// CleanComposeLogs 清理 Compose 日志。
func (s *ContainerServer) CleanComposeLogs(
	_ context.Context,
	req *connect.Request[agentv1.CleanComposeLogsRequest],
) (*connect.Response[agentv1.CleanComposeLogsResponse], error) {
	if err := s.service.ComposeLogClean(agentdto.ComposeLogClean{
		Name:       req.Msg.GetName(),
		Path:       req.Msg.GetPath(),
		DetailPath: req.Msg.GetDetailPath(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CleanComposeLogsResponse{}), nil
}

// optionValues 提取名称列表。
func optionValues(list []agentdto.Options) []string {
	result := make([]string, 0, len(list))
	for _, item := range list {
		result = append(result, item.Option)
	}
	return result
}

// auxAddressToDTO 转换辅助地址列表。
func auxAddressToDTO(list []*agentv1.AuxAddress) []agentdto.SettingUpdate {
	result := make([]agentdto.SettingUpdate, 0, len(list))
	for _, item := range list {
		result = append(result, agentdto.SettingUpdate{Key: item.GetKey(), Value: item.GetValue()})
	}
	return result
}

// ListContainers 列出容器。
func (s *ContainerServer) ListContainers(
	_ context.Context,
	_ *connect.Request[agentv1.ListContainersRequest],
) (*connect.Response[agentv1.ContainerOptions], error) {
	return connect.NewResponse(&agentv1.ContainerOptions{Items: containerOptionNames(s.service.List())}), nil
}

// ListContainersByImage 按镜像列出容器。
func (s *ContainerServer) ListContainersByImage(
	_ context.Context,
	req *connect.Request[agentv1.ListContainersByImageRequest],
) (*connect.Response[agentv1.ContainerOptions], error) {
	return connect.NewResponse(&agentv1.ContainerOptions{
		Items: containerOptionNames(s.service.ListByImage(req.Msg.GetImage())),
	}), nil
}

// GetContainerUsers 列出容器运行用户。
func (s *ContainerServer) GetContainerUsers(
	_ context.Context,
	req *connect.Request[agentv1.GetContainerUsersRequest],
) (*connect.Response[agentv1.ContainerUsers], error) {
	users := s.service.LoadUsers(agentdto.OperationWithName{Name: req.Msg.GetName()})
	items := make([]string, 0, len(users))
	items = append(items, users...)
	return connect.NewResponse(&agentv1.ContainerUsers{Items: items}), nil
}

// GetContainerStats 批量读取资源占用。
func (s *ContainerServer) GetContainerStats(
	ctx context.Context,
	req *connect.Request[agentv1.GetContainerStatsRequest],
) (*connect.Response[agentv1.ContainerStatsList], error) {
	list, err := s.service.ContainerListStats(ctx, req.Msg.GetIds())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.ContainerStatsItem, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.ContainerStatsItem{
			ContainerId:   item.ContainerID,
			ContainerName: item.ContainerName,
			CpuTotalUsage: item.CPUTotalUsage,
			SystemUsage:   item.SystemUsage,
			CpuPercent:    item.CPUPercent,
			PercpuUsage:   int32(item.PercpuUsage),
			MemoryCache:   item.MemoryCache,
			MemoryUsage:   item.MemoryUsage,
			MemoryLimit:   item.MemoryLimit,
			MemoryPercent: item.MemoryPercent,
		})
	}
	return connect.NewResponse(&agentv1.ContainerStatsList{Items: items}), nil
}

// GetContainerItemStats 读取单容器磁盘占用。
func (s *ContainerServer) GetContainerItemStats(
	ctx context.Context,
	req *connect.Request[agentv1.GetContainerItemStatsRequest],
) (*connect.Response[agentv1.ContainerItemStats], error) {
	item, err := s.service.ContainerItemStats(ctx, agentdto.OperationWithName{Name: req.Msg.GetName()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ContainerItemStats{
		SizeRw:                item.SizeRw,
		SizeRootFs:            item.SizeRootFs,
		ContainerUsage:        item.ContainerUsage,
		ContainerReclaimable:  item.ContainerReclaimable,
		ImageUsage:            item.ImageUsage,
		ImageReclaimable:      item.ImageReclaimable,
		VolumeUsage:           item.VolumeUsage,
		VolumeReclaimable:     item.VolumeReclaimable,
		BuildCacheUsage:       item.BuildCacheUsage,
		BuildCacheReclaimable: item.BuildCacheReclaimable,
	}), nil
}

// SampleContainerStats 采样一次实时指标。
func (s *ContainerServer) SampleContainerStats(
	_ context.Context,
	req *connect.Request[agentv1.SampleContainerStatsRequest],
) (*connect.Response[agentv1.ContainerStatsSample], error) {
	item, err := s.service.ContainerStats(req.Msg.GetId())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ContainerStatsSample{
		CpuPercent: item.CPUPercent,
		Memory:     item.Memory,
		Cache:      item.Cache,
		IoRead:     item.IORead,
		IoWrite:    item.IOWrite,
		NetworkRx:  item.NetworkRX,
		NetworkTx:  item.NetworkTX,
		ShotTime:   item.ShotTime.Format(time.RFC3339),
	}), nil
}

// containerOptionNames 提取容器名列表。
func containerOptionNames(list []agentdto.ContainerOptions) []string {
	result := make([]string, 0, len(list))
	for _, item := range list {
		result = append(result, item.Name)
	}
	return result
}
