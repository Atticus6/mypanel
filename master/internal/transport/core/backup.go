package core

import (
	"context"

	"connectrpc.com/connect"

	"mypanel/core/app/dto"
	"mypanel/core/app/service"
	"mypanel/core/utils/xpack"
	corev1 "mypanel/proto/gen/go/panel/core/v1"

	"mypanel/master/internal/transport/errmap"
)

// BackupServer 实现 panel.core.v1.BackupsService。
type BackupServer struct {
	service service.IBackupService
}

// NewBackupServer 构造备份账号服务。
func NewBackupServer() *BackupServer {
	return &BackupServer{service: service.NewIBackupService()}
}

// Create 创建备份账号。
func (s *BackupServer) Create(
	_ context.Context,
	req *connect.Request[corev1.CreateBackupRequest],
) (*connect.Response[corev1.CreateBackupResponse], error) {
	if err := s.service.Create(dto.BackupOperate{
		Name:         req.Msg.GetName(),
		Type:         req.Msg.GetType(),
		IsPublic:     req.Msg.GetIsPublic(),
		Bucket:       req.Msg.GetBucket(),
		AccessKey:    req.Msg.GetAccessKey(),
		Credential:   req.Msg.GetCredential(),
		BackupPath:   req.Msg.GetBackupPath(),
		Vars:         req.Msg.GetVars(),
		RememberAuth: req.Msg.GetRememberAuth(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.CreateBackupResponse{}), nil
}

// Update 修改备份账号。
func (s *BackupServer) Update(
	_ context.Context,
	req *connect.Request[corev1.UpdateBackupRequest],
) (*connect.Response[corev1.UpdateBackupResponse], error) {
	if err := s.service.Update(dto.BackupOperate{
		ID:           uint(req.Msg.GetId()),
		Name:         req.Msg.GetName(),
		Type:         req.Msg.GetType(),
		IsPublic:     req.Msg.GetIsPublic(),
		Bucket:       req.Msg.GetBucket(),
		AccessKey:    req.Msg.GetAccessKey(),
		Credential:   req.Msg.GetCredential(),
		BackupPath:   req.Msg.GetBackupPath(),
		Vars:         req.Msg.GetVars(),
		RememberAuth: req.Msg.GetRememberAuth(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateBackupResponse{}), nil
}

// Delete 删除备份账号。
func (s *BackupServer) Delete(
	_ context.Context,
	req *connect.Request[corev1.DeleteBackupRequest],
) (*connect.Response[corev1.DeleteBackupResponse], error) {
	if err := s.service.Delete(req.Msg.GetName()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.DeleteBackupResponse{}), nil
}

// RefreshToken 刷新 OAuth 令牌。
func (s *BackupServer) RefreshToken(
	_ context.Context,
	req *connect.Request[corev1.RefreshBackupTokenRequest],
) (*connect.Response[corev1.RefreshBackupTokenResponse], error) {
	if err := s.service.RefreshToken(dto.OperateByName{Name: req.Msg.GetName()}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.RefreshBackupTokenResponse{}), nil
}

// GetClientInfo 读取 OAuth 客户端信息。
func (s *BackupServer) GetClientInfo(
	_ context.Context,
	req *connect.Request[corev1.GetBackupClientInfoRequest],
) (*connect.Response[corev1.BackupClientInfo], error) {
	info, err := s.service.LoadBackupClientInfo(req.Msg.GetClientType())
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.BackupClientInfo{
		ClientId:     info.ClientID,
		ClientSecret: info.ClientSecret,
		RedirectUri:  info.RedirectUri,
	}), nil
}

// GenerateAPIKey 生成当前账号的 API 密钥。
func (s *AuthServer) GenerateAPIKey(
	ctx context.Context,
	_ *connect.Request[corev1.GenerateAPIKeyRequest],
) (*connect.Response[corev1.GenerateAPIKeyResponse], error) {
	// 与旧 handler 一致：需要未过期的密码；生成后会撤销既有 API 会话。
	c := requireGinContext(ctx)
	apiKey, err := xpack.AuthProvider.GenerateApiKey(c)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.GenerateAPIKeyResponse{ApiKey: apiKey}), nil
}

// UpdateAPIConfig 修改当前账号的 API 接口配置。
func (s *AuthServer) UpdateAPIConfig(
	ctx context.Context,
	req *connect.Request[corev1.UpdateAPIConfigRequest],
) (*connect.Response[corev1.UpdateAPIConfigResponse], error) {
	c := requireGinContext(ctx)
	if err := xpack.AuthProvider.UpdateApiConfig(c, dto.ApiInterfaceConfig{
		IpWhiteList:        req.Msg.GetIpWhiteList(),
		ApiTrustedProxies:  req.Msg.GetApiTrustedProxies(),
		ApiKeyValidityTime: int(req.Msg.GetApiKeyValidityTime()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateAPIConfigResponse{}), nil
}
