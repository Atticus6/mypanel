// Package agent 实现 panel.agent.v1 的 Connect 服务。
//
// 与 core 的 adapter 一致：只做 proto ↔ 1Panel DTO 的转换与错误映射，
// 业务逻辑全部复用 agent 的 service 层，不重新实现查询与校验。
package agent

import (
	"context"
	"encoding/json"
	"time"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	"mypanel/agent/app/dto/request"
	"mypanel/agent/app/dto/response"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// WebsiteServer 实现 panel.agent.v1.WebsiteService。
type WebsiteServer struct {
	service agentservice.WebsiteService
	dns     agentservice.WebsiteDnsAccountService
}

// NewWebsiteServer 构造网站管理服务。
func NewWebsiteServer() *WebsiteServer {
	return &WebsiteServer{
		service: agentservice.WebsiteService{},
		dns:     agentservice.WebsiteDnsAccountService{},
	}
}

// Search 分页查询网站。
func (s *WebsiteServer) Search(
	_ context.Context,
	req *connect.Request[agentv1.SearchWebsitesRequest],
) (*connect.Response[agentv1.SearchWebsitesResponse], error) {
	dtoReq := request.WebsiteSearch{
		PageInfo: agentdto.PageInfo{
			Page:     int(req.Msg.GetPage()),
			PageSize: int(req.Msg.GetPageSize()),
		},
		Name:           req.Msg.GetName(),
		OrderBy:        defaultString(req.Msg.GetOrderBy(), "created_at"),
		Order:          defaultString(req.Msg.GetOrder(), "descending"),
		WebsiteGroupID: uint(req.Msg.GetWebsiteGroupId()),
		Type:           req.Msg.GetType(),
	}

	total, websites, err := s.service.PageWebsite(dtoReq)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}

	items := make([]*agentv1.Website, 0, len(websites))
	for _, item := range websites {
		items = append(items, fromWebsiteRes(item))
	}
	return connect.NewResponse(&agentv1.SearchWebsitesResponse{
		Items: items,
		Total: total,
	}), nil
}

// Create 创建网站。
func (s *WebsiteServer) Create(
	_ context.Context,
	req *connect.Request[agentv1.CreateWebsiteRequest],
) (*connect.Response[agentv1.CreateWebsiteResponse], error) {
	payload := map[string]interface{}{
		"type":            req.Msg.GetType(),
		"alias":           req.Msg.GetAlias(),
		"remark":          req.Msg.GetRemark(),
		"proxy":           req.Msg.GetProxy(),
		"webSiteGroupID":  req.Msg.GetWebsiteGroupId(),
		"IPV6":            req.Msg.GetIpv6(),
		"siteDir":         req.Msg.GetSiteDir(),
		"taskID":          req.Msg.GetTaskId(),
		"appType":         req.Msg.GetAppType(),
		"appID":           req.Msg.GetAppId(),
		"appInstallID":    req.Msg.GetAppInstallId(),
		"parentWebsiteID": req.Msg.GetParentWebsiteId(),
		"streamPorts":     req.Msg.GetStreamPorts(),
		"name":            req.Msg.GetName(),
		"algorithm":       req.Msg.GetAlgorithm(),
		"udp":             req.Msg.GetUdp(),
	}
	if raw := req.Msg.GetOptionsJson(); raw != "" {
		extra := map[string]interface{}{}
		if err := json.Unmarshal([]byte(raw), &extra); err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		for key, value := range extra {
			payload[key] = value
		}
	}
	domains := make([]map[string]interface{}, 0, len(req.Msg.GetDomains()))
	for _, item := range req.Msg.GetDomains() {
		domains = append(domains, map[string]interface{}{
			"domain": item.GetDomain(),
			"port":   item.GetPort(),
			"ssl":    item.GetSsl(),
		})
	}
	payload["domains"] = domains

	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	var create request.WebsiteCreate
	if err := json.Unmarshal(encoded, &create); err != nil {
		return nil, errmap.FromMsgKey("ErrInvalidParams", err)
	}
	if err := s.service.CreateWebsite(create); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateWebsiteResponse{}), nil
}

