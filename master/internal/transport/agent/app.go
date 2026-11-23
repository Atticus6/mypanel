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
	agenti18n "mypanel/agent/i18n"
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

// GetAppDetail 按应用 ID、版本与类型查询详情。
func (s *AppServer) GetAppDetail(
	_ context.Context,
	req *connect.Request[agentv1.GetAppDetailRequest],
) (*connect.Response[agentv1.AppDetailDocument], error) {
	detail, err := s.app.GetAppDetail(uint(req.Msg.GetAppId()), req.Msg.GetVersion(), req.Msg.GetType())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.AppDetailDocument{DetailJson: marshalJSON(detail)}), nil
}

// GetAppDetailByID 按详情 ID 查询应用详情。
func (s *AppServer) GetAppDetailByID(
	_ context.Context,
	req *connect.Request[agentv1.GetAppDetailByIDRequest],
) (*connect.Response[agentv1.AppDetailDocument], error) {
	detail, err := s.app.GetAppDetailByID(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.AppDetailDocument{DetailJson: marshalJSON(detail)}), nil
}

// GetAppDetailByKey 按 key 与版本查询详情 ID。
func (s *AppServer) GetAppDetailByKey(
	_ context.Context,
	req *connect.Request[agentv1.GetAppDetailByKeyRequest],
) (*connect.Response[agentv1.IdResponse], error) {
	detail, err := s.app.GetAppDetailByKey(req.Msg.GetAppKey(), req.Msg.GetVersion())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.IdResponse{Id: uint32(detail.ID)}), nil
}

// GetAppTags 查询应用商店标签。
func (s *AppServer) GetAppTags(
	ctx context.Context,
	_ *connect.Request[agentv1.GetAppTagsRequest],
) (*connect.Response[agentv1.AppTagsResponse], error) {
	c := bridge.GinContext(ctx)
	if c == nil {
		c, _ = bridge.New(ctx, http.Header{}, "", http.MethodPost, "/rpc")
	}
	tags, err := s.app.GetAppTags(c)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.AppTag, 0, len(tags))
	for _, tag := range tags {
		items = append(items, &agentv1.AppTag{Id: uint32(tag.ID), Key: tag.Key, Name: tag.Name})
	}
	return connect.NewResponse(&agentv1.AppTagsResponse{Items: items}), nil
}

// GetAppUpdate 检查应用商店是否有更新。
func (s *AppServer) GetAppUpdate(
	_ context.Context,
	_ *connect.Request[agentv1.GetAppUpdateRequest],
) (*connect.Response[agentv1.AppUpdateInfo], error) {
	res, err := s.app.GetAppUpdate()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.AppUpdateInfo{
		CanUpdate:            res.CanUpdate,
		IsSyncing:            res.IsSyncing,
		AppStoreLastModified: int32(res.AppStoreLastModified),
		AppListJson:          marshalJSON(res.AppList),
	}), nil
}

// ListIgnoredApps 查询已忽略升级的应用。
func (s *AppServer) ListIgnoredApps(
	_ context.Context,
	_ *connect.Request[agentv1.ListIgnoredAppsRequest],
) (*connect.Response[agentv1.IgnoredAppsResponse], error) {
	list, err := agentservice.NewIAppIgnoreUpgradeService().List()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.IgnoredApp, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.IgnoredApp{
			Id:          uint32(item.ID),
			AppId:       uint32(item.AppID),
			AppDetailId: uint32(item.AppDetailID),
			Scope:       item.Scope,
			Version:     item.Version,
			Name:        item.Name,
		})
	}
	return connect.NewResponse(&agentv1.IgnoredAppsResponse{Items: items}), nil
}

// IgnoreAppUpgrade 忽略指定应用的升级。
func (s *AppServer) IgnoreAppUpgrade(
	_ context.Context,
	req *connect.Request[agentv1.IgnoreAppUpgradeRequest],
) (*connect.Response[agentv1.IgnoreAppUpgradeResponse], error) {
	if err := agentservice.NewIAppIgnoreUpgradeService().CreateAppIgnore(request.AppIgnoreUpgradeReq{
		AppID:       uint(req.Msg.GetAppId()),
		AppDetailID: uint(req.Msg.GetAppDetailId()),
		Scope:       req.Msg.GetScope(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.IgnoreAppUpgradeResponse{}), nil
}

// CancelIgnoreAppUpgrade 取消忽略应用升级。
func (s *AppServer) CancelIgnoreAppUpgrade(
	_ context.Context,
	req *connect.Request[agentv1.CancelIgnoreAppUpgradeRequest],
) (*connect.Response[agentv1.CancelIgnoreAppUpgradeResponse], error) {
	if err := agentservice.NewIAppIgnoreUpgradeService().Delete(request.ReqWithID{ID: uint(req.Msg.GetId())}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CancelIgnoreAppUpgradeResponse{}), nil
}

// ListInstalled 列出全部已安装应用的摘要。
func (s *AppServer) ListInstalled(
	_ context.Context,
	_ *connect.Request[agentv1.ListInstalledRequest],
) (*connect.Response[agentv1.ListInstalledResponse], error) {
	list, err := s.installed.GetInstallList()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.InstalledAppBrief, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.InstalledAppBrief{
			Id:   uint32(item.ID),
			Key:  item.Key,
			Name: item.Name,
		})
	}
	return connect.NewResponse(&agentv1.ListInstalledResponse{Items: items}), nil
}

