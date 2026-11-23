package agent

import (
	"context"
	"encoding/json"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// ContainerServer 实现 panel.agent.v1.ContainerService。
type ContainerServer struct {
	service  *agentservice.ContainerService
	image    agentservice.IImageService
	repo     *agentservice.ImageRepoService
	template *agentservice.ComposeTemplateService
}

// NewContainerServer 构造容器管理服务。
func NewContainerServer() *ContainerServer {
	return &ContainerServer{
		service:  &agentservice.ContainerService{},
		image:    agentservice.NewIImageService(),
		repo:     &agentservice.ImageRepoService{},
		template: &agentservice.ComposeTemplateService{},
	}
}

// Search 分页查询容器。
func (s *ContainerServer) Search(
	ctx context.Context,
	req *connect.Request[agentv1.SearchContainersRequest],
) (*connect.Response[agentv1.SearchContainersResponse], error) {
	total, list, err := s.service.Page(ctx, agentdto.PageContainer{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Name:            req.Msg.GetName(),
		State:           defaultString(req.Msg.GetState(), "all"),
		OrderBy:         defaultString(req.Msg.GetOrderBy(), "createdAt"),
		Order:           defaultString(req.Msg.GetOrder(), "null"),
		Filters:         req.Msg.GetFilters(),
		ExcludeAppStore: req.Msg.GetExcludeAppStore(),
	})
	if err != nil {
		// Docker 未安装/未启动时同样是 Internal，前端按普通错误提示。
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	containers, _ := list.([]agentdto.ContainerInfo)
	items := make([]*agentv1.Container, 0, len(containers))
	for _, item := range containers {
		items = append(items, fromContainerInfo(item))
	}
	return connect.NewResponse(&agentv1.SearchContainersResponse{
		Items: items,
		Total: total,
	}), nil
}

// Status 读取容器相关资源数量统计。
func (s *ContainerServer) Status(
	ctx context.Context,
	req *connect.Request[agentv1.ContainerStatusRequest],
) (*connect.Response[agentv1.ContainerStatus], error) {
	status, err := s.service.LoadStatus(ctx, req.Msg.GetContainersOnly())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ContainerStatus{
		Created:              int32(status.Created),
		Running:              int32(status.Running),
		Paused:               int32(status.Paused),
		Restarting:           int32(status.Restarting),
		Removing:             int32(status.Removing),
		Exited:               int32(status.Exited),
		Dead:                 int32(status.Dead),
		ContainerCount:       int32(status.ContainerCount),
		ComposeCount:         int32(status.ComposeCount),
		ComposeTemplateCount: int32(status.ComposeTemplateCount),
		ImageCount:           int32(status.ImageCount),
		NetworkCount:         int32(status.NetworkCount),
		VolumeCount:          int32(status.VolumeCount),
		RepoCount:            int32(status.RepoCount),
	}), nil
}

// Inspect 查看容器/镜像/网络/卷的原始信息。
func (s *ContainerServer) Inspect(
	_ context.Context,
	req *connect.Request[agentv1.ContainerInspectRequest],
) (*connect.Response[agentv1.ContainerInspectResponse], error) {
	content, err := s.service.Inspect(agentdto.InspectReq{
		ID:     req.Msg.GetId(),
		Type:   req.Msg.GetType(),
		Detail: req.Msg.GetDetail(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ContainerInspectResponse{Content: content}), nil
}

// SearchImageRepos 分页查询镜像仓库。
func (s *ContainerServer) SearchImageRepos(
	_ context.Context,
	req *connect.Request[agentv1.SearchImageReposRequest],
) (*connect.Response[agentv1.SearchImageReposResponse], error) {
	total, list, err := s.repo.Page(agentdto.SearchWithPage{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info: req.Msg.GetInfo(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	rows, _ := list.([]agentdto.ImageRepoInfo)
	items := make([]*agentv1.ImageRepo, 0, len(rows))
	for _, row := range rows {
		items = append(items, &agentv1.ImageRepo{
			Id:          uint32(row.ID),
			CreatedAt:   formatTime(row.CreatedAt),
			Name:        row.Name,
			DownloadUrl: row.DownloadUrl,
			Protocol:    row.Protocol,
			Username:    row.Username,
			Auth:        row.Auth,
			Status:      row.Status,
			Message:     row.Message,
		})
	}
	return connect.NewResponse(&agentv1.SearchImageReposResponse{Items: items, Total: total}), nil
}

// SearchComposeTemplates 分页查询 Compose 模板。
func (s *ContainerServer) SearchComposeTemplates(
	_ context.Context,
	req *connect.Request[agentv1.SearchComposeTemplatesRequest],
) (*connect.Response[agentv1.SearchComposeTemplatesResponse], error) {
	total, list, err := s.template.SearchWithPage(agentdto.SearchWithPage{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info: req.Msg.GetInfo(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	rows, _ := list.([]agentdto.ComposeTemplateInfo)
	items := make([]*agentv1.ComposeTemplate, 0, len(rows))
	for _, row := range rows {
		items = append(items, &agentv1.ComposeTemplate{
			Id:          uint32(row.ID),
			CreatedAt:   formatTime(row.CreatedAt),
			Name:        row.Name,
			Description: row.Description,
			Content:     row.Content,
		})
	}
	return connect.NewResponse(&agentv1.SearchComposeTemplatesResponse{Items: items, Total: total}), nil
}

// SearchCompose 分页查询 Compose 项目。
func (s *ContainerServer) SearchCompose(
	_ context.Context,
	req *connect.Request[agentv1.SearchComposeRequest],
) (*connect.Response[agentv1.SearchComposeResponse], error) {
	total, list, err := s.service.PageCompose(agentdto.SearchWithPage{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info: req.Msg.GetInfo(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	rows, _ := list.([]agentdto.ComposeInfo)
	items := make([]*agentv1.ComposeProject, 0, len(rows))
	for _, row := range rows {
		containers := make([]*agentv1.ComposeContainer, 0, len(row.Containers))
		for _, c := range row.Containers {
			containers = append(containers, &agentv1.ComposeContainer{
				ContainerId: c.ContainerID,
				Name:        c.Name,
				CreateTime:  c.CreateTime,
				State:       c.State,
				Ports:       c.Ports,
			})
		}
		items = append(items, &agentv1.ComposeProject{
			Name:              row.Name,
			CreatedAt:         row.CreatedAt,
			CreatedBy:         row.CreatedBy,
			ContainerCount:    int32(row.ContainerCount),
			RunningCount:      int32(row.RunningCount),
			ConfigFile:        row.ConfigFile,
			Workdir:           row.Workdir,
			ComposeFileExists: row.ComposeFileExists,
			IsPinned:          row.IsPinned,
			Path:              row.Path,
			Containers:        containers,
			Env:               row.Env,
		})
	}
	return connect.NewResponse(&agentv1.SearchComposeResponse{Items: items, Total: total}), nil
}

// SearchImages 分页查询镜像。
func (s *ContainerServer) SearchImages(
	_ context.Context,
	req *connect.Request[agentv1.SearchImagesRequest],
) (*connect.Response[agentv1.SearchImagesResponse], error) {
	total, list, err := s.image.Page(agentdto.PageImage{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Name:    req.Msg.GetName(),
		OrderBy: defaultString(req.Msg.GetOrderBy(), "createdAt"),
		Order:   defaultString(req.Msg.GetOrder(), "descending"),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	rows, _ := list.([]agentdto.ImageInfo)
	items := make([]*agentv1.Image, 0, len(rows))
	for _, row := range rows {
		items = append(items, &agentv1.Image{
			Id:          row.ID,
			CreatedAt:   formatTime(row.CreatedAt),
			IsUsed:      row.IsUsed,
			Tags:        row.Tags,
			Size:        row.Size,
			IsPinned:    row.IsPinned,
			Description: row.Description,
		})
	}
	return connect.NewResponse(&agentv1.SearchImagesResponse{Items: items, Total: total}), nil
}

// SearchNetworks 分页查询网络。
func (s *ContainerServer) SearchNetworks(
	_ context.Context,
	req *connect.Request[agentv1.SearchNetworksRequest],
) (*connect.Response[agentv1.SearchNetworksResponse], error) {
	total, list, err := s.service.PageNetwork(agentdto.SearchWithPage{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info: req.Msg.GetInfo(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	rows, _ := list.([]agentdto.Network)
	items := make([]*agentv1.Network, 0, len(rows))
	for _, row := range rows {
		items = append(items, &agentv1.Network{
			Id:         row.ID,
			Name:       row.Name,
			Labels:     row.Labels,
			Driver:     row.Driver,
			IpamDriver: row.IPAMDriver,
			Subnet:     row.Subnet,
			Gateway:    row.Gateway,
			CreatedAt:  formatTime(row.CreatedAt),
			Attachable: row.Attachable,
		})
	}
	return connect.NewResponse(&agentv1.SearchNetworksResponse{Items: items, Total: total}), nil
}

// SearchVolumes 分页查询卷。
func (s *ContainerServer) SearchVolumes(
	_ context.Context,
	req *connect.Request[agentv1.SearchVolumesRequest],
) (*connect.Response[agentv1.SearchVolumesResponse], error) {
	total, list, err := s.service.PageVolume(agentdto.SearchWithPage{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Info: req.Msg.GetInfo(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	rows, _ := list.([]agentdto.Volume)
	items := make([]*agentv1.Volume, 0, len(rows))
	for _, row := range rows {
		labels := make([]*agentv1.VolumeOption, 0, len(row.Labels))
		for _, label := range row.Labels {
			labels = append(labels, &agentv1.VolumeOption{Key: label.Key, Value: label.Value})
		}
		options := make([]*agentv1.VolumeOption, 0, len(row.Options))
		for _, option := range row.Options {
			options = append(options, &agentv1.VolumeOption{Key: option.Key, Value: option.Value})
		}
		items = append(items, &agentv1.Volume{
			Name:       row.Name,
			Labels:     labels,
			Driver:     row.Driver,
			Mountpoint: row.Mountpoint,
			CreatedAt:  formatTime(row.CreatedAt),
			Options:    options,
		})
	}
	return connect.NewResponse(&agentv1.SearchVolumesResponse{Items: items, Total: total}), nil
}

// fromContainerInfo 把 Docker 容器信息转成 proto。
func fromContainerInfo(item agentdto.ContainerInfo) *agentv1.Container {
	return &agentv1.Container{
		ContainerId:    item.ContainerID,
		Name:           item.Name,
		ImageId:        item.ImageId,
		ImageName:      item.ImageName,
		CreateTime:     item.CreateTime,
		State:          item.State,
		RunTime:        item.RunTime,
		Network:        item.Network,
		Ports:          item.Ports,
		IsFromApp:      item.IsFromApp,
		IsFromCompose:  item.IsFromCompose,
		AppName:        item.AppName,
		AppInstallName: item.AppInstallName,
		Websites:       item.Websites,
		IsPinned:       item.IsPinned,
		Description:    item.Description,
		HasUpdate:      item.HasUpdate,
		LatestVersion:  item.LatestVersion,
		TargetImage:    item.TargetImage,
	}
}

// CreateContainer 创建容器。
func (s *ContainerServer) CreateContainer(
	_ context.Context,
	req *connect.Request[agentv1.CreateContainerRequest],
) (*connect.Response[agentv1.CreateContainerResponse], error) {
	var payload agentdto.ContainerOperate
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.ContainerCreate(payload, true); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateContainerResponse{}), nil
}

// CreateCompose 创建 Compose 项目。
func (s *ContainerServer) CreateCompose(
	_ context.Context,
	req *connect.Request[agentv1.CreateComposeRequest],
) (*connect.Response[agentv1.CreateComposeResponse], error) {
	var payload agentdto.ComposeCreate
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.CreateCompose(payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateComposeResponse{}), nil
}

// UpdateCompose 更新 Compose 项目。
func (s *ContainerServer) UpdateCompose(
	_ context.Context,
	req *connect.Request[agentv1.UpdateComposeRequest],
) (*connect.Response[agentv1.UpdateComposeResponse], error) {
	var payload agentdto.ComposeUpdate
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.ComposeUpdate(payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateComposeResponse{}), nil
}

// ContainerInfo 查询容器详情。
func (s *ContainerServer) ContainerInfo(
	_ context.Context,
	req *connect.Request[agentv1.ContainerInfoRequest],
) (*connect.Response[agentv1.ContainerInfoResponse], error) {
	info, err := s.service.ContainerInfo(agentdto.OperationWithName{Name: req.Msg.GetName()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", err)
	}
	return connect.NewResponse(&agentv1.ContainerInfoResponse{InfoJson: marshalJSON(info)}), nil
}

// ListImages 列出镜像标签选项。
func (s *ContainerServer) ListImages(
	_ context.Context,
	_ *connect.Request[agentv1.ListImagesRequest],
) (*connect.Response[agentv1.ImageOptionsResponse], error) {
	list, err := s.image.List()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]string, 0, len(list))
	for _, item := range list {
		items = append(items, item.Option)
	}
	return connect.NewResponse(&agentv1.ImageOptionsResponse{Items: items}), nil
}

// ListAllImages 列出全部镜像。
func (s *ContainerServer) ListAllImages(
	_ context.Context,
	_ *connect.Request[agentv1.ListAllImagesRequest],
) (*connect.Response[agentv1.ImageListResponse], error) {
	list, err := s.image.ListAll()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.ImageInfo, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.ImageInfo{
			Id:          item.ID,
			CreatedAt:   formatFileTime(item.CreatedAt),
			IsUsed:      item.IsUsed,
			Tags:        item.Tags,
			Size:        item.Size,
			IsPinned:    item.IsPinned,
			Description: item.Description,
		})
	}
	return connect.NewResponse(&agentv1.ImageListResponse{Items: items}), nil
}

// CommitContainer 将容器提交为新镜像。
func (s *ContainerServer) CommitContainer(
	_ context.Context,
	req *connect.Request[agentv1.CommitContainerRequest],
) (*connect.Response[agentv1.CommitContainerResponse], error) {
	var payload agentdto.ContainerCommit
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.ContainerCommit(payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CommitContainerResponse{}), nil
}

// UpdateContainer 更新容器配置。
func (s *ContainerServer) UpdateContainer(
	_ context.Context,
	req *connect.Request[agentv1.UpdateContainerRequest],
) (*connect.Response[agentv1.UpdateContainerResponse], error) {
	var payload agentdto.ContainerOperate
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.ContainerUpdate(payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateContainerResponse{}), nil
}

// UpgradeContainer 批量升级容器镜像。
func (s *ContainerServer) UpgradeContainer(
	_ context.Context,
	req *connect.Request[agentv1.UpgradeContainerRequest],
) (*connect.Response[agentv1.UpgradeContainerResponse], error) {
	var payload agentdto.ContainerUpgrade
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.ContainerUpgrade(payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpgradeContainerResponse{}), nil
}
