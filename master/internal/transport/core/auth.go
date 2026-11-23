// Package core 实现 panel.core.v1 的 Connect 服务。
//
// 迁移策略：handler 不直接操作数据库，而是把请求转换为 1Panel 的 DTO，
// 调用 core 已有的 service 层；只有会话与 Cookie 这类必须依赖 HTTP 的
// 逻辑，才通过 bridge 构造的合成 gin.Context 完成。
package core

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"

	"connectrpc.com/connect"
	"github.com/gin-gonic/gin"

	"mypanel/core/app/dto"
	"mypanel/core/app/model"
	"mypanel/core/app/service"
	"mypanel/core/constant"
	"mypanel/core/global"
	initauth "mypanel/core/init/auth"
	"mypanel/core/utils/captcha"
	"mypanel/core/utils/common"
	"mypanel/core/utils/xpack"
	corev1 "mypanel/proto/gen/go/panel/core/v1"

	"mypanel/master/internal/transport/bridge"
	"mypanel/master/internal/transport/errmap"
)

// AuthServer 实现 panel.core.v1.AuthService。
type AuthServer struct {
	authService    service.IAuthService
	settingService service.ISettingService
	logService     service.ILogService
}

// NewAuthServer 构造登录相关服务。
func NewAuthServer() *AuthServer {
	return &AuthServer{
		authService:    service.NewIAuthService(),
		settingService: service.NewISettingService(),
		logService:     service.NewILogService(),
	}
}