// GetRealIP 读取真实 IP 配置。
func (s *WebsiteServer) GetRealIP(
	_ context.Context,
	req *connect.Request[agentv1.GetRealIPRequest],
) (*connect.Response[agentv1.RealIPConfig], error) {
	res, err := s.service.GetRealIPConfig(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RealIPConfig{
		WebsiteId: uint32(res.WebsiteID),
		Open:      res.Open,
		IpFrom:    res.IPFrom,
		IpHeader:  res.IPHeader,
		IpOther:   res.IPOther,
	}), nil
}

// UpdateRealIP 更新真实 IP 配置。
func (s *WebsiteServer) UpdateRealIP(
	_ context.Context,
	req *connect.Request[agentv1.UpdateRealIPRequest],
) (*connect.Response[agentv1.UpdateRealIPResponse], error) {
	if err := s.service.SetRealIPConfig(request.WebsiteRealIP{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Open:      req.Msg.GetOpen(),
		IPFrom:    req.Msg.GetIpFrom(),
		IPHeader:  req.Msg.GetIpHeader(),
		IPOther:   req.Msg.GetIpOther(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateRealIPResponse{}), nil
}

// GetDefaultHtml 读取默认站点 HTML。
func (s *WebsiteServer) GetDefaultHtml(
	_ context.Context,
	req *connect.Request[agentv1.GetDefaultHtmlRequest],
) (*connect.Response[agentv1.DefaultHtml], error) {
	res, err := s.service.GetDefaultHtml(req.Msg.GetType())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DefaultHtml{Content: res.Content}), nil
}

// UpdateDefaultHtml 更新默认站点 HTML。
func (s *WebsiteServer) UpdateDefaultHtml(
	_ context.Context,
	req *connect.Request[agentv1.UpdateDefaultHtmlRequest],
) (*connect.Response[agentv1.UpdateDefaultHtmlResponse], error) {
	if err := s.service.UpdateDefaultHtml(request.WebsiteHtmlUpdate{
		Type:    req.Msg.GetType(),
		Content: req.Msg.GetContent(),
		Sync:    req.Msg.GetSync(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateDefaultHtmlResponse{}), nil
}

// CreateLoadBalance 创建负载均衡配置。
func (s *WebsiteServer) CreateLoadBalance(
	_ context.Context,
	req *connect.Request[agentv1.CreateLoadBalanceRequest],
) (*connect.Response[agentv1.CreateLoadBalanceResponse], error) {
	if err := s.service.CreateLoadBalance(request.WebsiteLBCreate{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Name:      req.Msg.GetName(),
		Algorithm: req.Msg.GetAlgorithm(),
		Servers:   lbServersFromProto(req.Msg.GetServers()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.CreateLoadBalanceResponse{}), nil
}

// UpdateLoadBalance 更新负载均衡配置。
func (s *WebsiteServer) UpdateLoadBalance(
	_ context.Context,
	req *connect.Request[agentv1.UpdateLoadBalanceRequest],
) (*connect.Response[agentv1.UpdateLoadBalanceResponse], error) {
	if err := s.service.UpdateLoadBalance(request.WebsiteLBUpdate{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Name:      req.Msg.GetName(),
		Algorithm: req.Msg.GetAlgorithm(),
		Servers:   lbServersFromProto(req.Msg.GetServers()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateLoadBalanceResponse{}), nil
}

// DeleteLoadBalance 删除负载均衡配置。
func (s *WebsiteServer) DeleteLoadBalance(
	_ context.Context,
	req *connect.Request[agentv1.DeleteLoadBalanceRequest],
) (*connect.Response[agentv1.DeleteLoadBalanceResponse], error) {
	if err := s.service.DeleteLoadBalance(request.WebsiteLBDelete{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Name:      req.Msg.GetName(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteLoadBalanceResponse{}), nil
}

// GetLoadBalances 读取负载均衡配置。
func (s *WebsiteServer) GetLoadBalances(
	_ context.Context,
	req *connect.Request[agentv1.GetLoadBalancesRequest],
) (*connect.Response[agentv1.GetLoadBalancesResponse], error) {
	list, err := s.service.GetLoadBalances(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.LoadBalance, 0, len(list))
	for _, item := range list {
		servers := make([]*agentv1.LoadBalanceServer, 0, len(item.Servers))
		for _, server := range item.Servers {
			servers = append(servers, &agentv1.LoadBalanceServer{
				Server:          server.Server,
				Weight:          int32(server.Weight),
				FailTimeout:     int32(server.FailTimeout),
				FailTimeoutUnit: server.FailTimeoutUnit,
				MaxFails:        int32(server.MaxFails),
				MaxConns:        int32(server.MaxConns),
				Flag:            server.Flag,
			})
		}
		items = append(items, &agentv1.LoadBalance{
			Name:      item.Name,
			Algorithm: item.Algorithm,
			Servers:   servers,
			Content:   item.Content,
		})
	}
	return connect.NewResponse(&agentv1.GetLoadBalancesResponse{Items: items}), nil
}

// GetProxyCache 读取代理缓存配置。
func (s *WebsiteServer) GetProxyCache(
	_ context.Context,
	req *connect.Request[agentv1.GetProxyCacheRequest],
) (*connect.Response[agentv1.ProxyCache], error) {
	res, err := s.service.GetProxyCache(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ProxyCache{
		Open:            res.Open,
		CacheLimit:      res.CacheLimit,
		CacheLimitUnit:  res.CacheLimitUnit,
		ShareCache:      int32(res.ShareCache),
		ShareCacheUnit:  res.ShareCacheUnit,
		CacheExpire:     int32(res.CacheExpire),
		CacheExpireUnit: res.CacheExpireUnit,
	}), nil
}

// UpdateProxyCache 更新代理缓存配置。
func (s *WebsiteServer) UpdateProxyCache(
	_ context.Context,
	req *connect.Request[agentv1.UpdateProxyCacheRequest],
) (*connect.Response[agentv1.UpdateProxyCacheResponse], error) {
	if err := s.service.UpdateProxyCache(request.NginxProxyCacheUpdate{
		WebsiteID:       uint(req.Msg.GetWebsiteId()),
		Open:            req.Msg.GetOpen(),
		CacheLimit:      int(req.Msg.GetCacheLimit()),
		CacheLimitUnit:  req.Msg.GetCacheLimitUnit(),
		ShareCache:      int(req.Msg.GetShareCache()),
		ShareCacheUnit:  req.Msg.GetShareCacheUnit(),
		CacheExpire:     int(req.Msg.GetCacheExpire()),
		CacheExpireUnit: req.Msg.GetCacheExpireUnit(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateProxyCacheResponse{}), nil
}

// Delete 删除网站。
func (s *WebsiteServer) Delete(
	_ context.Context,
	req *connect.Request[agentv1.DeleteWebsiteRequest],
) (*connect.Response[agentv1.DeleteWebsiteResponse], error) {
	if err := s.service.DeleteWebsite(request.WebsiteDelete{
		ID:           uint(req.Msg.GetId()),
		DeleteApp:    req.Msg.GetDeleteApp(),
		DeleteBackup: req.Msg.GetDeleteBackup(),
		ForceDelete:  req.Msg.GetForceDelete(),
		DeleteDB:     req.Msg.GetDeleteDb(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DeleteWebsiteResponse{}), nil
}

// GetNginxScopeConfig 读取 Nginx 指令级配置。
func (s *WebsiteServer) GetNginxScopeConfig(
	_ context.Context,
	req *connect.Request[agentv1.GetNginxScopeConfigRequest],
) (*connect.Response[agentv1.NginxScopeConfig], error) {
	res, err := s.service.GetNginxConfigByScope(request.NginxScopeReq{
		Scope:     agentdto.NginxKey(req.Msg.GetScope()),
		WebsiteID: uint(req.Msg.GetWebsiteId()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	params := make([]*agentv1.NginxParam, 0, len(res.Params))
	for _, item := range res.Params {
		params = append(params, &agentv1.NginxParam{
			Name:   item.Name,
			Params: item.Params,
			Source: item.Source,
		})
	}
	return connect.NewResponse(&agentv1.NginxScopeConfig{Enable: res.Enable, Params: params}), nil
}

// UpdateNginxScopeConfig 更新 Nginx 指令级配置。
func (s *WebsiteServer) UpdateNginxScopeConfig(
	_ context.Context,
	req *connect.Request[agentv1.UpdateNginxScopeConfigRequest],
) (*connect.Response[agentv1.UpdateNginxScopeConfigResponse], error) {
	var params interface{}
	if raw := req.Msg.GetParamsJson(); raw != "" {
		if err := json.Unmarshal([]byte(raw), &params); err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
	}
	if err := s.service.UpdateNginxConfigByScope(request.NginxConfigUpdate{
		Scope:     agentdto.NginxKey(req.Msg.GetScope()),
		Operate:   req.Msg.GetOperate(),
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Params:    params,
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateNginxScopeConfigResponse{}), nil
}

// GetHTTPS 读取网站 HTTPS 配置。
func (s *WebsiteServer) GetHTTPS(
	_ context.Context,
	req *connect.Request[agentv1.GetWebsiteHTTPSRequest],
) (*connect.Response[agentv1.WebsiteHTTPS], error) {
	res, err := s.service.GetWebsiteHTTPS(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(fromWebsiteHTTPS(&res)), nil
}

// UpdateHTTPS 更新网站 HTTPS 配置。
func (s *WebsiteServer) UpdateHTTPS(
	ctx context.Context,
	req *connect.Request[agentv1.UpdateWebsiteHTTPSRequest],
) (*connect.Response[agentv1.WebsiteHTTPS], error) {
	res, err := s.service.OpWebsiteHTTPS(ctx, request.WebsiteHTTPSOp{
		WebsiteID:             uint(req.Msg.GetWebsiteId()),
		Enable:                req.Msg.GetEnable(),
		WebsiteSSLID:          uint(req.Msg.GetWebsiteSslId()),
		Type:                  req.Msg.GetType(),
		PrivateKey:            req.Msg.GetPrivateKey(),
		Certificate:           req.Msg.GetCertificate(),
		HttpConfig:            req.Msg.GetHttpConfig(),
		SSLProtocol:           req.Msg.GetSslProtocol(),
		Algorithm:             req.Msg.GetAlgorithm(),
		Hsts:                  req.Msg.GetHsts(),
		HstsIncludeSubDomains: req.Msg.GetHstsIncludeSubDomains(),
		HttpsPorts:            int32Slice(req.Msg.GetHttpsPorts()),
		Http3:                 req.Msg.GetHttp3(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(fromWebsiteHTTPS(res)), nil
}

// GetAntiLeech 读取反盗链配置。
func (s *WebsiteServer) GetAntiLeech(
	_ context.Context,
	req *connect.Request[agentv1.GetAntiLeechRequest],
) (*connect.Response[agentv1.AntiLeechConfig], error) {
	res, err := s.service.GetAntiLeech(uint(req.Msg.GetWebsiteId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.AntiLeechConfig{
		Enable:      res.Enable,
		Extends:     res.Extends,
		Return:      res.Return,
		ServerNames: res.ServerNames,
		Cache:       res.Cache,
		CacheTime:   int32(res.CacheTime),
		CacheUint:   res.CacheUint,
		NoneRef:     res.NoneRef,
		LogEnable:   res.LogEnable,
		Blocked:     res.Blocked,
	}), nil
}

// UpdateAntiLeech 更新反盗链配置。
func (s *WebsiteServer) UpdateAntiLeech(
	_ context.Context,
	req *connect.Request[agentv1.UpdateAntiLeechRequest],
) (*connect.Response[agentv1.UpdateAntiLeechResponse], error) {
	if err := s.service.UpdateAntiLeech(request.NginxAntiLeechUpdate{
		WebsiteID:   uint(req.Msg.GetWebsiteId()),
		Enable:      req.Msg.GetEnable(),
		Extends:     req.Msg.GetExtends(),
		Return:      req.Msg.GetReturn(),
		ServerNames: req.Msg.GetServerNames(),
		Cache:       req.Msg.GetCache(),
		CacheTime:   int(req.Msg.GetCacheTime()),
		CacheUint:   req.Msg.GetCacheUint(),
		NoneRef:     req.Msg.GetNoneRef(),
		LogEnable:   req.Msg.GetLogEnable(),
		Blocked:     req.Msg.GetBlocked(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateAntiLeechResponse{}), nil
}

// GetProxies 读取反向代理列表。
func (s *WebsiteServer) GetProxies(
	_ context.Context,
	req *connect.Request[agentv1.GetProxiesRequest],
) (*connect.Response[agentv1.GetProxiesResponse], error) {
	list, err := s.service.GetProxies(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.WebsiteProxy, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.WebsiteProxy{
			Id:              uint32(item.ID),
			Name:            item.Name,
			Match:           item.Match,
			ProxyPass:       item.ProxyPass,
			ProxyHost:       item.ProxyHost,
			Enable:          item.Enable,
			Cache:           item.Cache,
			CacheTime:       int32(item.CacheTime),
			CacheUnit:       item.CacheUnit,
			ServerCacheTime: int32(item.ServerCacheTime),
			ServerCacheUnit: item.ServerCacheUnit,
			Sni:             item.SNI,
			ProxySslName:    item.ProxySSLName,
			SslVerify:       item.SSLVerify,
			FilePath:        item.FilePath,
			Content:         item.Content,
		})
	}
	return connect.NewResponse(&agentv1.GetProxiesResponse{Items: items}), nil
}

// ChangeDefault 将网站设为默认站点。
func (s *WebsiteServer) ChangeDefault(
	_ context.Context,
	req *connect.Request[agentv1.ChangeDefaultWebsiteRequest],
) (*connect.Response[agentv1.ChangeDefaultWebsiteResponse], error) {
	if err := s.service.ChangeDefaultServer(uint(req.Msg.GetId())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ChangeDefaultWebsiteResponse{}), nil
}

// GetRewrite 读取伪静态配置。
func (s *WebsiteServer) GetRewrite(
	_ context.Context,
	req *connect.Request[agentv1.GetRewriteRequest],
) (*connect.Response[agentv1.RewriteConfig], error) {
	res, err := s.service.GetRewriteConfig(request.NginxRewriteReq{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Name:      req.Msg.GetName(),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.RewriteConfig{Content: res.Content}), nil
}

// UpdateRewrite 保存伪静态配置。
func (s *WebsiteServer) UpdateRewrite(
	_ context.Context,
	req *connect.Request[agentv1.UpdateRewriteRequest],
) (*connect.Response[agentv1.UpdateRewriteResponse], error) {
	if err := s.service.UpdateRewriteConfig(request.NginxRewriteUpdate{
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Name:      req.Msg.GetName(),
		Content:   req.Msg.GetContent(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateRewriteResponse{}), nil
}

// GetRedirect 读取重定向配置列表。
func (s *WebsiteServer) GetRedirect(
	_ context.Context,
	req *connect.Request[agentv1.GetRedirectRequest],
) (*connect.Response[agentv1.GetRedirectResponse], error) {
	list, err := s.service.GetRedirect(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.RedirectConfig, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.RedirectConfig{
			WebsiteId:    uint32(item.WebsiteID),
			Name:         item.Name,
			Domains:      item.Domains,
			KeepPath:     item.KeepPath,
			Enable:       item.Enable,
			Type:         item.Type,
			Redirect:     item.Redirect,
			Path:         item.Path,
			Target:       item.Target,
			FilePath:     item.FilePath,
			Content:      item.Content,
			RedirectRoot: item.RedirectRoot,
		})
	}
	return connect.NewResponse(&agentv1.GetRedirectResponse{Items: items}), nil
}

// UpdateRedirect 保存重定向配置文件。
func (s *WebsiteServer) UpdateRedirect(
	_ context.Context,
	req *connect.Request[agentv1.UpdateRedirectRequest],
) (*connect.Response[agentv1.UpdateRedirectResponse], error) {
	if err := s.service.OperateRedirect(request.NginxRedirectReq{
		WebsiteID:    uint(req.Msg.GetWebsiteId()),
		Name:         req.Msg.GetName(),
		Domains:      req.Msg.GetDomains(),
		KeepPath:     req.Msg.GetKeepPath(),
		Enable:       req.Msg.GetEnable(),
		Type:         req.Msg.GetType(),
		Redirect:     req.Msg.GetRedirect(),
		Path:         req.Msg.GetPath(),
		Target:       req.Msg.GetTarget(),
		Operate:      req.Msg.GetOperate(),
		RedirectRoot: req.Msg.GetRedirectRoot(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateRedirectResponse{}), nil
}

// GetNginxFile 读取网站 Nginx 配置文件。
func (s *WebsiteServer) GetNginxFile(
	_ context.Context,
	req *connect.Request[agentv1.GetWebsiteNginxFileRequest],
) (*connect.Response[agentv1.FileEntry], error) {
	info, err := s.service.GetWebsiteNginxConfig(uint(req.Msg.GetId()), req.Msg.GetType())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(fromFileInfo(&info.FileInfo)), nil
}

// UpdateNginxFile 保存网站 Nginx 配置文件。
func (s *WebsiteServer) UpdateNginxFile(
	_ context.Context,
	req *connect.Request[agentv1.UpdateWebsiteNginxFileRequest],
) (*connect.Response[agentv1.UpdateWebsiteNginxFileResponse], error) {
	if err := s.service.UpdateNginxConfigFile(request.WebsiteNginxUpdate{
		ID:      uint(req.Msg.GetId()),
		Content: req.Msg.GetContent(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateWebsiteNginxFileResponse{}), nil
}

// GetLog 读取网站日志。
func (s *WebsiteServer) GetLog(
	_ context.Context,
	req *connect.Request[agentv1.GetWebsiteLogRequest],
) (*connect.Response[agentv1.WebsiteLog], error) {
	res, err := s.service.GetWebsiteLog(request.WebsiteLogSearchReq{
		ID:       uint(req.Msg.GetId()),
		LogType:  req.Msg.GetLogType(),
		Page:     int(req.Msg.GetPage()),
		PageSize: int(req.Msg.GetPageSize()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.WebsiteLog{
		Enable:  res.Enable,
		Content: res.Content,
		End:     res.End,
		Path:    res.Path,
	}), nil
}

// ListDomains 查询网站的域名列表。
func (s *WebsiteServer) ListDomains(
	_ context.Context,
	req *connect.Request[agentv1.ListWebsiteDomainsRequest],
) (*connect.Response[agentv1.ListWebsiteDomainsResponse], error) {
	list, err := s.service.GetWebsiteDomain(uint(req.Msg.GetWebsiteId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.WebsiteDomain, 0, len(list))
	for _, item := range list {
		items = append(items, &agentv1.WebsiteDomain{
			Id:        uint32(item.ID),
			CreatedAt: formatTime(item.CreatedAt),
			WebsiteId: uint32(item.WebsiteID),
			Domain:    item.Domain,
			Ssl:       item.SSL,
			Port:      int32(item.Port),
		})
	}
	return connect.NewResponse(&agentv1.ListWebsiteDomainsResponse{Items: items}), nil
}

// Get 按 ID 查询网站详情。
func (s *WebsiteServer) Get(
	_ context.Context,
	req *connect.Request[agentv1.GetWebsiteRequest],
) (*connect.Response[agentv1.Website], error) {
	website, err := s.service.GetWebsite(uint(req.Msg.GetId()))
	if err != nil {
		return nil, errmap.FromMsgKey("ErrRecordNotFound", err)
	}
	return connect.NewResponse(fromWebsiteDTO(website)), nil
}

// defaultString 给可选排序参数提供默认值。
//
// proto 里用空字符串表示「未指定」，但 1Panel 的查询层需要确定值，
// 否则会生成不完整的 SQL。
func defaultString(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

// fromWebsiteRes 把列表项转换成 proto。
func fromWebsiteRes(item response.WebsiteRes) *agentv1.Website {
	return &agentv1.Website{
		Id:            uint32(item.ID),
		CreatedAt:     formatTime(item.CreatedAt),
		Protocol:      item.Protocol,
		PrimaryDomain: item.PrimaryDomain,
		Type:          item.Type,
		Alias:         item.Alias,
		Remark:        item.Remark,
		Status:        item.Status,
		ExpireDate:    formatTime(item.ExpireDate),
		SitePath:      item.SitePath,
		AppName:       item.AppName,
		AppInstallId:  uint32(item.AppInstallID),
		SslExpireDate: formatTime(item.SSLExpireDate),
		SslStatus:     item.SSLStatus,
		ChildSites:    item.ChildSites,
		ParentSite:    item.ParentSite,
		Favorite:      item.Favorite,
		Ipv6:          item.IPV6,
	}
}

// fromWebsiteDTO 把详情转换成 proto。
func fromWebsiteDTO(item response.WebsiteDTO) *agentv1.Website {
	return &agentv1.Website{
		Id:            uint32(item.ID),
		CreatedAt:     formatTime(item.CreatedAt),
		Protocol:      item.Protocol,
		PrimaryDomain: item.PrimaryDomain,
		Type:          item.Type,
		Alias:         item.Alias,
		Remark:        item.Remark,
		Status:        item.Status,
		ExpireDate:    formatTime(item.ExpireDate),
		SitePath:      item.SitePath,
		AppName:       item.AppName,
		AppInstallId:  uint32(item.AppInstallID),
		SslExpireDate: formatTime(item.WebsiteSSL.ExpireDate),
		SslStatus:     sslStatus(item.WebsiteSSL.ExpireDate),
		Favorite:      item.Favorite,
		Ipv6:          item.IPV6,
	}
}

// formatTime 输出 RFC3339；零值输出空字符串，避免前端显示 0001-01-01。
func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format(time.RFC3339)
}

// sslStatus 与 1Panel 列表接口的取值保持一致：danger/warning/success。
func sslStatus(expireDate time.Time) string {
	if expireDate.IsZero() {
		return ""
	}
	days := int(time.Until(expireDate).Hours() / 24)
	switch {
	case days < 0:
		return "danger"
	case days <= 10:
		return "warning"
	default:
		return "success"
	}
}

// fromWebsiteHTTPS 转换 HTTPS 配置。
func fromWebsiteHTTPS(res *response.WebsiteHTTPS) *agentv1.WebsiteHTTPS {
	if res == nil {
		return &agentv1.WebsiteHTTPS{}
	}
	return &agentv1.WebsiteHTTPS{
		Enable:                res.Enable,
		HttpConfig:            res.HttpConfig,
		SslId:                 uint32(res.SSL.ID),
		SslPrimaryDomain:      res.SSL.PrimaryDomain,
		SslProtocol:           res.SSLProtocol,
		Algorithm:             res.Algorithm,
		Hsts:                  res.Hsts,
		HstsIncludeSubDomains: res.HstsIncludeSubDomains,
		HttpsPorts:            int32SliceFromInts(res.HttpsPorts),
		HttpsPort:             res.HttpsPort,
		Http3:                 res.Http3,
		Ssl: &agentv1.WebsiteSSLRef{
			Id:            uint32(res.SSL.ID),
			PrimaryDomain: res.SSL.PrimaryDomain,
			Domains:       res.SSL.Domains,
			Organization:  res.SSL.Organization,
			Provider:      res.SSL.Provider,
			ExpireDate:    formatTime(res.SSL.ExpireDate),
			Description:   res.SSL.Description,
			AcmeAccountId: uint32(res.SSL.AcmeAccountID),
		},
	}
}

// int32Slice 把 proto 的 int32 列表转成 []int。
func int32Slice(values []int32) []int {
	result := make([]int, 0, len(values))
	for _, value := range values {
		result = append(result, int(value))
	}
	return result
}

// int32SliceFromInts 把 []int 转成 proto 的 int32 列表。
func int32SliceFromInts(values []int) []int32 {
	result := make([]int32, 0, len(values))
	for _, value := range values {
		result = append(result, int32(value))
	}
	return result
}

// lbServersFromProto 把 proto 上游列表转成 DTO。
func lbServersFromProto(servers []*agentv1.LoadBalanceServer) []agentdto.NginxUpstreamServer {
	result := make([]agentdto.NginxUpstreamServer, 0, len(servers))
	for _, item := range servers {
		result = append(result, agentdto.NginxUpstreamServer{
			Server:          item.GetServer(),
			Weight:          int(item.GetWeight()),
			FailTimeout:     int(item.GetFailTimeout()),
			FailTimeoutUnit: item.GetFailTimeoutUnit(),
			MaxFails:        int(item.GetMaxFails()),
			MaxConns:        int(item.GetMaxConns()),
			Flag:            item.GetFlag(),
		})
	}
	return result
}

// ExecComposer 在网站目录中执行 Composer 命令。
func (s *WebsiteServer) ExecComposer(
	_ context.Context,
	req *connect.Request[agentv1.ExecComposerRequest],
) (*connect.Response[agentv1.ExecComposerResponse], error) {
	if err := s.service.ExecComposer(request.ExecComposerReq{
		Command:    req.Msg.GetCommand(),
		ExtCommand: req.Msg.GetExtCommand(),
		Mirror:     req.Msg.GetMirror(),
		Dir:        req.Msg.GetDir(),
		User:       req.Msg.GetUser(),
		WebsiteID:  uint(req.Msg.GetWebsiteId()),
		TaskID:     req.Msg.GetTaskId(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.ExecComposerResponse{}), nil
}

// BatchSetHttps 批量为网站启用 HTTPS。
func (s *WebsiteServer) BatchSetHttps(
	ctx context.Context,
	req *connect.Request[agentv1.BatchSetHttpsRequest],
) (*connect.Response[agentv1.BatchSetHttpsResponse], error) {
	ids := make([]uint, 0, len(req.Msg.GetIds()))
	for _, id := range req.Msg.GetIds() {
		ids = append(ids, uint(id))
	}
	ports := make([]int, 0, len(req.Msg.GetHttpsPorts()))
	for _, port := range req.Msg.GetHttpsPorts() {
		ports = append(ports, int(port))
	}
	if err := s.service.BatchSetHttps(ctx, request.BatchWebsiteHttps{
		IDs:                   ids,
		TaskID:                req.Msg.GetTaskId(),
		WebsiteSSLID:          uint(req.Msg.GetWebsiteSslId()),
		Type:                  req.Msg.GetType(),
		PrivateKey:            req.Msg.GetPrivateKey(),
		Certificate:           req.Msg.GetCertificate(),
		PrivateKeyPath:        req.Msg.GetPrivateKeyPath(),
		CertificatePath:       req.Msg.GetCertificatePath(),
		ImportType:            req.Msg.GetImportType(),
		HttpConfig:            req.Msg.GetHttpConfig(),
		SSLProtocol:           req.Msg.GetSslProtocol(),
		Algorithm:             req.Msg.GetAlgorithm(),
		Hsts:                  req.Msg.GetHsts(),
		HstsIncludeSubDomains: req.Msg.GetHstsIncludeSubDomains(),
		HttpsPorts:            ports,
		Http3:                 req.Msg.GetHttp3(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BatchSetHttpsResponse{}), nil
}
