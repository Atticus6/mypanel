// Package errmap 把 1Panel 的业务错误映射为 Connect 错误码。
//
// 1Panel 用 {code, message} 信封表达失败，Connect 用标准 gRPC 状态码。
// 这里集中做一次映射，避免每个 adapter 各写一套，导致前端要兼容多种错误形态。
package errmap

import (
	"errors"
	"strings"

	"connectrpc.com/connect"
	"google.golang.org/genproto/googleapis/rpc/errdetails"

	"mypanel/core/i18n"
)

// MsgKey 是 1Panel 的错误消息键，例如 ErrAuth、ErrNotLogin。
//
// 前端按 Reason 做本地化，message 只作为兜底文案。
func FromMsgKey(msgKey string, cause error) *connect.Error {
	code := codeFor(msgKey)
	message := i18n.GetMsgWithMap(msgKey, map[string]interface{}{"detail": cause})
	if message == "" {
		message = msgKey
	}
	err := connect.NewError(code, errors.New(message))
	// Meta 让非 proto 客户端（curl、日志）也能拿到稳定的错误键。
	err.Meta().Set("panel-error-key", msgKey)
	info := &errdetails.ErrorInfo{
		Reason: msgKey,
		Domain: "panel",
	}
	if detail, detailErr := connect.NewErrorDetail(info); detailErr == nil {
		err.AddDetail(detail)
	}
	return err
}

// FromStatus 按 HTTP 状态码映射 Connect 错误。
//
// 会话中间件写回的是本地化文案而不是错误键（例如「用户未登录: 当前会话已过期！」），
// 这时按状态码映射，避免把整句中文当成 Reason 透给前端。
func FromStatus(code int) *connect.Error {
	switch code {
	case 401:
		return FromMsgKey("ErrNotLogin", nil)
	case 403:
		return FromMsgKey("ErrPermission", nil)
	case 404:
		return FromMsgKey("ErrNotFound", nil)
	case 500:
		return FromMsgKey("ErrInternalServer", nil)
	default:
		return FromMsgKey("ErrInvalidParams", nil)
	}
}

// IsMsgKey 判断字符串是否是稳定的错误键（Err 开头的 ASCII 标识）。
func IsMsgKey(value string) bool {
	if !strings.HasPrefix(value, "Err") || len(value) > 64 {
		return false
	}
	for _, r := range value {
		if (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9') {
			return false
		}
	}
	return true
}

// FromEnvelope 把 1Panel HTTP 信封中的 code/message 转成 Connect 错误。
//
// 仅在复用仍是「写信封」的 handler 时需要；新写的 adapter 应直接返回 FromMsgKey。
func FromEnvelope(code int, msgKey string) *connect.Error {
	if !IsMsgKey(msgKey) {
		return FromStatus(code)
	}
	if msgKey == "" {
		switch {
		case code == 401:
			msgKey = "ErrNotLogin"
		case code == 403:
			msgKey = "ErrPermission"
		case code == 404:
			msgKey = "ErrNotFound"
		case code == 500:
			msgKey = "ErrInternalServer"
		default:
			msgKey = "ErrInvalidParams"
		}
	}
	return FromMsgKey(msgKey, nil)
}

// codeFor 按 1Panel 的错误键选 Connect 状态码。
//
// 默认用 Internal 而不是 Unknown：未列出的错误键说明是服务端没预料到的情况，
// 让前端按 5xx 处理比伪装成参数错误更安全。
func codeFor(msgKey string) connect.Code {
	switch msgKey {
	case "ErrAuth", "ErrLoginLocked", "ErrCaptchaCode", "ErrEntrance", "ErrNotLogin", "ErrMFA":
		return connect.CodeUnauthenticated
	case "ErrPermission", "ErrRBAC", "ErrNotAllowed", "ErrDemoEnvironment":
		return connect.CodePermissionDenied
	case "ErrInvalidParams", "ErrInvalidParam":
		return connect.CodeInvalidArgument
	case "ErrRecordNotFound", "ErrNotFound":
		return connect.CodeNotFound
	case "ErrAlreadyExists", "ErrNameIsExist":
		return connect.CodeAlreadyExists
	case "ErrSessionTimeout":
		return connect.CodeUnauthenticated
	default:
		return connect.CodeInternal
	}
}