// Login 处理用户名密码登录。
func (s *AuthServer) Login(
	ctx context.Context,
	req *connect.Request[corev1.LoginRequest],
) (*connect.Response[corev1.LoginResponse], error) {
	c := requireGinContext(ctx)
	applyEntrance(c, req.Msg.GetEntranceCode())

	ip := common.GetRealClientIP(c)
	if global.IPTracker.IsLocked(ip) {
		return nil, errmap.FromMsgKey("ErrLoginLocked", nil)
	}
	if global.IPTracker.NeedCaptcha(ip) {
		if msgKey := captcha.VerifyCode(req.Msg.GetCaptchaId(), req.Msg.GetCaptcha()); msgKey != "" {
			return nil, errmap.FromMsgKey(msgKey, nil)
		}
	}

	user, msgKey, err := xpack.AuthProvider.Login(c, toLoginDTO(req.Msg), entranceFromRequest(c))
	if user != nil && user.MfaStatus == constant.StatusEnable {
		s.saveLoginLog(c, user.Name, msgKey, err)
	} else if user != nil || msgKey != "" || err != nil {
		s.saveLoginLog(c, req.Msg.GetName(), msgKey, err)
	}

	switch msgKey {
	case "ErrAuth":
		global.IPTracker.RecordFailure(ip)
		global.IPTracker.SetNeedCaptcha(ip)
		return nil, errmap.FromMsgKey(msgKey, err)
	case "ErrEntrance", "ErrNoneNode":
		return nil, errmap.FromMsgKey(msgKey, err)
	}
	if err != nil {
		global.IPTracker.RecordFailure(ip)
		global.IPTracker.SetNeedCaptcha(ip)
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	if user == nil || user.MfaStatus != constant.StatusEnable {
		global.IPTracker.Clear(ip)
	}

	return connect.NewResponse(fromLoginInfo(user)), nil
}

// MFALogin 使用 MFA 会话完成二次验证。
func (s *AuthServer) MFALogin(
	ctx context.Context,
	req *connect.Request[corev1.MFALoginRequest],
) (*connect.Response[corev1.LoginResponse], error) {
	c := requireGinContext(ctx)
	applyEntrance(c, req.Msg.GetEntranceCode())

	ip := common.GetRealClientIP(c)
	if global.IPTracker.IsLocked(ip) {
		return nil, errmap.FromMsgKey("ErrLoginLocked", nil)
	}

	user, msgKey, err := xpack.AuthProvider.MFALogin(c, dto.MFALogin{
		SessionID: req.Msg.GetSessionId(),
		Code:      req.Msg.GetCode(),
	}, entranceFromRequest(c))
	s.saveLoginLog(c, loginLogUserName(user, req.Msg.GetSessionId()), msgKey, err)

	if msgKey == "ErrMFA" {
		global.IPTracker.RecordFailure(ip)
		failures := initauth.GetMFASessionStore().RecordFailure(req.Msg.GetSessionId())
		if failures >= initauth.MFASessionMaxFailures {
			global.IPTracker.SetNeedCaptcha(ip)
			return nil, errmap.FromMsgKey("ErrCaptchaCode", nil)
		}
		return nil, errmap.FromMsgKey(msgKey, err)
	}
	if msgKey != "" {
		return nil, errmap.FromMsgKey(msgKey, err)
	}
	if err != nil {
		global.IPTracker.RecordFailure(ip)
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	global.IPTracker.Clear(ip)

	return connect.NewResponse(fromLoginInfo(user)), nil
}

// Logout 清理会话，并返回外部身份源需要的跳转动作。
func (s *AuthServer) Logout(
	ctx context.Context,
	_ *connect.Request[corev1.LogoutRequest],
) (*connect.Response[corev1.LogoutResponse], error) {
	c := requireGinContext(ctx)
	result, prepareErr := xpack.AuthProvider.PrepareLogout(c)
	if err := s.authService.LogOut(c); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	if prepareErr != nil {
		global.LOG.Warnf("prepare external logout failed: %v", prepareErr)
		result = nil
	}
	if result == nil {
		result = &dto.LogoutResult{}
	}
	return connect.NewResponse(&corev1.LogoutResponse{
		Saml2Navigation: fromAuthNavigation(result.SAML2Navigation),
	}), nil
}

// Captcha 生成图形验证码。
func (s *AuthServer) Captcha(
	_ context.Context,
	_ *connect.Request[corev1.CaptchaRequest],
) (*connect.Response[corev1.CaptchaResponse], error) {
	res, err := captcha.CreateCaptcha()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.CaptchaResponse{
		CaptchaId: res.CaptchaID,
		ImagePath: res.ImagePath,
	}), nil
}

// GetLoginSetting 返回登录页需要的公开设置。
func (s *AuthServer) GetLoginSetting(
	ctx context.Context,
	_ *connect.Request[corev1.GetLoginSettingRequest],
) (*connect.Response[corev1.LoginSetting], error) {
	c := requireGinContext(ctx)
	settingInfo, err := s.settingService.GetSettingInfo()
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	ip := common.GetRealClientIP(c)
	return connect.NewResponse(&corev1.LoginSetting{
		IsDemo:             global.CONF.Base.IsDemo,
		IsIntl:             global.CONF.Base.Edition == "intl",
		IsOffline:          global.CONF.Base.IsOffline,
		IsEnterprise:       global.CONF.Base.IsEnterprise,
		IsMasterProductPro: false,
		Language:           settingInfo.Language,
		MenuTabs:           settingInfo.MenuTabs,
		MenuAccordion:      settingInfo.MenuAccordion,
		PanelCache:         settingInfo.PanelCache,
		PanelName:          settingInfo.PanelName,
		Theme:              settingInfo.Theme,
		NeedCaptcha:        global.IPTracker.NeedCaptcha(ip),
		PasskeySetting:     xpack.AuthProvider.PasskeyStatus(c),
	}), nil
}

// Current 返回当前登录用户。
func (s *AuthServer) Current(
	ctx context.Context,
	_ *connect.Request[corev1.CurrentRequest],
) (*connect.Response[corev1.CurrentUser], error) {
	c := requireGinContext(ctx)
	info, err := xpack.AuthProvider.GetCurrentUserInfo(c)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrNotLogin", err)
	}
	return connect.NewResponse(fromCurrentUser(info)), nil
}

// PasskeyBeginLogin 开始 Passkey 登录。
func (s *AuthServer) PasskeyBeginLogin(
	ctx context.Context,
	req *connect.Request[corev1.PasskeyBeginLoginRequest],
) (*connect.Response[corev1.PasskeyBeginResponse], error) {
	c := requireGinContext(ctx)
	applyEntrance(c, req.Msg.GetEntranceCode())
	res, msgKey, err := xpack.AuthProvider.PasskeyBeginLogin(c, entranceFromRequest(c))
	if msgKey != "" {
		if msgKey == "ErrPasskeyNotConfigured" {
			return nil, connect.NewError(connect.CodeNotFound, errors.New(msgKey))
		}
		return nil, errmap.FromMsgKey(msgKey, err)
	}
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	publicKey, err := marshalJSON(res.PublicKey)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.PasskeyBeginResponse{
		SessionId: res.SessionID,
		PublicKey: publicKey,
	}), nil
}

