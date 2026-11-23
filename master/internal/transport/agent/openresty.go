package agent

import (
	"context"
	"encoding/json"

	"connectrpc.com/connect"

	agentdto "mypanel/agent/app/dto"
	"mypanel/agent/app/dto/request"
	"mypanel/agent/app/dto/response"
	agentservice "mypanel/agent/app/service"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/errmap"
)

// OpenrestyServer 实现 panel.agent.v1.OpenrestyService。
type OpenrestyServer struct {
	service agentservice.NginxService
}

// NewOpenrestyServer 构造 OpenResty 服务。
func NewOpenrestyServer() *OpenrestyServer {
	return &OpenrestyServer{service: agentservice.NginxService{}}
}

// GetConfig 读取主配置内容。
func (s *OpenrestyServer) GetConfig(
	_ context.Context,
	_ *connect.Request[agentv1.GetOpenrestyConfigRequest],
) (*connect.Response[agentv1.OpenrestyConfig], error) {
	file, err := s.service.GetNginxConfig()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OpenrestyConfig{Content: file.Content}), nil
}

// GetConfigByScope 按作用域读取配置项。
func (s *OpenrestyServer) GetConfigByScope(
	_ context.Context,
	req *connect.Request[agentv1.GetOpenrestyConfigByScopeRequest],
) (*connect.Response[agentv1.OpenrestyParams], error) {
	data, err := s.service.GetConfigByScope(request.NginxScopeReq{
		Scope:     agentdto.NginxKey(req.Msg.GetScope()),
		WebsiteID: uint(req.Msg.GetWebsiteId()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	result := &agentv1.OpenrestyParams{}
	switch typed := data.(type) {
	case []response.NginxParam:
		result.Items = fromNginxParams(typed)
	case *response.NginxBrotliRes:
		if typed != nil {
			result.Items = fromNginxParams(typed.Params)
			result.ManagedExternally = typed.ManagedExternally
			result.ManagedPending = typed.ManagedPending
			result.ManagedUnavailable = typed.ManagedUnavailable
		}
	}
	return connect.NewResponse(result), nil
}

// UpdateConfigByScope 按作用域更新配置项。
func (s *OpenrestyServer) UpdateConfigByScope(
	_ context.Context,
	req *connect.Request[agentv1.UpdateOpenrestyConfigRequest],
) (*connect.Response[agentv1.UpdateOpenrestyConfigResponse], error) {
	var params any
	if raw := req.Msg.GetParamsJson(); raw != "" {
		if err := json.Unmarshal([]byte(raw), &params); err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
	}
	if err := s.service.UpdateConfigByScope(request.NginxConfigUpdate{
		Scope:     agentdto.NginxKey(req.Msg.GetScope()),
		Operate:   req.Msg.GetOperate(),
		WebsiteID: uint(req.Msg.GetWebsiteId()),
		Params:    params,
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateOpenrestyConfigResponse{}), nil
}

// GetStatus 读取 OpenResty 运行状态。
func (s *OpenrestyServer) GetStatus(
	_ context.Context,
	_ *connect.Request[agentv1.GetOpenrestyStatusRequest],
) (*connect.Response[agentv1.OpenrestyStatus], error) {
	status, err := s.service.GetStatus()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OpenrestyStatus{
		Active:   int32(status.Active),
		Accepts:  int32(status.Accepts),
		Handled:  int32(status.Handled),
		Requests: int32(status.Requests),
		Reading:  int32(status.Reading),
		Writing:  int32(status.Writing),
		Waiting:  int32(status.Waiting),
	}), nil
}

// UpdateConfigFile 用完整文件内容替换主配置。
func (s *OpenrestyServer) UpdateConfigFile(
	_ context.Context,
	req *connect.Request[agentv1.UpdateOpenrestyConfigFileRequest],
) (*connect.Response[agentv1.UpdateOpenrestyConfigFileResponse], error) {
	if err := s.service.UpdateConfigFile(request.NginxConfigFileUpdate{
		Content: req.Msg.GetContent(),
		Backup:  req.Msg.GetBackup(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateOpenrestyConfigFileResponse{}), nil
}

// Build 重新构建 OpenResty。
func (s *OpenrestyServer) Build(
	_ context.Context,
	req *connect.Request[agentv1.BuildOpenrestyRequest],
) (*connect.Response[agentv1.BuildOpenrestyResponse], error) {
	if err := s.service.Build(request.NginxBuildReq{
		TaskID:  req.Msg.GetTaskId(),
		Mirror:  req.Msg.GetMirror(),
		Modules: req.Msg.GetModules(),
		Force:   req.Msg.GetForce(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.BuildOpenrestyResponse{}), nil
}

// UpdateModule 更新自定义模块。
func (s *OpenrestyServer) UpdateModule(
	_ context.Context,
	req *connect.Request[agentv1.UpdateOpenrestyModuleRequest],
) (*connect.Response[agentv1.UpdateOpenrestyModuleResponse], error) {
	if err := s.service.UpdateModule(request.NginxModuleUpdate{
		Operate:   req.Msg.GetOperate(),
		Name:      req.Msg.GetName(),
		Script:    req.Msg.GetScript(),
		Packages:  req.Msg.GetPackages(),
		Enable:    req.Msg.GetEnable(),
		Params:    req.Msg.GetParams(),
		BuildMode: req.Msg.GetBuildMode(),
		Provider:  req.Msg.GetProvider(),
		LoadOrder: int(req.Msg.GetLoadOrder()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateOpenrestyModuleResponse{}), nil
}

// GetModules 读取可用模块与构建配置。
func (s *OpenrestyServer) GetModules(
	_ context.Context,
	_ *connect.Request[agentv1.GetOpenrestyModulesRequest],
) (*connect.Response[agentv1.OpenrestyModules], error) {
	config, err := s.service.GetModules()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*agentv1.OpenrestyModule, 0, len(config.Modules))
	for _, item := range config.Modules {
		items = append(items, &agentv1.OpenrestyModule{
			Name:          item.Name,
			Custom:        item.Custom,
			Script:        item.Script,
			Packages:      item.Packages,
			Params:        item.Params,
			Enable:        item.Enable,
			BuildMode:     item.BuildMode,
			Provider:      item.Provider,
			LoadOrder:     int32(item.LoadOrder),
			BuildStatus:   item.BuildStatus,
			LoadStatus:    item.LoadStatus,
			ArtifactsJson: marshalJSON(item.Artifacts),
			LastError:     item.LastError,
		})
	}
	return connect.NewResponse(&agentv1.OpenrestyModules{
		Mirror:           config.Mirror,
		DynamicSupported: config.DynamicSupported,
		Items:            items,
	}), nil
}

// OperateDefaultHTTPS 开启或关闭默认 HTTPS。
func (s *OpenrestyServer) OperateDefaultHTTPS(
	_ context.Context,
	req *connect.Request[agentv1.OperateDefaultHTTPSRequest],
) (*connect.Response[agentv1.OperateDefaultHTTPSResponse], error) {
	if err := s.service.OperateDefaultHTTPs(request.NginxDefaultHTTPSUpdate{
		Operate:            req.Msg.GetOperate(),
		SSLRejectHandshake: req.Msg.GetSslRejectHandshake(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.OperateDefaultHTTPSResponse{}), nil
}

// GetDefaultHTTPSStatus 读取默认 HTTPS 状态。
func (s *OpenrestyServer) GetDefaultHTTPSStatus(
	_ context.Context,
	_ *connect.Request[agentv1.GetDefaultHTTPSStatusRequest],
) (*connect.Response[agentv1.DefaultHTTPSStatus], error) {
	status, err := s.service.GetDefaultHttpsStatus()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.DefaultHTTPSStatus{
		Https:              status.Https,
		SslRejectHandshake: status.SSLRejectHandshake,
	}), nil
}

// fromNginxParams 把服务层配置参数转成 proto。
func fromNginxParams(params []response.NginxParam) []*agentv1.OpenrestyParam {
	items := make([]*agentv1.OpenrestyParam, 0, len(params))
	for _, item := range params {
		items = append(items, &agentv1.OpenrestyParam{
			Name:   item.Name,
			Params: item.Params,
			Source: item.Source,
		})
	}
	return items
}
