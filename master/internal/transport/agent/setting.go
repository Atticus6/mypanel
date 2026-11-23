// Package agent 实现 panel.agent.v1 的 Connect 服务。
package agent

import (
	"context"

	"connectrpc.com/connect"

	"mypanel/agent/app/dto"
	"mypanel/agent/app/dto/request"
	"mypanel/agent/app/service"
	"mypanel/agent/global"
	agentssh "mypanel/agent/utils/ssh"
	agentv1 "mypanel/proto/gen/go/panel/agent/v1"

	"mypanel/master/internal/transport/conv"
	"mypanel/master/internal/transport/errmap"
)

// AgentSettingServer 实现 panel.agent.v1.AgentSettingService。
type AgentSettingServer struct {
	settingService service.ISettingService
}

// NewAgentSettingServer 构造 agent 系统设置服务。
func NewAgentSettingServer() *AgentSettingServer {
	return &AgentSettingServer{settingService: service.NewISettingService()}
}

// GetInfo 读取 agent 系统设置。
func (s *AgentSettingServer) GetInfo(
	_ context.Context,
	_ *connect.Request[agentv1.GetAgentSettingInfoRequest],
) (*connect.Response[agentv1.AgentSettingInfo], error) {
	info, err := s.settingService.GetSettingInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.AgentSettingInfo{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	// DTO 的 json tag 里带大写字母（systemIP、defaultIO、localSSHConnShow），
	// protojson 只认 systemIp、defaultIo、localSshConnShow，这几项必须手动补。
	msg.SystemIp = info.SystemIP
	msg.DefaultIo = info.DefaultIO
	msg.LocalSshConnShow = info.LocalSSHConnShow
	return connect.NewResponse(msg), nil
}

// UpdateSetting 更新 agent 系统设置中的单项。
func (s *AgentSettingServer) UpdateSetting(
	_ context.Context,
	req *connect.Request[agentv1.UpdateAgentSettingRequest],
) (*connect.Response[agentv1.UpdateAgentSettingResponse], error) {
	if err := s.settingService.Update(req.Msg.GetKey(), req.Msg.GetValue()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateAgentSettingResponse{}), nil
}

// GetBaseDir 读取 agent 数据目录。
func (s *AgentSettingServer) GetBaseDir(
	_ context.Context,
	_ *connect.Request[agentv1.GetBaseDirRequest],
) (*connect.Response[agentv1.DirectoryPath], error) {
	return connect.NewResponse(&agentv1.DirectoryPath{Path: global.Dir.DataDir}), nil
}

// GetWebsiteDir 读取网站根目录。
func (s *AgentSettingServer) GetWebsiteDir(
	_ context.Context,
	_ *connect.Request[agentv1.GetWebsiteDirRequest],
) (*connect.Response[agentv1.DirectoryPath], error) {
	return connect.NewResponse(&agentv1.DirectoryPath{Path: s.settingService.GetWebsiteDir()}), nil
}

// GetTerminalAI 读取终端 AI 设置。
func (s *AgentSettingServer) GetTerminalAI(
	_ context.Context,
	_ *connect.Request[agentv1.GetTerminalAIRequest],
) (*connect.Response[agentv1.TerminalAISetting], error) {
	info, err := s.settingService.GetTerminalAIInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.TerminalAISetting{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// UpdateTerminalAI 更新终端 AI 设置。
func (s *AgentSettingServer) UpdateTerminalAI(
	_ context.Context,
	req *connect.Request[agentv1.UpdateTerminalAIRequest],
) (*connect.Response[agentv1.UpdateTerminalAIResponse], error) {
	if err := s.settingService.UpdateTerminalAI(dto.TerminalAIInfo{
		AIStatus:       req.Msg.GetAiStatus(),
		AIAccountID:    req.Msg.GetAiAccountId(),
		AIPrefix:       req.Msg.GetAiPrefix(),
		AIRiskCommands: req.Msg.GetAiRiskCommands(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateTerminalAIResponse{}), nil
}

// GetFileAI 读取文件管理 AI 设置。
func (s *AgentSettingServer) GetFileAI(
	_ context.Context,
	_ *connect.Request[agentv1.GetFileAIRequest],
) (*connect.Response[agentv1.FileAISetting], error) {
	info, err := s.settingService.GetFileManageAIInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.FileAISetting{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// UpdateFileAI 更新文件管理 AI 设置。
func (s *AgentSettingServer) UpdateFileAI(
	_ context.Context,
	req *connect.Request[agentv1.UpdateFileAIRequest],
) (*connect.Response[agentv1.UpdateFileAIResponse], error) {
	if err := s.settingService.UpdateFileManageAI(dto.FileManageAIInfo{
		AIStatus:    req.Msg.GetAiStatus(),
		AIAccountID: req.Msg.GetAiAccountId(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateFileAIResponse{}), nil
}

// GetFileHistory 读取文件历史设置。
func (s *AgentSettingServer) GetFileHistory(
	_ context.Context,
	_ *connect.Request[agentv1.GetFileHistorySettingRequest],
) (*connect.Response[agentv1.FileHistorySetting], error) {
	info, err := s.settingService.GetFileHistorySettingInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &agentv1.FileHistorySetting{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// UpdateFileHistory 更新文件历史设置。
func (s *AgentSettingServer) UpdateFileHistory(
	_ context.Context,
	req *connect.Request[agentv1.UpdateFileHistorySettingRequest],
) (*connect.Response[agentv1.UpdateFileHistorySettingResponse], error) {
	if err := s.settingService.UpdateFileHistorySetting(request.FileHistorySettingUpdate{
		Enable:      req.Msg.GetEnable(),
		MaxPerPath:  int(req.Msg.GetMaxPerPath()),
		DiskQuotaMB: int(req.Msg.GetDiskQuotaMb()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.UpdateFileHistorySettingResponse{}), nil
}

// SaveDescription 保存资源描述。
func (s *AgentSettingServer) SaveDescription(
	_ context.Context,
	req *connect.Request[agentv1.SaveDescriptionRequest],
) (*connect.Response[agentv1.SaveDescriptionResponse], error) {
	if err := s.settingService.SaveDescription(dto.CommonDescription{
		ID:          req.Msg.GetId(),
		Type:        req.Msg.GetType(),
		DetailType:  req.Msg.GetDetailType(),
		IsPinned:    req.Msg.GetIsPinned(),
		Description: req.Msg.GetDescription(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SaveDescriptionResponse{}), nil
}

// GetLocalConn 读取本地终端保存的连接信息。
func (s *AgentSettingServer) GetLocalConn(
	_ context.Context,
	_ *connect.Request[agentv1.GetLocalConnRequest],
) (*connect.Response[agentv1.LocalSSHConn], error) {
	info := s.settingService.GetLocalConn()
	msg := &agentv1.LocalSSHConn{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// SetDefaultConn 设置本地终端默认连接开关。
func (s *AgentSettingServer) SetDefaultConn(
	_ context.Context,
	req *connect.Request[agentv1.SetDefaultConnRequest],
) (*connect.Response[agentv1.SetDefaultConnResponse], error) {
	if err := s.settingService.SetDefaultIsConn(dto.SSHDefaultConn{
		WithReset:   req.Msg.GetWithReset(),
		DefaultConn: req.Msg.GetDefaultConn(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SetDefaultConnResponse{}), nil
}

// TestConnByInfo 使用请求中的连接信息测试本地终端。
func (s *AgentSettingServer) TestConnByInfo(
	_ context.Context,
	req *connect.Request[agentv1.TestLocalConnInfoRequest],
) (*connect.Response[agentv1.TestLocalConnResponse], error) {
	ok := s.settingService.TestConnByInfo(dto.SSHConnData{
		Addr:       req.Msg.GetAddr(),
		Port:       uint(req.Msg.GetPort()),
		User:       req.Msg.GetUser(),
		AuthMode:   req.Msg.GetAuthMode(),
		Password:   encodeSecret(req.Msg.GetPassword()),
		PrivateKey: encodeSecret(req.Msg.GetPrivateKey()),
		PassPhrase: req.Msg.GetPassPhrase(),
	})
	return connect.NewResponse(&agentv1.TestLocalConnResponse{Ok: ok}), nil
}

// TestLocalConn 使用已保存的连接信息测试本地终端。
func (s *AgentSettingServer) TestLocalConn(
	_ context.Context,
	_ *connect.Request[agentv1.TestLocalConnRequest],
) (*connect.Response[agentv1.TestLocalConnResponse], error) {
	info, err := s.settingService.GetLocalConnForSSH()
	if err != nil {
		return connect.NewResponse(&agentv1.TestLocalConnResponse{Ok: false}), nil
	}
	// 与旧 handler 的 loadLocalConn 一致：连不上不算接口错误，只返回 false。
	client, err := agentssh.NewClient(agentssh.ConnInfo{
		Addr:       info.Addr,
		Port:       int(info.Port),
		User:       info.User,
		AuthMode:   info.AuthMode,
		Password:   info.Password,
		PrivateKey: []byte(info.PrivateKey),
		PassPhrase: []byte(info.PassPhrase),
	})
	if err != nil {
		return connect.NewResponse(&agentv1.TestLocalConnResponse{Ok: false}), nil
	}
	defer client.Close()
	return connect.NewResponse(&agentv1.TestLocalConnResponse{Ok: true}), nil
}

// SaveLocalConn 保存本地终端连接信息。
func (s *AgentSettingServer) SaveLocalConn(
	_ context.Context,
	req *connect.Request[agentv1.SaveLocalConnRequest],
) (*connect.Response[agentv1.SaveLocalConnResponse], error) {
	if err := s.settingService.SaveConnInfo(dto.SSHConnData{
		Addr:       req.Msg.GetAddr(),
		Port:       uint(req.Msg.GetPort()),
		User:       req.Msg.GetUser(),
		AuthMode:   req.Msg.GetAuthMode(),
		Password:   encodeSecret(req.Msg.GetPassword()),
		PrivateKey: encodeSecret(req.Msg.GetPrivateKey()),
		PassPhrase: req.Msg.GetPassPhrase(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&agentv1.SaveLocalConnResponse{}), nil
}

// GetSystemAvailable 返回空响应表示 agent 可用。
func (s *AgentSettingServer) GetSystemAvailable(
	_ context.Context,
	_ *connect.Request[agentv1.GetAgentAvailableRequest],
) (*connect.Response[agentv1.GetAgentAvailableResponse], error) {
	return connect.NewResponse(&agentv1.GetAgentAvailableResponse{}), nil
}