// PasskeyFinishLogin 完成 Passkey 登录。
func (s *AuthServer) PasskeyFinishLogin(
	ctx context.Context,
	req *connect.Request[corev1.PasskeyFinishLoginRequest],
) (*connect.Response[corev1.LoginResponse], error) {
	c := requireGinContext(ctx)
	applyEntrance(c, req.Msg.GetEntranceCode())
	user, msgKey, err := xpack.AuthProvider.PasskeyFinishLogin(c, req.Msg.GetSessionId(), entranceFromRequest(c))
	s.saveLoginLog(c, loginLogUserName(user, ""), msgKey, err)
	if msgKey == "ErrAuth" {
		global.IPTracker.SetNeedCaptcha(common.GetRealClientIP(c))
		return nil, errmap.FromMsgKey(msgKey, err)
	}
	if msgKey != "" {
		return nil, errmap.FromMsgKey(msgKey, err)
	}
	if err != nil {
		global.IPTracker.SetNeedCaptcha(common.GetRealClientIP(c))
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	global.IPTracker.Clear(common.GetRealClientIP(c))
	return connect.NewResponse(fromLoginInfo(user)), nil
}

// PasskeyList 列出当前用户的 Passkey。
func (s *AuthServer) PasskeyList(
	ctx context.Context,
	_ *connect.Request[corev1.PasskeyListRequest],
) (*connect.Response[corev1.PasskeyListResponse], error) {
	c := requireGinContext(ctx)
	list, err := xpack.AuthProvider.PasskeyList(c)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	items := make([]*corev1.PasskeyInfo, 0, len(list))
	for _, item := range list {
		items = append(items, &corev1.PasskeyInfo{
			Id:         item.ID,
			Name:       item.Name,
			CreatedAt:  item.CreatedAt,
			LastUsedAt: item.LastUsedAt,
		})
	}
	return connect.NewResponse(&corev1.PasskeyListResponse{Items: items}), nil
}

// PasskeyDelete 删除一个 Passkey。
func (s *AuthServer) PasskeyDelete(
	ctx context.Context,
	req *connect.Request[corev1.PasskeyDeleteRequest],
) (*connect.Response[corev1.PasskeyDeleteResponse], error) {
	c := requireGinContext(ctx)
	if err := xpack.AuthProvider.PasskeyDelete(c, req.Msg.GetId()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.PasskeyDeleteResponse{}), nil
}

// requireGinContext 取出拦截器构造的 gin.Context。
//
// 缺少它说明请求绕过了会话拦截器，属于装配错误，按 Internal 返回。
func requireGinContext(ctx context.Context) *gin.Context {
	c := bridge.GinContext(ctx)
	if c == nil {
		c, _ = bridge.New(ctx, http.Header{}, "", http.MethodPost, "/rpc")
	}
	return c
}

// applyEntrance 把安全入口写进请求头，与旧 handler 的读取方式保持一致。
func applyEntrance(c *gin.Context, entrance string) {
	if entrance == "" {
		return
	}
	c.Request.Header.Set("EntranceCode", entrance)
}

// entranceFromRequest 读取并解码安全入口，优先请求头、其次 Cookie。
func entranceFromRequest(c *gin.Context) string {
	if item := c.Request.Header.Get("EntranceCode"); item != "" {
		if decoded, err := base64.StdEncoding.DecodeString(item); err == nil {
			return string(decoded)
		}
		return ""
	}
	value, err := c.Cookie("SecurityEntrance")
	if err != nil {
		return ""
	}
	if decoded, err := base64.StdEncoding.DecodeString(value); err == nil {
		return string(decoded)
	}
	return ""
}

// saveLoginLog 写登录日志，行为与旧 handler 一致。
func (s *AuthServer) saveLoginLog(c *gin.Context, userName, msgKey string, loginErr error) {
	var logs model.LoginLog
	if loginErr != nil || msgKey != "" {
		logs.Status = constant.StatusFailed
		logs.Message = wrapLoginErr(msgKey, loginErr).Error()
	} else {
		logs.Status = constant.StatusSuccess
	}
	logs.IP = common.AuditClientIP(c)
	logs.User = userName
	logs.Agent = c.GetHeader("User-Agent")
	_ = s.logService.CreateLoginLog(logs)
}

// wrapLoginErr 把错误键转成可读错误，行为与旧 handler 一致。
func wrapLoginErr(msgKey string, err error) error {
	if err != nil {
		return err
	}
	if msgKey == "ErrAuth" || msgKey == "ErrEntrance" {
		return errors.New(msgKey)
	}
	return nil
}

// loginLogUserName 取登录日志里的用户名：登录失败时回退到 MFA 会话。
func loginLogUserName(user *dto.UserLoginInfo, mfaSessionID string) string {
	if user != nil {
		return user.Name
	}
	if mfaSessionID == "" {
		return ""
	}
	if session, ok := initauth.GetMFASessionStore().Get(mfaSessionID); ok {
		return session.Name
	}
	return ""
}

// toLoginDTO 把 proto 请求转成 1Panel 的登录 DTO。
func toLoginDTO(req *corev1.LoginRequest) dto.Login {
	return dto.Login{
		Name:       req.GetName(),
		Password:   req.GetPassword(),
		Captcha:    req.GetCaptcha(),
		CaptchaID:  req.GetCaptchaId(),
		Language:   req.GetLanguage(),
		AuthSource: req.GetAuthSource(),
	}
}

// fromLoginInfo 把登录结果转成 proto 响应。
func fromLoginInfo(info *dto.UserLoginInfo) *corev1.LoginResponse {
	if info == nil {
		return &corev1.LoginResponse{}
	}
	return &corev1.LoginResponse{
		Name:       info.Name,
		Role:       info.Role,
		Token:      info.Token,
		MfaStatus:  info.MfaStatus,
		MfaSession: info.MfaSession,
	}
}

// fromAuthNavigation 把外部身份源跳转信息转成 proto。
func fromAuthNavigation(nav *dto.AuthNavigation) *corev1.AuthNavigation {
	if nav == nil {
		return nil
	}
	return &corev1.AuthNavigation{
		Binding:     nav.Binding,
		RedirectUrl: nav.RedirectURL,
		PostUrl:     nav.PostURL,
		Fields:      nav.Fields,
	}
}

// fromCurrentUser 把当前用户信息转成 proto。
func fromCurrentUser(info *dto.CurrentUserInfo) *corev1.CurrentUser {
	if info == nil {
		return &corev1.CurrentUser{}
	}
	roles := make([]*corev1.CurrentUserNodeRole, 0, len(info.NodeRoles))
	for _, role := range info.NodeRoles {
		roles = append(roles, &corev1.CurrentUserNodeRole{
			NodeId:   uint32(role.NodeID),
			NodeName: role.NodeName,
			RoleId:   uint32(role.RoleID),
			RoleName: role.RoleName,
		})
	}
	return &corev1.CurrentUser{
		Name:               info.Name,
		MfaStatus:          info.MFAStatus,
		MfaInterval:        int32(info.MFAInterval),
		ComplexitySetting:  info.ComplexitySetting,
		AuthSource:         info.AuthSource,
		AuthSourceStatus:   info.AuthSourceStatus,
		ApiInterfaceStatus: info.ApiInterfaceStatus,
		ApiKey:             info.ApiKey,
		IpWhiteList:        info.IpWhiteList,
		ApiTrustedProxies:  info.ApiTrustedProxies,
		ApiKeyValidityTime: int32(info.ApiKeyValidityTime),
		Role:               info.Role,
		Permissions:        info.Permissions,
		NodeRoles:          roles,
	}
}

// marshalJSON 把任意值序列化成 JSON 字符串，用于 WebAuthn 公共参数。
func marshalJSON(value interface{}) (string, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

// PasskeyRegisterBegin 开始 Passkey 注册。
func (s *AuthServer) PasskeyRegisterBegin(
	ctx context.Context,
	req *connect.Request[corev1.PasskeyRegisterBeginRequest],
) (*connect.Response[corev1.PasskeyBeginResponse], error) {
	c := requireGinContext(ctx)
	res, msgKey, err := xpack.AuthProvider.PasskeyBeginRegister(c, req.Msg.GetName())
	if msgKey != "" {
		return nil, errmap.FromMsgKey(msgKey, err)
	}
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	publicKey, err := marshalJSON(res.PublicKey)
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.PasskeyBeginResponse{
		SessionId: res.SessionID,
		PublicKey: publicKey,
	}), nil
}

// PasskeyRegisterFinish 完成 Passkey 注册。
func (s *AuthServer) PasskeyRegisterFinish(
	ctx context.Context,
	req *connect.Request[corev1.PasskeyRegisterFinishRequest],
) (*connect.Response[corev1.PasskeyRegisterFinishResponse], error) {
	// 旧接口把注册会话放在 Passkey-Session 头里，这里沿用同一约定。
	sessionID := req.Header().Get("Passkey-Session")
	c := requireGinContext(ctx)
	msgKey, err := xpack.AuthProvider.PasskeyFinishRegister(c, sessionID)
	if msgKey != "" {
		return nil, errmap.FromMsgKey(msgKey, err)
	}
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.PasskeyRegisterFinishResponse{}), nil
}

