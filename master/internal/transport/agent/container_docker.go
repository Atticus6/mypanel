package agent

import (
	"context"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	agentservice "mypanel/agent/app/service"

	"mypanel/master/internal/transport/errmap"
)

// dockerService 是 Docker 守护进程管理服务，与容器服务分开持有。
func dockerService() *agentservice.DockerService {
	return &agentservice.DockerService{}
}

// GetDockerStatus 读取 Docker 服务状态。
func (s *ContainerServer) GetDockerStatus(
	_ context.Context,
	_ *connect.Request[agentv1.GetDockerStatusRequest],
) (*connect.Response[agentv1.DockerStatus], error) {
	status := dockerService().LoadDockerStatus()
	return connect.NewResponse(&agentv1.DockerStatus{
		IsActive: status.IsActive,
		IsExist:  status.IsExist,
	}), nil
}

// OperateDocker 启停或重启 Docker。
func (s *ContainerServer) OperateDocker(
	_ context.Context,
	req *connect.Request[agentv1.OperateDockerRequest],
) (*connect.Response[agentv1.OperateDockerResponse], error) {
	if err := dockerService().OperateDocker(agentdto.DockerOperation{Operation: req.Msg.GetOperation()}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateDockerResponse{}), nil
}

// PullImages 拉取镜像。
func (s *ContainerServer) PullImages(
	_ context.Context,
	req *connect.Request[agentv1.PullImagesRequest],
) (*connect.Response[agentv1.PullImagesResponse], error) {
	if err := s.image.ImagePull(agentdto.ImagePull{
		TaskID:    req.Msg.GetTaskId(),
		RepoID:    uint(req.Msg.GetRepoId()),
		ImageName: req.Msg.GetImageName(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.PullImagesResponse{}), nil
}

// PushImage 推送镜像。
func (s *ContainerServer) PushImage(
	_ context.Context,
	req *connect.Request[agentv1.PushImageRequest],
) (*connect.Response[agentv1.PushImageResponse], error) {
	if err := s.image.ImagePush(agentdto.ImagePush{
		TaskID:  req.Msg.GetTaskId(),
		RepoID:  uint(req.Msg.GetRepoId()),
		TagName: req.Msg.GetTagName(),
		Name:    req.Msg.GetName(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.PushImageResponse{}), nil
}

// BuildImage 构建镜像。
func (s *ContainerServer) BuildImage(
	_ context.Context,
	req *connect.Request[agentv1.BuildImageRequest],
) (*connect.Response[agentv1.BuildImageResponse], error) {
	if err := s.image.ImageBuild(agentdto.ImageBuild{
		TaskID:     req.Msg.GetTaskId(),
		From:       req.Msg.GetFrom(),
		Name:       req.Msg.GetName(),
		Dockerfile: req.Msg.GetDockerfile(),
		Tags:       req.Msg.GetTags(),
		Args:       req.Msg.GetArgs(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BuildImageResponse{}), nil
}

// SearchRemoteImages 搜索 Docker Hub。
func (s *ContainerServer) SearchRemoteImages(
	ctx context.Context,
	req *connect.Request[agentv1.SearchRemoteImagesRequest],
) (*connect.Response[agentv1.SearchRemoteImagesResponse], error) {
	result, err := s.image.SearchRemoteImages(ctx, agentdto.ImageRemoteSearch{
		Query:    req.Msg.GetQuery(),
		Page:     int(req.Msg.GetPage()),
		PageSize: int(req.Msg.GetPageSize()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.RemoteImage, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, &agentv1.RemoteImage{Name: item.Name, Description: item.Description})
	}
	return connect.NewResponse(&agentv1.SearchRemoteImagesResponse{
		Items:         items,
		Total:         result.Total,
		ProxyRequired: result.ProxyRequired,
	}), nil
}

// GetDaemonJson 读取 daemon.json 配置。
func (s *ContainerServer) GetDaemonJson(
	_ context.Context,
	_ *connect.Request[agentv1.GetDaemonJsonRequest],
) (*connect.Response[agentv1.DaemonJsonConf], error) {
	info, err := dockerService().LoadDockerConf()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DaemonJsonConf{
		Nvidia:             info.NVIDIA,
		NvidiaSupported:    info.NVIDIASupported,
		IsSwarm:            info.IsSwarm,
		Version:            info.Version,
		RegistryMirrors:    info.Mirrors,
		InsecureRegistries: info.Registries,
		LiveRestore:        info.LiveRestore,
		Iptables:           info.IPTables,
		CgroupDriver:       info.CgroupDriver,
		Ipv6:               info.Ipv6,
		FixedCidrV6:        info.FixedCidrV6,
		Ip6Tables:          info.Ip6Tables,
		Experimental:       info.Experimental,
		LogMaxSize:         info.LogMaxSize,
		LogMaxFile:         info.LogMaxFile,
	}), nil
}

// UpdateDaemonJson 修改 daemon.json 单项并重启 Docker。
func (s *ContainerServer) UpdateDaemonJson(
	_ context.Context,
	req *connect.Request[agentv1.UpdateDaemonJsonRequest],
) (*connect.Response[agentv1.UpdateDaemonJsonResponse], error) {
	if err := dockerService().UpdateConf(agentdto.SettingUpdate{
		Key:   req.Msg.GetKey(),
		Value: req.Msg.GetValue(),
	}, true); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateDaemonJsonResponse{}), nil
}

// UpdateDaemonJsonByFile 按文件替换 daemon.json。
func (s *ContainerServer) UpdateDaemonJsonByFile(
	_ context.Context,
	req *connect.Request[agentv1.UpdateDaemonJsonByFileRequest],
) (*connect.Response[agentv1.UpdateDaemonJsonByFileResponse], error) {
	if err := dockerService().UpdateConfByFile(agentdto.DaemonJsonUpdateByFile{File: req.Msg.GetFile()}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateDaemonJsonByFileResponse{}), nil
}

// UpdateLogOption 修改日志轮转配置。
func (s *ContainerServer) UpdateLogOption(
	_ context.Context,
	req *connect.Request[agentv1.UpdateDockerLogOptionRequest],
) (*connect.Response[agentv1.UpdateDockerLogOptionResponse], error) {
	if err := dockerService().UpdateLogOption(agentdto.LogOption{
		LogMaxSize: req.Msg.GetLogMaxSize(),
		LogMaxFile: req.Msg.GetLogMaxFile(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateDockerLogOptionResponse{}), nil
}

// UpdateIpv6Option 修改 IPv6 配置。
func (s *ContainerServer) UpdateIpv6Option(
	_ context.Context,
	req *connect.Request[agentv1.UpdateDockerIpv6OptionRequest],
) (*connect.Response[agentv1.UpdateDockerIpv6OptionResponse], error) {
	if err := dockerService().UpdateIpv6Option(agentdto.Ipv6Option{
		FixedCidrV6:  req.Msg.GetFixedCidrV6(),
		Ip6Tables:    req.Msg.GetIp6Tables(),
		Experimental: req.Msg.GetExperimental(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateDockerIpv6OptionResponse{}), nil
}
