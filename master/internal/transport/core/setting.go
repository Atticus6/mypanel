// Package core 实现 panel.core.v1 的 Connect 服务。
package core

import (
	"context"
	"encoding/base64"
	"errors"
	"net"
	"os"
	"path/filepath"

	"connectrpc.com/connect"

	"mypanel/core/app/dto"
	"mypanel/core/app/service"
	"mypanel/core/global"
	"mypanel/core/utils/common"
	corev1 "mypanel/proto/gen/go/panel/core/v1"

	"mypanel/master/internal/transport/conv"
	"mypanel/master/internal/transport/errmap"
)

// SettingServer 实现 panel.core.v1.SettingService。
type SettingServer struct {
	settingService service.ISettingService
	upgradeService service.IUpgradeService
}

// NewSettingServer 构造系统设置服务。
func NewSettingServer() *SettingServer {
	return &SettingServer{
		settingService: service.NewISettingService(),
		upgradeService: service.NewIUpgradeService(),
	}
}

// GetInfo 读取面板完整设置。
func (s *SettingServer) GetInfo(
	_ context.Context,
	_ *connect.Request[corev1.GetSettingInfoRequest],
) (*connect.Response[corev1.SettingInfo], error) {
	info, err := s.settingService.GetSettingInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &corev1.SettingInfo{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// GetBaseInfo 读取精简设置。
func (s *SettingServer) GetBaseInfo(
	_ context.Context,
	_ *connect.Request[corev1.GetSettingBaseInfoRequest],
) (*connect.Response[corev1.SettingBaseInfo], error) {
	info, err := s.settingService.GetSettingBaseInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &corev1.SettingBaseInfo{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// GetTerminal 读取终端外观设置。
func (s *SettingServer) GetTerminal(
	_ context.Context,
	_ *connect.Request[corev1.GetTerminalRequest],
) (*connect.Response[corev1.TerminalInfo], error) {
	info, err := s.settingService.GetTerminalInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &corev1.TerminalInfo{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// UpdateTerminal 更新终端外观设置。
func (s *SettingServer) UpdateTerminal(
	_ context.Context,
	req *connect.Request[corev1.UpdateTerminalRequest],
) (*connect.Response[corev1.UpdateTerminalResponse], error) {
	// DTO 用指针表达「未填写」，proto 的空字符串等价于未填写。
	optional := func(value string) *string {
		if value == "" {
			return nil
		}
		return &value
	}
	if err := s.settingService.UpdateTerminal(dto.TerminalUpdate{
		ShowTerminalButton: optional(req.Msg.GetShowTerminalButton()),
		LineHeight:         optional(req.Msg.GetLineHeight()),
		LetterSpacing:      optional(req.Msg.GetLetterSpacing()),
		FontSize:           optional(req.Msg.GetFontSize()),
		FontFamily:         optional(req.Msg.GetFontFamily()),
		BackgroundColor:    optional(req.Msg.GetBackgroundColor()),
		ForegroundColor:    optional(req.Msg.GetForegroundColor()),
		CursorBlink:        optional(req.Msg.GetCursorBlink()),
		CursorStyle:        optional(req.Msg.GetCursorStyle()),
		Scrollback:         optional(req.Msg.GetScrollback()),
		ScrollSensitivity:  optional(req.Msg.GetScrollSensitivity()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateTerminalResponse{}), nil
}

// UpdateSetting 更新单个设置项。
func (s *SettingServer) UpdateSetting(
	ctx context.Context,
	req *connect.Request[corev1.UpdateSettingRequest],
) (*connect.Response[corev1.UpdateSettingResponse], error) {
	// Update 依赖 gin.Context 记录审计与刷新缓存，这里复用合成上下文。
	c := requireGinContext(ctx)
	if err := s.settingService.Update(c, req.Msg.GetKey(), req.Msg.GetValue()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateSettingResponse{}), nil
}

// GetInterface 读取本机可用访问地址。
func (s *SettingServer) GetInterface(
	_ context.Context,
	_ *connect.Request[corev1.GetInterfaceRequest],
) (*connect.Response[corev1.InterfaceAddresses], error) {
	addrs, err := s.settingService.LoadInterfaceAddr()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.InterfaceAddresses{Addrs: addrs}), nil
}

// GetMemo 读取仪表盘备忘录。
func (s *SettingServer) GetMemo(
	_ context.Context,
	_ *connect.Request[corev1.GetMemoRequest],
) (*connect.Response[corev1.Memo], error) {
	content, err := s.settingService.GetMemo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.Memo{Content: content}), nil
}

// UpdateMemo 更新仪表盘备忘录。
func (s *SettingServer) UpdateMemo(
	_ context.Context,
	req *connect.Request[corev1.UpdateMemoRequest],
) (*connect.Response[corev1.UpdateMemoResponse], error) {
	if err := s.settingService.UpdateMemo(req.Msg.GetContent()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateMemoResponse{}), nil
}

// GetFileDownloadPreference 读取当前用户的下载命名偏好。
func (s *SettingServer) GetFileDownloadPreference(
	ctx context.Context,
	_ *connect.Request[corev1.GetFileDownloadPreferenceRequest],
) (*connect.Response[corev1.FileDownloadPreference], error) {
	userID, err := currentUserID(ctx)
	if err != nil {
		return nil, err
	}
	preference, err := s.settingService.GetFileDownloadPreference(userID)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.FileDownloadPreference{
		UseServerFilename: preference.UseServerFilename,
	}), nil
}

// UpdateFileDownloadPreference 更新当前用户的下载命名偏好。
func (s *SettingServer) UpdateFileDownloadPreference(
	ctx context.Context,
	req *connect.Request[corev1.UpdateFileDownloadPreferenceRequest],
) (*connect.Response[corev1.UpdateFileDownloadPreferenceResponse], error) {
	userID, err := currentUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.settingService.UpdateFileDownloadPreference(userID, dto.FileDownloadPreference{
		UseServerFilename: req.Msg.GetUseServerFilename(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateFileDownloadPreferenceResponse{}), nil
}

// UpdatePort 修改面板监听端口。
func (s *SettingServer) UpdatePort(
	_ context.Context,
	req *connect.Request[corev1.UpdatePortRequest],
) (*connect.Response[corev1.UpdatePortResponse], error) {
	if err := s.settingService.UpdatePort(uint(req.Msg.GetPort())); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdatePortResponse{}), nil
}

// UpdateBindInfo 修改面板绑定地址。
func (s *SettingServer) UpdateBindInfo(
	_ context.Context,
	req *connect.Request[corev1.UpdateBindInfoRequest],
) (*connect.Response[corev1.UpdateBindInfoResponse], error) {
	if err := s.settingService.UpdateBindInfo(dto.BindInfo{
		Ipv6:        req.Msg.GetIpv6(),
		BindAddress: req.Msg.GetBindAddress(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateBindInfoResponse{}), nil
}

// GetSSLInfo 读取面板 HTTPS 证书信息。
func (s *SettingServer) GetSSLInfo(
	_ context.Context,
	_ *connect.Request[corev1.GetSSLInfoRequest],
) (*connect.Response[corev1.SSLInfo], error) {
	info, err := s.settingService.LoadFromCert()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &corev1.SSLInfo{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// UpdateSSL 更新面板 HTTPS 配置。
func (s *SettingServer) UpdateSSL(
	ctx context.Context,
	req *connect.Request[corev1.UpdateSSLRequest],
) (*connect.Response[corev1.UpdateSSLResponse], error) {
	if err := s.settingService.UpdateSSL(requireGinContext(ctx), dto.SSLUpdate{
		SSLType: req.Msg.GetSslType(),
		Domain:  req.Msg.GetDomain(),
		SSL:     req.Msg.GetSsl(),
		Cert:    req.Msg.GetCert(),
		Key:     req.Msg.GetKey(),
		SSLID:   uint(req.Msg.GetSslId()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateSSLResponse{}), nil
}

// ReloadSSL 重新加载面板证书；仅允许本机调用。
func (s *SettingServer) ReloadSSL(
	ctx context.Context,
	_ *connect.Request[corev1.ReloadSSLRequest],
) (*connect.Response[corev1.ReloadSSLResponse], error) {
	// 重载证书会重启面板 HTTPS 监听，远程调用等同于把管理员锁在外面，
	// 因此沿用旧 handler 的本机限制。
	clientIP := common.GetRealClientIP(requireGinContext(ctx))
	if ip := net.ParseIP(clientIP); ip == nil || !ip.IsLoopback() {
		return nil, errmap.FromMsgKey("ErrInvalidParams", errors.New("only localhost can reload ssl"))
	}
	if err := s.settingService.UpdateSystemSSL(); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.ReloadSSLResponse{}), nil
}

// DownloadSSL 读取面板当前使用的证书文件。
func (s *SettingServer) DownloadSSL(
	_ context.Context,
	_ *connect.Request[corev1.DownloadSSLRequest],
) (*connect.Response[corev1.SSLFile], error) {
	// 面板证书固定存放在安装目录的 secret 下，路径不来自请求，避免目录穿越。
	pathItem := filepath.Join(global.CONF.Base.InstallDir, "1panel/secret/server.crt")
	content, err := os.ReadFile(pathItem)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.SSLFile{
		Filename:      filepath.Base(pathItem),
		ContentBase64: base64.StdEncoding.EncodeToString(content),
	}), nil
}

// GetUpgradeInfo 读取升级信息。
func (s *SettingServer) GetUpgradeInfo(
	_ context.Context,
	_ *connect.Request[corev1.GetUpgradeInfoRequest],
) (*connect.Response[corev1.UpgradeInfo], error) {
	info, err := s.upgradeService.SearchUpgrade()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &corev1.UpgradeInfo{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// Upgrade 执行面板升级。
func (s *SettingServer) Upgrade(
	_ context.Context,
	req *connect.Request[corev1.UpgradeRequest],
) (*connect.Response[corev1.UpgradeResponse], error) {
	if err := s.upgradeService.Upgrade(dto.Upgrade{Version: req.Msg.GetVersion()}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpgradeResponse{}), nil
}

// GetUpgradeNotes 读取指定版本的更新说明。
func (s *SettingServer) GetUpgradeNotes(
	_ context.Context,
	req *connect.Request[corev1.GetUpgradeNotesRequest],
) (*connect.Response[corev1.UpgradeNotes], error) {
	content, err := s.upgradeService.LoadNotes(dto.Upgrade{Version: req.Msg.GetVersion()})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpgradeNotes{Content: content}), nil
}

// ListReleases 读取全部版本说明。
func (s *SettingServer) ListReleases(
	_ context.Context,
	_ *connect.Request[corev1.ListReleasesRequest],
) (*connect.Response[corev1.ListReleasesResponse], error) {
	list, err := s.upgradeService.LoadRelease()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*corev1.ReleaseNote, 0, len(list))
	for _, item := range list {
		items = append(items, &corev1.ReleaseNote{
			Version:           item.Version,
			CreatedAt:         item.CreatedAt,
			Content:           item.Content,
			NewCount:          int32(item.NewCount),
			OptimizationCount: int32(item.OptimizationCount),
			FixCount:          int32(item.FixCount),
		})
	}
	return connect.NewResponse(&corev1.ListReleasesResponse{Items: items}), nil
}

// GetAppStoreConfig 读取应用商店行为配置。
func (s *SettingServer) GetAppStoreConfig(
	_ context.Context,
	_ *connect.Request[corev1.GetAppStoreConfigRequest],
) (*connect.Response[corev1.AppStoreConfig], error) {
	info, err := s.settingService.GetAppstoreConfig()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	msg := &corev1.AppStoreConfig{}
	if err := conv.FromDTO(info, msg); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(msg), nil
}

// UpdateAppStoreConfig 更新应用商店配置。
func (s *SettingServer) UpdateAppStoreConfig(
	_ context.Context,
	req *connect.Request[corev1.UpdateAppStoreConfigRequest],
) (*connect.Response[corev1.UpdateAppStoreConfigResponse], error) {
	if err := s.settingService.UpdateAppstoreConfig(dto.AppstoreUpdate{
		Scope:  req.Msg.GetScope(),
		Status: req.Msg.GetStatus(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateAppStoreConfigResponse{}), nil
}

// UpdateMenu 更新菜单设置项。
func (s *SettingServer) UpdateMenu(
	ctx context.Context,
	req *connect.Request[corev1.UpdateMenuRequest],
) (*connect.Response[corev1.UpdateMenuResponse], error) {
	if err := s.settingService.Update(requireGinContext(ctx), req.Msg.GetKey(), req.Msg.GetValue()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateMenuResponse{}), nil
}

// DefaultMenu 重置菜单为默认布局。
func (s *SettingServer) DefaultMenu(
	_ context.Context,
	_ *connect.Request[corev1.DefaultMenuRequest],
) (*connect.Response[corev1.DefaultMenuResponse], error) {
	if err := s.settingService.DefaultMenu(); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.DefaultMenuResponse{}), nil
}

// UpdateProxy 更新服务器代理配置。
func (s *SettingServer) UpdateProxy(
	_ context.Context,
	req *connect.Request[corev1.UpdateProxyRequest],
) (*connect.Response[corev1.UpdateProxyResponse], error) {
	// 旧 handler 要求密码以 base64 传输，这里先在 proto 层解码，
	// 保证 service 层拿到的仍是明文密码。
	passwd := req.Msg.GetProxyPasswd()
	if passwd != "" && req.Msg.GetProxyType() != "" {
		decoded, err := base64.StdEncoding.DecodeString(passwd)
		if err != nil {
			return nil, errmap.FromMsgKey("ErrInvalidParams", err)
		}
		passwd = string(decoded)
	}
	if err := s.settingService.UpdateProxy(dto.ProxyUpdate{
		ProxyUrl:          req.Msg.GetProxyUrl(),
		ProxyType:         req.Msg.GetProxyType(),
		ProxyPort:         req.Msg.GetProxyPort(),
		ProxyUser:         req.Msg.GetProxyUser(),
		ProxyPasswd:       passwd,
		ProxyPasswdKeep:   req.Msg.GetProxyPasswdKeep(),
		ProxyDocker:       req.Msg.GetProxyDocker(),
		WithDockerRestart: req.Msg.GetWithDockerRestart(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateProxyResponse{}), nil
}

// GetSystemAvailable 返回空响应表示面板可用。
func (s *SettingServer) GetSystemAvailable(
	_ context.Context,
	_ *connect.Request[corev1.GetSystemAvailableRequest],
) (*connect.Response[corev1.GetSystemAvailableResponse], error) {
	return connect.NewResponse(&corev1.GetSystemAvailableResponse{}), nil
}

// currentUserID 从会话里取当前用户 ID。
//
// 下载偏好按用户名存储，取不到会话时返回未登录错误，
// 与旧 handler 的 BadAuth 行为保持一致。
func currentUserID(ctx context.Context) (string, error) {
	c := requireGinContext(ctx)
	user, err := global.SESSION.Get(c)
	if err != nil || user.ID == "" {
		return "", errmap.FromMsgKey("ErrNotLogin", err)
	}
	return user.ID, nil
}