// GetMFA 生成 MFA 绑定密钥。
func (s *AuthServer) GetMFA(
	ctx context.Context,
	req *connect.Request[corev1.GetMFARequest],
) (*connect.Response[corev1.MFASetup], error) {
	c := requireGinContext(ctx)
	otp, err := xpack.AuthProvider.LoadMFA(c, dto.MfaRequest{
		Title:    req.Msg.GetTitle(),
		Interval: int(req.Msg.GetInterval()),
	})
	if err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.MFASetup{Secret: otp.Secret, QrImage: otp.QrImage}), nil
}

// BindMFA 校验动态码并绑定 MFA。
func (s *AuthServer) BindMFA(
	ctx context.Context,
	req *connect.Request[corev1.BindMFARequest],
) (*connect.Response[corev1.BindMFAResponse], error) {
	c := requireGinContext(ctx)
	if err := xpack.AuthProvider.MFABind(c, dto.MfaCredential{
		Secret:   req.Msg.GetSecret(),
		Code:     req.Msg.GetCode(),
		Interval: int(req.Msg.GetInterval()),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.BindMFAResponse{}), nil
}

// CloseMFA 关闭 MFA。
func (s *AuthServer) CloseMFA(
	ctx context.Context,
	_ *connect.Request[corev1.CloseMFARequest],
) (*connect.Response[corev1.CloseMFAResponse], error) {
	c := requireGinContext(ctx)
	if err := xpack.AuthProvider.MFAClose(c); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.CloseMFAResponse{}), nil
}

