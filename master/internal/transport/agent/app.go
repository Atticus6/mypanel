package agent

import (
	"context"
	"encoding/json"
	"net/http"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	"mypanel/agent/app/dto/request"
	agentservice "mypanel/agent/app/service"
	"mypanel/agent/constant"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/bridge"
	"mypanel/master/internal/transport/errmap"
)

// AppServer 实现 panel.agent.v1.AppService。
type AppServer struct {
	app       agentservice.AppService
	installed agentservice.IAppInstallService
}

// NewAppServer 构造应用商店服务。
func NewAppServer() *AppServer {
	return &AppServer{
		app:       agentservice.AppService{},
		installed: agentservice.NewIAppInstalledService(),
	}
}

// Operate 执行已安装应用操作。
func (s *AppServer) Operate(
	_ context.Context,
	req *connect.Request[agentv1.OperateAppRequest],
) (*connect.Response[agentv1.OperateAppResponse], error) {
	if err := s.installed.Operate(request.AppInstalledOperate{
		InstallId:     uint(req.Msg.GetInstallId()),
		Operate:       constant.AppOperate(req.Msg.GetOperate()),
		DetailId:      uint(req.Msg.GetDetailId()),
		Backup:        req.Msg.GetBackup(),
		PullImage:     req.Msg.GetPullImage(),
		DeleteImage:   req.Msg.GetDeleteImage(),
		DockerCompose: req.Msg.GetDockerCompose(),
		TaskID:        req.Msg.GetTaskId(),
		ForceDelete:   req.Msg.GetForceDelete(),
		DeleteBackup:  req.Msg.GetDeleteBackup(),
		DeleteDB:      req.Msg.GetDeleteDb(),
		Favorite:      req.Msg.GetFavorite(),
		BackupId:      uint(req.Msg.GetBackupId()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateAppResponse{}), nil
}

// CheckInstalled 检查同名安装是否已存在。
func (s *AppServer) CheckInstalled(
	_ context.Context,
	req *connect.Request[agentv1.CheckInstalledAppRequest],
) (*connect.Response[agentv1.AppInstalledCheck], error) {
	check, err := s.installed.CheckExist(request.AppInstalledInfo{
		Key:  req.Msg.GetKey(),
		Name: req.Msg.GetName(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.AppInstalledCheck{
		TaskId:        check.TaskID,
		IsExist:       check.IsExist,
		Name:          check.Name,
		App:           check.App,
		Version:       check.Version,
		Status:        check.Status,
		CreatedAt:     formatTime(check.CreatedAt),
		LastBackupAt:  check.LastBackupAt,
		AppInstallId:  uint32(check.AppInstallID),
		ContainerName: check.ContainerName,
		InstallPath:   check.InstallPath,
		HttpPort:      int32(check.HttpPort),
		HttpsPort:     int32(check.HttpsPort),
		WebsiteDir:    check.WebsiteDir,
	}), nil
}

// Install 安装应用。
func (s *AppServer) Install(
	_ context.Context,
	req *connect.Request[agentv1.InstallAppRequest],
) (*connect.Response[agentv1.InstalledApp], error) {
	var params map[string]interface{}
	if raw := req.Msg.GetParamsJson(); raw != "" {
		if err := json.Unmarshal([]byte(raw), &params); err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
	}
	install, err := s.app.Install(request.AppInstallCreate{
		AppDetailId: uint(req.Msg.GetAppDetailId()),
		Name:        req.Msg.GetName(),
		Services:    req.Msg.GetServices(),
		TaskID:      req.Msg.GetTaskId(),
		Params:      params,
	}, true)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.InstalledApp{
		Id:          uint32(install.ID),
		Name:        install.Name,
		AppId:       uint32(install.AppId),
		AppDetailId: uint32(install.AppDetailId),
		Version:     install.Version,
		Status:      install.Status,
		Message:     install.Message,
		HttpPort:    int32(install.HttpPort),
		HttpsPort:   int32(install.HttpsPort),
		Path:        install.GetPath(),
		AppKey:      install.App.Key,
		AppType:     install.App.Type,
		WebUi:       install.WebUI,
		CreatedAt:   formatTime(install.CreatedAt),
		Favorite:    install.Favorite,
		Container:   install.ContainerName,
		SortOrder:   int32(install.SortOrder),
	}), nil
}

// GetApp 按 key 查询应用信息。
func (s *AppServer) GetApp(
	ctx context.Context,
	req *connect.Request[agentv1.GetAppRequest],
) (*connect.Response[agentv1.AppDetail], error) {
	c := bridge.GinContext(ctx)
	if c == nil {
		c, _ = bridge.New(ctx, http.Header{}, "", http.MethodPost, "/rpc")
	}
	app, err := s.app.GetApp(c, req.Msg.GetKey())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", err)
	}
	tags := make([]string, 0, len(app.Tags))
	for _, tag := range app.Tags {
		tags = append(tags, tag.Name)
	}
	return connect.NewResponse(&agentv1.AppDetail{
		Id:          uint32(app.ID),
		Name:        app.Name,
		Key:         app.Key,
		Icon:        app.Icon,
		Description: app.ShortDescEn,
		Readme:      app.ReadMe,
		Versions:    app.Versions,
		Tags:        tags,
		Installed:   app.Installed,
		Type:        app.Type,
		Status:      app.Status,
		Recommend:   int32(app.Recommend),
		Limit:       int32(app.Limit),
	}), nil
}

// SearchApps 分页查询应用商店。
func (s *AppServer) SearchApps(
	ctx context.Context,
	req *connect.Request[agentv1.SearchAppsRequest],
) (*connect.Response[agentv1.SearchAppsResponse], error) {
	// 应用简介按 Accept-Language 返回不同语言，需要复用 gin 上下文取语言。
	c := bridge.GinContext(ctx)
	if c == nil {
		c, _ = bridge.New(ctx, http.Header{}, "", http.MethodPost, "/rpc")
	}

	res, err := s.app.PageApp(c, request.AppSearch{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Name:            req.Msg.GetName(),
		Tags:            req.Msg.GetTags(),
		Type:            req.Msg.GetType(),
		Recommend:       req.Msg.GetRecommend(),
		Resource:        req.Msg.GetResource(),
		ShowCurrentArch: req.Msg.GetShowCurrentArch(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	items := make([]*agentv1.AppItem, 0, len(res.Items))
	for _, item := range res.Items {
		items = append(items, &agentv1.AppItem{
			Id:                  uint32(item.ID),
			Name:                item.Name,
			Key:                 item.Key,
			Icon:                item.Icon,
			Description:         item.Description,
			Status:              item.Status,
			Installed:           item.Installed,
			Limit:               int32(item.Limit),
			Tags:                item.Tags,
			GpuSupport:          item.GpuSupport,
			Recommend:           int32(item.Recommend),
			Type:                item.Type,
			BatchInstallSupport: item.BatchInstallSupport,
		})
	}
	return connect.NewResponse(&agentv1.SearchAppsResponse{
		Items: items,
		Total: res.Total,
	}), nil
}

// UpdateVersions 查询已安装应用可升级的版本。
func (s *AppServer) UpdateVersions(
	_ context.Context,
	req *connect.Request[agentv1.UpdateVersionsRequest],
) (*connect.Response[agentv1.UpdateVersionsResponse], error) {
	versions, err := s.installed.GetUpdateVersions(request.AppUpdateVersion{
		AppInstallID:  uint(req.Msg.GetAppInstallId()),
		UpdateVersion: req.Msg.GetUpdateVersion(),
		LoadCompose:   req.Msg.LoadCompose,
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.AppVersion, 0, len(versions))
	for _, item := range versions {
		items = append(items, &agentv1.AppVersion{
			Version:          item.Version,
			DetailId:         uint32(item.DetailId),
			DockerCompose:    item.DockerCompose,
			FeishuLegacy:     item.FeishuLegacy,
			FeishuConfigured: item.FeishuConfigured,
		})
	}
	return connect.NewResponse(&agentv1.UpdateVersionsResponse{Items: items}), nil
}

// SearchInstalled 分页查询已安装应用。
func (s *AppServer) SearchInstalled(
	ctx context.Context,
	req *connect.Request[agentv1.SearchInstalledAppsRequest],
) (*connect.Response[agentv1.SearchInstalledAppsResponse], error) {
	total, list, err := s.installed.PageWithContext(ctx, request.AppInstalledSearch{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Name:   req.Msg.GetName(),
		Type:   req.Msg.GetType(),
		Tags:   req.Msg.GetTags(),
		Update: req.Msg.GetUpdate(),
		Unused: req.Msg.GetUnused(),
		All:    req.Msg.GetAll(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	items := make([]*agentv1.InstalledApp, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.InstalledApp{
			Id:          uint32(item.ID),
			Name:        item.Name,
			AppId:       uint32(item.AppID),
			AppDetailId: uint32(item.AppDetailID),
			Version:     item.Version,
			Status:      item.Status,
			Message:     item.Message,
			HttpPort:    int32(item.HttpPort),
			HttpsPort:   int32(item.HttpsPort),
			Path:        item.Path,
			CanUpdate:   item.CanUpdate,
			Icon:        item.Icon,
			AppName:     item.AppName,
			AppKey:      item.AppKey,
			AppType:     item.AppType,
			AppStatus:   item.AppStatus,
			WebUi:       item.WebUI,
			CreatedAt:   formatTime(item.CreatedAt),
			Favorite:    item.Favorite,
			Container:   item.Container,
			SortOrder:   int32(item.SortOrder),
		})
	}
	return connect.NewResponse(&agentv1.SearchInstalledAppsResponse{
		Items: items,
		Total: total,
	}), nil
}
