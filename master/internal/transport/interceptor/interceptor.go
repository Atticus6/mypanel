// Package interceptor 提供 master 的 Connect 拦截器集合。
//
// 复用 1Panel 已有的会话与 CSRF 实现，保证迁移期间行为一致：
// 会话仍由 core 的 psession 管理，Cookie 名、续期策略、安全入口都不变。
package interceptor

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"

	"connectrpc.com/connect"
	"github.com/gin-gonic/gin"

	"mypanel/core/global"
	"mypanel/core/middleware"
	"mypanel/master/internal/transport/bridge"
	"mypanel/master/internal/transport/errmap"
	"mypanel/master/internal/transport/policy"
)

// Options 是构造拦截器所需的依赖。
type Options struct {
	// Policies 是按 procedure 索引的方法策略。
	Policies policy.Registry
}

// NewSession 返回负责会话与 CSRF 的一元拦截器。
//
// 顺序是固定要求：「先鉴权再校验参数」，避免未登录请求探测 schema。
// 公开方法（登录、验证码）跳过会话校验，但依然写会话 Cookie。
func NewSession(opts Options) connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
			procedure := req.Spec().Procedure
			method := opts.Policies.Lookup(procedure)

			c, recorder := bridge.New(
				ctx,
				req.Header(),
				req.Peer().Addr,
				http.MethodPost,
				procedure,
			)
			c.Request.Header.Set("Content-Type", "application/json")

			if !method.Public {
				// 复用 core 的会话中间件：它负责读取 Cookie、续期、写入用户。
				middleware.SessionAuth()(c)
				if c.IsAborted() {
					return nil, envelopeError(recorder)
				}
			}

			// 公开方法在登录前不存在 CSRF Token，强制校验只会让登录页永远失败；
			// 公开方法本身不改变服务端状态，跳过校验不会削弱防护。
			if !method.CSRFExempt && !method.Public {
				if err := checkCSRF(c); err != nil {
					return nil, err
				}
			}

			// 把合成 context 传给 adapter，后续业务函数可以直接复用 core 的实现。
			resp, err := next(bridge.WithGinContext(ctx, c), req)
			if resp != nil {
				bridge.CopySetCookies(resp.Header(), recorder)
			}
			return resp, err
		}
	}
}

// checkCSRF 校验 X-CSRF-Token 与 Cookie 是否匹配。
//
// Connect 全部是 POST，不能像 REST 那样按 HTTP 方法判断是否需要 CSRF，
// 所以是否豁免由 proto 注解决定，而不是路径。
func checkCSRF(c *gin.Context) error {
	token := strings.TrimSpace(c.GetHeader("X-CSRF-Token"))
	if global.SESSION == nil {
		return errmap.FromMsgKey("ErrInternalServer", errors.New("session 未初始化"))
	}
	if !global.SESSION.CheckCSRFToken(c, token) {
		return errmap.FromMsgKey("ErrNotLogin", errors.New("CSRF token invalid"))
	}
	return nil
}

// NewRecovery 把 panic 转成 Connect Internal 错误，避免单个请求打挂整个进程。
func NewRecovery() connect.UnaryInterceptorFunc {
	return func(next connect.UnaryFunc) connect.UnaryFunc {
		return func(ctx context.Context, req connect.AnyRequest) (resp connect.AnyResponse, err error) {
			defer func() {
				if recovered := recover(); recovered != nil {
					global.LOG.Errorf("panic in %s: %v", req.Spec().Procedure, recovered)
					err = errmap.FromMsgKey("ErrInternalServer", nil)
					resp = nil
				}
			}()
			return next(ctx, req)
		}
	}
}

// envelope 是 1Panel 旧 handler 的响应信封。
type envelope struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// envelopeError 把被中间件中断的响应转成 Connect 错误。
//
// 会话中间件通过 helper.BadAuth 写信封并 Abort，这里读取信封里的 message，
// 它是稳定的错误键（ErrNotLogin 等），可以直接映射成 Connect 状态码。
func envelopeError(recorder *httptest.ResponseRecorder) *connect.Error {
	if recorder == nil {
		return errmap.FromMsgKey("ErrInternalServer", nil)
	}
	var env envelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &env); err != nil {
		return errmap.FromEnvelope(recorder.Code, "")
	}
	return errmap.FromEnvelope(env.Code, env.Message)
}