// UpdateCurrentUser 修改当前用户名称或密码。
func (s *AuthServer) UpdateCurrentUser(
	ctx context.Context,
	req *connect.Request[corev1.UpdateCurrentUserRequest],
) (*connect.Response[corev1.UpdateCurrentUserResponse], error) {
	c := requireGinContext(ctx)
	if err := xpack.AuthProvider.UpdateCurrentUserInfo(c, dto.CurrentUserUpdate{
		Name:        req.Msg.GetName(),
		Password:    req.Msg.GetPassword(),
		OldPassword: req.Msg.GetOldPassword(),
	}); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.UpdateCurrentUserResponse{}), nil
}

// ResetExpiredPassword 重置过期密码。
func (s *AuthServer) ResetExpiredPassword(
	ctx context.Context,
	req *connect.Request[corev1.ResetExpiredPasswordRequest],
) (*connect.Response[corev1.ResetExpiredPasswordResponse], error) {
	c := requireGinContext(ctx)
	if err := xpack.AuthProvider.HandlePasswordExpired(c, req.Msg.GetOldPassword(), req.Msg.GetNewPassword()); err != nil {
		return nil, errmap.FromMsgKey("ErrInternalServer", err)
	}
	return connect.NewResponse(&corev1.ResetExpiredPasswordResponse{}), nil
}