// CheckDeleteInstalled 删除安装前检查关联资源。
func (s *AppServer) CheckDeleteInstalled(
	_ context.Context,
	req *connect.Request[agentv1.CheckDeleteInstalledRequest],
) (*connect.Response[agentv1.CheckDeleteInstalledResponse], error) {
	list, err := s.installed.DeleteCheck(uint(req.Msg.GetAppInstallId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.AppResource, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.AppResource{Type: item.Type, Name: item.Name})
	}
	return connect.NewResponse(&agentv1.CheckDeleteInstalledResponse{Items: items}), nil
}

// SyncInstalled 同步已安装应用列表。
func (s *AppServer) SyncInstalled(
	_ context.Context,
	_ *connect.Request[agentv1.SyncInstalledRequest],
) (*connect.Response[agentv1.SyncInstalledResponse], error) {
	if err := s.installed.SyncAll(false); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SyncInstalledResponse{}), nil
}

// GetAppServices 查询应用定义里的服务列表。
func (s *AppServer) GetAppServices(
	_ context.Context,
	req *connect.Request[agentv1.GetAppServicesRequest],
) (*connect.Response[agentv1.GetAppServicesResponse], error) {
	list, err := s.installed.GetServices(req.Msg.GetKey())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.AppServiceItem, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.AppServiceItem{
			Label:      item.Label,
			Value:      item.Value,
			From:       item.From,
			Status:     item.Status,
			ConfigJson: marshalJSON(item.Config),
		})
	}
	return connect.NewResponse(&agentv1.GetAppServicesResponse{Items: items}), nil
}

