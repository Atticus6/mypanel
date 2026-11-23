package agent

import (
	"context"
	"encoding/json"

	"connectrpc.com/connect"

	agentreq "mypanel/agent/app/dto/request"
	agentresp "mypanel/agent/app/dto/response"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// UpdateProxyFile 更新反向代理配置文件。
func (s *WebsiteServer) UpdateProxyFile(
	_ context.Context,
	req *connect.Request[agentv1.UpdateProxyFileRequest],
) (*connect.Response[agentv1.UpdateProxyFileResponse], error) {
	if err := s.service.UpdateProxyFile(agentreq.NginxProxyUpdate{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Content:   req.Msg.GetContent(),
		Name:      req.Msg.GetName(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateProxyFileResponse{}), nil
}

// DeleteProxy 删除一条反向代理。
func (s *WebsiteServer) DeleteProxy(
	_ context.Context,
	req *connect.Request[agentv1.DeleteProxyRequest],
) (*connect.Response[agentv1.DeleteProxyResponse], error) {
	if err := s.service.DeleteProxy(agentreq.WebsiteProxyDel{
		ID:   uint(req.Msg.GetId()),
		Name: req.Msg.GetName(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteProxyResponse{}), nil
}

// UpdateProxyStatus 切换反向代理状态。
func (s *WebsiteServer) UpdateProxyStatus(
	_ context.Context,
	req *connect.Request[agentv1.UpdateProxyStatusRequest],
) (*connect.Response[agentv1.UpdateProxyStatusResponse], error) {
	if err := s.service.UpdateProxyStatus(agentreq.WebsiteProxyStatusUpdate{
		ID:     uint(req.Msg.GetId()),
		Name:   req.Msg.GetName(),
		Status: req.Msg.GetStatus(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateProxyStatusResponse{}), nil
}

// ClearProxyCache 清理代理缓存。
func (s *WebsiteServer) ClearProxyCache(
	_ context.Context,
	req *connect.Request[agentv1.ClearProxyCacheRequest],
) (*connect.Response[agentv1.ClearProxyCacheResponse], error) {
	if err := s.service.ClearProxyCache(agentreq.NginxCommonReq{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ClearProxyCacheResponse{}), nil
}

// GetAuth 读取访问认证配置。
func (s *WebsiteServer) GetAuth(
	_ context.Context,
	req *connect.Request[agentv1.GetAuthRequest],
) (*connect.Response[agentv1.AuthConfig], error) {
	res, err := s.service.GetAuthBasics(agentreq.NginxAuthReq{WebsiteID: uint(req.Msg.GetWebsiteId())})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.AuthItem, 0, len(res.Items))
	for _, item := range res.Items {
		items = append(items, &agentv1.AuthItem{Username: item.Username, Remark: item.Remark})
	}
	return connect.NewResponse(&agentv1.AuthConfig{Enable: res.Enable, Items: items}), nil
}

// UpdateAuth 修改访问认证配置。
func (s *WebsiteServer) UpdateAuth(
	_ context.Context,
	req *connect.Request[agentv1.UpdateAuthRequest],
) (*connect.Response[agentv1.UpdateAuthResponse], error) {
	if err := s.service.UpdateAuthBasic(agentreq.NginxAuthUpdate{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Operate:   req.Msg.GetOperate(),
		Username:  req.Msg.GetUsername(),
		Password:  req.Msg.GetPassword(),
		Remark:    req.Msg.GetRemark(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateAuthResponse{}), nil
}

// GetPathAuth 读取路径认证配置。
func (s *WebsiteServer) GetPathAuth(
	_ context.Context,
	req *connect.Request[agentv1.GetPathAuthRequest],
) (*connect.Response[agentv1.GetPathAuthResponse], error) {
	list, err := s.service.GetPathAuthBasics(agentreq.NginxAuthReq{WebsiteID: uint(req.Msg.GetWebsiteId())})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.PathAuthItem, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.PathAuthItem{
			Username: item.Username,
			Remark:   item.Remark,
			Path:     item.Path,
			Name:     item.Name,
		})
	}
	return connect.NewResponse(&agentv1.GetPathAuthResponse{Items: items}), nil
}

// UpdatePathAuth 修改路径认证配置。
func (s *WebsiteServer) UpdatePathAuth(
	_ context.Context,
	req *connect.Request[agentv1.UpdatePathAuthRequest],
) (*connect.Response[agentv1.UpdatePathAuthResponse], error) {
	if err := s.service.UpdatePathAuthBasic(agentreq.NginxPathAuthUpdate{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Operate:   req.Msg.GetOperate(),
		Name:      req.Msg.GetName(),
		Username:  req.Msg.GetUsername(),
		Password:  req.Msg.GetPassword(),
		Path:      req.Msg.GetPath(),
		Remark:    req.Msg.GetRemark(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdatePathAuthResponse{}), nil
}

// UpdateRedirectFile 更新重定向配置文件。
func (s *WebsiteServer) UpdateRedirectFile(
	_ context.Context,
	req *connect.Request[agentv1.UpdateRedirectFileRequest],
) (*connect.Response[agentv1.UpdateRedirectFileResponse], error) {
	if err := s.service.UpdateRedirectFile(agentreq.NginxRedirectUpdate{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Content:   req.Msg.GetContent(),
		Name:      req.Msg.GetName(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateRedirectFileResponse{}), nil
}

// UpdateStream 更新四层代理配置。
func (s *WebsiteServer) UpdateStream(
	_ context.Context,
	req *connect.Request[agentv1.UpdateStreamRequest],
) (*connect.Response[agentv1.UpdateStreamResponse], error) {
	if err := s.service.UpdateStream(agentreq.StreamUpdate{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		StreamConfig: agentreq.StreamConfig{
			StreamPorts: req.Msg.GetStreamPorts(),
			Name:        req.Msg.GetName(),
			Algorithm:   req.Msg.GetAlgorithm(),
			UDP:         req.Msg.GetUdp(),
			Servers:     lbServersFromProto(req.Msg.GetServers()),
		},
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateStreamResponse{}), nil
}

// GetResource 读取网站关联资源。
func (s *WebsiteServer) GetResource(
	_ context.Context,
	req *connect.Request[agentv1.GetWebsiteResourceRequest],
) (*connect.Response[agentv1.GetWebsiteResourceResponse], error) {
	list, err := s.service.GetWebsiteResource(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.WebsiteResource, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.WebsiteResource{
			Name:       item.Name,
			Type:       item.Type,
			ResourceId: uint32(item.ResourceID),
			DetailJson: resourceDetailJSON(item),
		})
	}
	return connect.NewResponse(&agentv1.GetWebsiteResourceResponse{Items: items}), nil
}

// CreateDomains 为网站新增域名。
func (s *WebsiteServer) CreateDomains(
	_ context.Context,
	req *connect.Request[agentv1.CreateDomainsRequest],
) (*connect.Response[agentv1.CreateDomainsResponse], error) {
	domains := make([]agentreq.WebsiteDomain, 0, len(req.Msg.GetDomains()))
	for _, item := range req.Msg.GetDomains() {
		domains = append(domains, agentreq.WebsiteDomain{
			Domain: item.GetDomain(),
			Port:   int(item.GetPort()),
			SSL:    item.GetSsl(),
		})
	}
	if _, err := s.service.CreateWebsiteDomain(agentreq.WebsiteDomainCreate{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Domains:   domains,
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateDomainsResponse{}), nil
}

// DeleteDomain 删除网站域名。
func (s *WebsiteServer) DeleteDomain(
	_ context.Context,
	req *connect.Request[agentv1.DeleteDomainRequest],
) (*connect.Response[agentv1.DeleteDomainResponse], error) {
	if err := s.service.DeleteWebsiteDomain(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteDomainResponse{}), nil
}

// UpdateDomain 修改域名的 SSL 开关。
func (s *WebsiteServer) UpdateDomain(
	_ context.Context,
	req *connect.Request[agentv1.UpdateDomainRequest],
) (*connect.Response[agentv1.UpdateDomainResponse], error) {
	if err := s.service.UpdateWebsiteDomain(agentreq.WebsiteDomainUpdate{
		ID:  uint(req.Msg.GetId()),
		SSL: req.Msg.GetSsl(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateDomainResponse{}), nil
}

// resourceDetailJSON 把资源详情序列化成 JSON 字符串。
//
// Detail 是 interface{}，不同资源类型结构不同；proto 里用字符串承载，
// 前端按 type 再解析，避免为每种资源单独建消息。
func resourceDetailJSON(item agentresp.Resource) string {
	if item.Detail == nil {
		return ""
	}
	raw, err := json.Marshal(item.Detail)
	if err != nil {
		return ""
	}
	return string(raw)
}

// CreateDNSAccount 新增 DNS 账号。
func (s *WebsiteServer) CreateDNSAccount(
	_ context.Context,
	req *connect.Request[agentv1.CreateDNSAccountRequest],
) (*connect.Response[agentv1.CreateDNSAccountResponse], error) {
	if _, err := s.dns.Create(agentreq.WebsiteDnsAccountCreate{
		Name:          req.Msg.GetName(),
		Type:          req.Msg.GetType(),
		Authorization: req.Msg.GetAuthorization(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateDNSAccountResponse{}), nil
}

// UpdateDNSAccount 修改 DNS 账号。
func (s *WebsiteServer) UpdateDNSAccount(
	_ context.Context,
	req *connect.Request[agentv1.UpdateDNSAccountRequest],
) (*connect.Response[agentv1.UpdateDNSAccountResponse], error) {
	if _, err := s.dns.Update(agentreq.WebsiteDnsAccountUpdate{
		ID:            uint(req.Msg.GetId()),
		Name:          req.Msg.GetName(),
		Type:          req.Msg.GetType(),
		Authorization: req.Msg.GetAuthorization(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateDNSAccountResponse{}), nil
}

// DeleteDNSAccount 删除 DNS 账号。
func (s *WebsiteServer) DeleteDNSAccount(
	_ context.Context,
	req *connect.Request[agentv1.DeleteDNSAccountRequest],
) (*connect.Response[agentv1.DeleteDNSAccountResponse], error) {
	if err := s.dns.Delete(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteDNSAccountResponse{}), nil
}

// ListDatabases 列出可绑定数据库。
func (s *WebsiteServer) ListDatabases(
	_ context.Context,
	_ *connect.Request[agentv1.ListWebsiteDatabasesRequest],
) (*connect.Response[agentv1.ListWebsiteDatabasesResponse], error) {
	list, err := s.service.ListDatabases()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.WebsiteDatabase, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.WebsiteDatabase{
			Name:         item.Name,
			DatabaseName: item.DatabaseName,
			Type:         item.Type,
			From:         item.From,
			Id:           uint32(item.ID),
		})
	}
	return connect.NewResponse(&agentv1.ListWebsiteDatabasesResponse{Items: items}), nil
}

// ChangeDatabase 修改网站绑定数据库。
func (s *WebsiteServer) ChangeDatabase(
	_ context.Context,
	req *connect.Request[agentv1.ChangeWebsiteDatabaseRequest],
) (*connect.Response[agentv1.ChangeWebsiteDatabaseResponse], error) {
	if err := s.service.ChangeDatabase(agentreq.ChangeDatabase{
		WebsiteID:    uint(req.Msg.GetWebsiteId()),
		DatabaseID:   uint(req.Msg.GetDatabaseId()),
		DatabaseType: req.Msg.GetDatabaseType(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ChangeWebsiteDatabaseResponse{}), nil
}

// UpdateLoadBalanceFile 更新负载均衡配置文件。
func (s *WebsiteServer) UpdateLoadBalanceFile(
	_ context.Context,
	req *connect.Request[agentv1.UpdateLoadBalanceFileRequest],
) (*connect.Response[agentv1.UpdateLoadBalanceFileResponse], error) {
	if err := s.service.UpdateLoadBalanceFile(agentreq.WebsiteLBUpdateFile{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Name:      req.Msg.GetName(),
		Content:   req.Msg.GetContent(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateLoadBalanceFileResponse{}), nil
}

// OperateLog 开启、关闭或清理网站日志。
func (s *WebsiteServer) OperateLog(
	_ context.Context,
	req *connect.Request[agentv1.OperateWebsiteLogRequest],
) (*connect.Response[agentv1.OperateWebsiteLogResponse], error) {
	if err := s.service.OpWebsiteLog(agentreq.WebsiteLogReq{
		ID:      uint(req.Msg.GetId()),
		Operate: req.Msg.GetOperate(),
		LogType: req.Msg.GetLogType(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateWebsiteLogResponse{}), nil
}

// UpdateProxy 新增或修改反向代理。
func (s *WebsiteServer) UpdateProxy(
	_ context.Context,
	req *connect.Request[agentv1.UpdateProxyRequest],
) (*connect.Response[agentv1.UpdateProxyResponse], error) {
	if err := s.service.OperateProxy(agentreq.WebsiteProxyConfig{
		ID:              uint(req.Msg.GetId()),
		Operate:         req.Msg.GetOperate(),
		Enable:          req.Msg.GetEnable(),
		Cache:           req.Msg.GetCache(),
		CacheTime:       int(req.Msg.GetCacheTime()),
		CacheUnit:       req.Msg.GetCacheUnit(),
		ServerCacheTime: int(req.Msg.GetServerCacheTime()),
		ServerCacheUnit: req.Msg.GetServerCacheUnit(),
		Name:            req.Msg.GetName(),
		Modifier:        req.Msg.GetModifier(),
		Match:           req.Msg.GetMatch(),
		ProxyPass:       req.Msg.GetProxyPass(),
		ProxyHost:       req.Msg.GetProxyHost(),
		Content:         req.Msg.GetContent(),
		FilePath:        req.Msg.GetFilePath(),
		Replaces:        req.Msg.GetReplaces(),
		SNI:             req.Msg.GetSni(),
		ProxySSLName:    req.Msg.GetProxySslName(),
		SSLVerify:       req.Msg.GetSslVerify(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateProxyResponse{}), nil
}
