package agent

import (
	"context"

	"connectrpc.com/connect"

	agentreq "mypanel/agent/app/dto/request"
	agentresp "mypanel/agent/app/dto/response"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// GetWebsite 读取单个网站详情。
func (s *WebsiteServer) GetWebsite(
	_ context.Context,
	req *connect.Request[agentv1.GetWebsiteRequest],
) (*connect.Response[agentv1.WebsiteDetail], error) {
	info, err := s.service.GetWebsite(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(websiteDetailFromDTO(info)), nil
}

// List 列出全部网站。
func (s *WebsiteServer) List(
	_ context.Context,
	_ *connect.Request[agentv1.ListWebsitesRequest],
) (*connect.Response[agentv1.ListWebsitesResponse], error) {
	list, err := s.service.GetWebsites()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.WebsiteDetail, 0, len(list))
	for _, item := range list {
		items = append(items, websiteDetailFromDTO(item))
	}
	return connect.NewResponse(&agentv1.ListWebsitesResponse{Items: items}), nil
}

// Options 列出网站名称选项。
func (s *WebsiteServer) Options(
	_ context.Context,
	req *connect.Request[agentv1.WebsiteOptionsRequest],
) (*connect.Response[agentv1.WebsiteOptionsResponse], error) {
	list, err := s.service.GetWebsiteOptions(agentreq.WebsiteOptionReq{Types: req.Msg.GetTypes()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.WebsiteOption, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.WebsiteOption{
			Id:            uint32(item.ID),
			PrimaryDomain: item.PrimaryDomain,
			Alias:         item.Alias,
		})
	}
	return connect.NewResponse(&agentv1.WebsiteOptionsResponse{Items: items}), nil
}

// OperateWebsite 启停或重载网站。
func (s *WebsiteServer) OperateWebsite(
	_ context.Context,
	req *connect.Request[agentv1.OperateWebsiteRequest],
) (*connect.Response[agentv1.OperateWebsiteResponse], error) {
	if err := s.service.OpWebsite(agentreq.WebsiteOp{
		ID:      uint(req.Msg.GetId()),
		Operate: req.Msg.GetOperate(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateWebsiteResponse{}), nil
}

// UpdateWebsite 修改网站基础信息。
func (s *WebsiteServer) UpdateWebsite(
	_ context.Context,
	req *connect.Request[agentv1.UpdateWebsiteRequest],
) (*connect.Response[agentv1.UpdateWebsiteResponse], error) {
	if err := s.service.UpdateWebsite(agentreq.WebsiteUpdate{
		ID:             uint(req.Msg.GetId()),
		PrimaryDomain:  req.Msg.GetPrimaryDomain(),
		Remark:         req.Msg.GetRemark(),
		WebsiteGroupID: uint(req.Msg.GetWebsiteGroupId()),
		ExpireDate:     req.Msg.GetExpireDate(),
		IPV6:           req.Msg.GetIpv6(),
		Favorite:       req.Msg.GetFavorite(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateWebsiteResponse{}), nil
}

// Check 创建前的依赖检查。
func (s *WebsiteServer) Check(
	_ context.Context,
	req *connect.Request[agentv1.CheckWebsiteRequest],
) (*connect.Response[agentv1.CheckWebsiteResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetInstallIds()))
	for _, id := range req.Msg.GetInstallIds() {
		ids = append(ids, uint(id))
	}
	list, err := s.service.PreInstallCheck(agentreq.WebsiteInstallCheckReq{InstallIds: ids})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.WebsiteCheckItem, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.WebsiteCheckItem{
			Name:    item.Name,
			Status:  item.Status,
			Version: item.Version,
			AppName: item.AppName,
		})
	}
	return connect.NewResponse(&agentv1.CheckWebsiteResponse{Items: items}), nil
}

// ChangeGroup 迁移分组内全部网站。
func (s *WebsiteServer) ChangeGroup(
	_ context.Context,
	req *connect.Request[agentv1.ChangeWebsiteGroupRequest],
) (*connect.Response[agentv1.ChangeWebsiteGroupResponse], error) {
	if err := s.service.ChangeGroup(uint(req.Msg.GetGroup()), uint(req.Msg.GetNewGroup())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ChangeWebsiteGroupResponse{}), nil
}

// BatchGroup 批量设置网站分组。
func (s *WebsiteServer) BatchGroup(
	_ context.Context,
	req *connect.Request[agentv1.BatchWebsiteGroupRequest],
) (*connect.Response[agentv1.BatchWebsiteGroupResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := s.service.BatchSetGroup(agentreq.BatchWebsiteGroup{
		IDs:     ids,
		GroupID: uint(req.Msg.GetGroupId()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BatchWebsiteGroupResponse{}), nil
}

// BatchOperate 批量启停网站。
func (s *WebsiteServer) BatchOperate(
	_ context.Context,
	req *connect.Request[agentv1.BatchWebsiteOperateRequest],
) (*connect.Response[agentv1.BatchWebsiteOperateResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	if err := s.service.BatchOpWebsite(agentreq.BatchWebsiteOp{
		IDs:     ids,
		Operate: req.Msg.GetOperate(),
		TaskID:  req.Msg.GetTaskId(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BatchWebsiteOperateResponse{}), nil
}

// ChangePHPVersion 切换网站 PHP 版本。
func (s *WebsiteServer) ChangePHPVersion(
	_ context.Context,
	req *connect.Request[agentv1.ChangeWebsitePHPVersionRequest],
) (*connect.Response[agentv1.ChangeWebsitePHPVersionResponse], error) {
	if err := s.service.ChangePHPVersion(agentreq.WebsitePHPVersionReq{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		RuntimeID: uint(req.Msg.GetRuntimeId()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ChangeWebsitePHPVersionResponse{}), nil
}

// OperateCrossSite 开关跨站访问。
func (s *WebsiteServer) OperateCrossSite(
	_ context.Context,
	req *connect.Request[agentv1.OperateCrossSiteRequest],
) (*connect.Response[agentv1.OperateCrossSiteResponse], error) {
	if err := s.service.OperateCrossSiteAccess(agentreq.CrossSiteAccessOp{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Operation: req.Msg.GetOperation(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateCrossSiteResponse{}), nil
}

// GetCors 读取 CORS 配置。
func (s *WebsiteServer) GetCors(
	_ context.Context,
	req *connect.Request[agentv1.GetCorsRequest],
) (*connect.Response[agentv1.CorsConfig], error) {
	info, err := s.service.GetCors(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	if info == nil {
		return connect.NewResponse(&agentv1.CorsConfig{}), nil
	}
	return connect.NewResponse(&agentv1.CorsConfig{
		Cors:             info.Cors,
		AllowOrigins:     info.AllowOrigins,
		AllowMethods:     info.AllowMethods,
		AllowHeaders:     info.AllowHeaders,
		AllowCredentials: info.AllowCredentials,
		Preflight:        info.Preflight,
	}), nil
}

// UpdateCors 更新 CORS 配置。
func (s *WebsiteServer) UpdateCors(
	_ context.Context,
	req *connect.Request[agentv1.UpdateCorsRequest],
) (*connect.Response[agentv1.UpdateCorsResponse], error) {
	if err := s.service.UpdateCors(agentreq.CorsConfigReq{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		CorsConfig: agentreq.CorsConfig{
			Cors:             req.Msg.GetCors(),
			AllowOrigins:     req.Msg.GetAllowOrigins(),
			AllowMethods:     req.Msg.GetAllowMethods(),
			AllowHeaders:     req.Msg.GetAllowHeaders(),
			AllowCredentials: req.Msg.GetAllowCredentials(),
			Preflight:        req.Msg.GetPreflight(),
		},
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateCorsResponse{}), nil
}

// GetSiteDir 读取网站目录配置。
func (s *WebsiteServer) GetSiteDir(
	_ context.Context,
	req *connect.Request[agentv1.GetSiteDirRequest],
) (*connect.Response[agentv1.WebsiteDirConfig], error) {
	info, err := s.service.LoadWebsiteDirConfig(agentreq.WebsiteCommonReq{ID: uint(req.Msg.GetId())})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.WebsiteDirConfig{
		SiteDir: info.Msg,
		User:    info.User,
		Dirs:    info.Dirs,
	}), nil
}

// UpdateSiteDir 修改网站根目录。
func (s *WebsiteServer) UpdateSiteDir(
	_ context.Context,
	req *connect.Request[agentv1.UpdateWebsiteDirRequest],
) (*connect.Response[agentv1.UpdateWebsiteDirResponse], error) {
	if err := s.service.UpdateSiteDir(agentreq.WebsiteUpdateDir{
		ID:      uint(req.Msg.GetId()),
		SiteDir: req.Msg.GetSiteDir(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateWebsiteDirResponse{}), nil
}

// UpdateSitePermission 修改网站目录权限。
func (s *WebsiteServer) UpdateSitePermission(
	_ context.Context,
	req *connect.Request[agentv1.UpdateWebsitePermissionRequest],
) (*connect.Response[agentv1.UpdateWebsitePermissionResponse], error) {
	if err := s.service.UpdateSitePermission(agentreq.WebsiteUpdateDirPermission{
		ID:    uint(req.Msg.GetId()),
		User:  req.Msg.GetUser(),
		Group: req.Msg.GetGroup(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateWebsitePermissionResponse{}), nil
}

// ListCustomRewrite 列出自定义伪静态规则。
func (s *WebsiteServer) ListCustomRewrite(
	_ context.Context,
	_ *connect.Request[agentv1.ListCustomRewriteRequest],
) (*connect.Response[agentv1.ListCustomRewriteResponse], error) {
	list, err := s.service.ListCustomRewrite()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	// 目录为空时 service 返回 nil，统一成空数组，避免前端拿到 undefined。
	items := make([]string, 0, len(list))
	items = append(items, list...)
	return connect.NewResponse(&agentv1.ListCustomRewriteResponse{Items: items}), nil
}

// OperateCustomRewrite 新增或删除自定义伪静态规则。
func (s *WebsiteServer) OperateCustomRewrite(
	_ context.Context,
	req *connect.Request[agentv1.OperateCustomRewriteRequest],
) (*connect.Response[agentv1.OperateCustomRewriteResponse], error) {
	if err := s.service.OperateCustomRewrite(agentreq.CustomRewriteOperate{
		Operate: req.Msg.GetOperate(),
		Content: req.Msg.GetContent(),
		Name:    req.Msg.GetName(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateCustomRewriteResponse{}), nil
}

// websiteDetailFromDTO 把网站 DTO 转成 proto 详情。
//
// DTO 里 model.Website 的 json tag 存在大小写混排（webSiteGroupId、webSiteSSLId 等），
// protojson 无法直接对齐，因此逐字段显式赋值。
func websiteDetailFromDTO(info agentresp.WebsiteDTO) *agentv1.WebsiteDetail {
	return &agentv1.WebsiteDetail{
		Id:              uint32(info.ID),
		CreatedAt:       formatTime(info.CreatedAt),
		Protocol:        info.Protocol,
		PrimaryDomain:   info.PrimaryDomain,
		Type:            info.Type,
		Alias:           info.Alias,
		Remark:          info.Remark,
		Status:          info.Status,
		ExpireDate:      formatTime(info.ExpireDate),
		Proxy:           info.Proxy,
		ProxyType:       info.ProxyType,
		SiteDir:         info.SiteDir,
		ErrorLog:        info.ErrorLog,
		AccessLog:       info.AccessLog,
		DefaultServer:   info.DefaultServer,
		Ipv6:            info.IPV6,
		Rewrite:         info.Rewrite,
		WebsiteGroupId:  uint32(info.WebsiteGroupID),
		WebsiteSslId:    uint32(info.WebsiteSSLID),
		RuntimeId:       uint32(info.RuntimeID),
		AppInstallId:    uint32(info.AppInstallID),
		ParentWebsiteId: uint32(info.ParentWebsiteID),
		User:            info.User,
		Group:           info.Group,
		DbType:          info.DbType,
		ErrorLogPath:    info.ErrorLogPath,
		AccessLogPath:   info.AccessLogPath,
		SitePath:        info.SitePath,
		AppName:         info.AppName,
		RuntimeName:     info.RuntimeName,
		RuntimeType:     info.RuntimeType,
		Algorithm:       info.Algorithm,
		Udp:             info.UDP,
		StreamPorts:     info.StreamPorts,
		OpenBaseDir:     info.OpenBaseDir,
		Favorite:        info.Favorite,
	}
}