// ChangeAppPort 修改已安装应用的端口。
func (s *AppServer) ChangeAppPort(
	_ context.Context,
	req *connect.Request[agentv1.ChangeAppPortRequest],
) (*connect.Response[agentv1.ChangeAppPortResponse], error) {
	if err := s.installed.ChangeAppPort(request.PortUpdate{
		Key:  req.Msg.GetKey(),
		Name: req.Msg.GetName(),
		Port: req.Msg.GetPort(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ChangeAppPortResponse{}), nil
}

// GetDefaultConfig 查询应用默认配置文件内容。
func (s *AppServer) GetDefaultConfig(
	_ context.Context,
	req *connect.Request[agentv1.GetDefaultConfigRequest],
) (*connect.Response[agentv1.GetDefaultConfigResponse], error) {
	content, err := s.installed.GetDefaultConfigByKey(req.Msg.GetType(), req.Msg.GetName())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.GetDefaultConfigResponse{Content: content}), nil
}

// GetInstalledParams 查询已安装应用的参数。
func (s *AppServer) GetInstalledParams(
	_ context.Context,
	req *connect.Request[agentv1.GetInstalledParamsRequest],
) (*connect.Response[agentv1.InstalledParamsResponse], error) {
	params, err := s.installed.GetParams(uint(req.Msg.GetAppInstallId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.InstalledParamsResponse{
		AppKey:                  params.AppKey,
		Name:                    params.Name,
		HttpPort:                int32(params.HttpPort),
		SyncModelAccount:        params.SyncModelAccount,
		ModelAccountBaseUrlType: params.ModelAccountBaseURLType,
		ModelAccountBaseUrl:     params.ModelAccountBaseURL,
		RawCompose:              params.RawCompose,
		IsEdit:                  params.IsEdit,
		ParamsJson:              marshalJSON(params.Params),
		ContainerJson:           marshalJSON(params.AppContainerConfig),
	}), nil
}

// UpdateInstalled 更新已安装应用的参数与容器配置。
func (s *AppServer) UpdateInstalled(
	_ context.Context,
	req *connect.Request[agentv1.UpdateInstalledRequest],
) (*connect.Response[agentv1.UpdateInstalledResponse], error) {
	var payload request.AppInstalledUpdate
	if err := json.Unmarshal([]byte(req.Msg.GetPayloadJson()), &payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	// 路径参数优先，避免前端请求体里漏传或传错安装 ID。
	payload.InstallId = uint(req.Msg.GetInstallId())
	if err := s.installed.Update(payload); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateInstalledResponse{}), nil
}

// UpdateInstalledConfig 更新已安装应用的 WebUI 配置。
func (s *AppServer) UpdateInstalledConfig(
	_ context.Context,
	req *connect.Request[agentv1.UpdateInstalledConfigRequest],
) (*connect.Response[agentv1.UpdateInstalledConfigResponse], error) {
	if err := s.installed.UpdateAppConfig(request.AppConfigUpdate{
		InstallID: uint(req.Msg.GetInstallId()),
		WebUI:     req.Msg.GetWebUi(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateInstalledConfigResponse{}), nil
}

// GetInstalledInfo 查询已安装应用的运行信息。
func (s *AppServer) GetInstalledInfo(
	_ context.Context,
	req *connect.Request[agentv1.GetInstalledInfoRequest],
) (*connect.Response[agentv1.InstalledInfo], error) {
	info, err := s.installed.GetAppInstallInfo(uint(req.Msg.GetAppInstallId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	ports := make([]int32, 0, len(info.AppPorts))
	for _, port := range info.AppPorts {
		ports = append(ports, int32(port))
	}
	return connect.NewResponse(&agentv1.InstalledInfo{
		Id:          uint32(info.ID),
		Name:        info.Name,
		Version:     info.Version,
		Status:      info.Status,
		Message:     info.Message,
		HttpPort:    int32(info.HttpPort),
		Container:   info.Container,
		ComposePath: info.ComposePath,
		AppKey:      info.AppKey,
		AppPorts:    ports,
		EnvJson:     marshalJSON(info.Env),
	}), nil
}

// UpdateInstalledSort 更新已安装应用的排序。
func (s *AppServer) UpdateInstalledSort(
	_ context.Context,
	req *connect.Request[agentv1.UpdateInstalledSortRequest],
) (*connect.Response[agentv1.UpdateInstalledSortResponse], error) {
	items := make([]request.AppInstallSortItem, 0, len(req.Msg.GetItems()))
	for _, item := range req.Msg.GetItems() {
		items = append(items, request.AppInstallSortItem{
			InstallID: uint(item.GetInstallId()),
			SortOrder: int(item.GetSortOrder()),
		})
	}
	if err := s.installed.UpdateSort(request.AppInstallSort{Items: items}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateInstalledSortResponse{}), nil
}

// SyncAppsFromRemote 从远端同步应用商店列表。
func (s *AppServer) SyncAppsFromRemote(
	_ context.Context,
	req *connect.Request[agentv1.SyncAppsRequest],
) (*connect.Response[agentv1.SyncAppsResponse], error) {
	// 与 REST 行为一致：没有可更新内容时只返回提示，不重复启动同步任务。
	res, err := s.app.GetAppUpdate()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	if !res.CanUpdate {
		message := agenti18n.GetMsgByKey("AppStoreIsUpToDate")
		if res.IsSyncing {
			message = agenti18n.GetMsgByKey("AppStoreIsSyncing")
		}
		return connect.NewResponse(&agentv1.SyncAppsResponse{Message: message}), nil
	}
	if err := s.app.SyncAppListFromRemote(req.Msg.GetTaskId()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SyncAppsResponse{}), nil
}

// SyncAppsFromLocal 从本地同步应用商店列表。
func (s *AppServer) SyncAppsFromLocal(
	_ context.Context,
	req *connect.Request[agentv1.SyncAppsRequest],
) (*connect.Response[agentv1.SyncAppsResponse], error) {
	// 与 REST 行为一致：本地同步是后台任务，立即返回。
	go s.app.SyncAppListFromLocal(req.Msg.GetTaskId())
	return connect.NewResponse(&agentv1.SyncAppsResponse{}), nil
}

// LoadAppPort 查询应用可用的端口。
func (s *AppServer) LoadAppPort(
	_ context.Context,
	req *connect.Request[agentv1.LoadAppPortRequest],
) (*connect.Response[agentv1.LoadAppPortResponse], error) {
	port, err := s.installed.LoadPort(agentdto.OperationWithNameAndType{
		Name: req.Msg.GetName(),
		Type: req.Msg.GetType(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.LoadAppPortResponse{Port: port}), nil
}

// LoadAppConnInfo 查询应用数据库连接信息。
func (s *AppServer) LoadAppConnInfo(
	_ context.Context,
	req *connect.Request[agentv1.LoadAppConnInfoRequest],
) (*connect.Response[agentv1.LoadAppConnInfoResponse], error) {
	conn, err := s.installed.LoadConnInfo(agentdto.OperationWithNameAndType{
		Name: req.Msg.GetName(),
		Type: req.Msg.GetType(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.LoadAppConnInfoResponse{
		Status:        conn.Status,
		Username:      conn.Username,
		Password:      conn.Password,
		ContainerName: conn.ContainerName,
		ServiceName:   conn.ServiceName,
		Port:          conn.Port,
	}), nil
}

// marshalJSON 把结构体序列化成 JSON 字符串；失败时返回空串而不是报错。
//
// 仅用于 proto 无法稳定表达的动态字段（应用参数、Compose 片段等）。
func marshalJSON(value any) string {
	if value == nil {
		return ""
	}
	data, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	return string(data)
}
