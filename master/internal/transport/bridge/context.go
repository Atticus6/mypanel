// Package bridge 在 Connect handler 里复用依赖 gin.Context 的 1Panel 业务代码。
//
// 迁移期不可能把 1Panel 的每个 handler 都重写成接受 context.Context：
// 会话 Cookie、CSRF、i18n 都通过 *gin.Context 传递。这里构造一个「合成」
// gin.Context（真实请求头 + 内存响应写入器），让原有中间件与业务函数
// 继续工作，然后把响应头（尤其是 Set-Cookie）搬运到 Connect 响应上。
//
// 业务侧仍然只看到 Connect 请求；HTTP 信封不会泄漏给前端。
package bridge

import (
	"context"
	"net/http"
	"net/http/httptest"

	"github.com/gin-gonic/gin"
)

// ginContextKey 是 context.Context 中携带 *gin.Context 的键。
type ginContextKey struct{}

// WithGinContext 把合成 gin.Context 放进标准 context，供 adapter 取用。
func WithGinContext(ctx context.Context, c *gin.Context) context.Context {
	return context.WithValue(ctx, ginContextKey{}, c)
}

// GinContext 取出 interceptor 预先构造的 gin.Context。
//
// 未经过鉴权拦截器（例如公开接口）时返回 nil，调用方需要自行构造。
func GinContext(ctx context.Context) *gin.Context {
	c, _ := ctx.Value(ginContextKey{}).(*gin.Context)
	return c
}

// New 构造一个合成 gin.Context。
//
// header 来自 Connect 请求，Cookie、User-Agent、Origin 等都要原样带上，
// 否则依赖它们的中间件与业务函数会得到与真实 HTTP 请求不同的结果。
// remoteAddr 用于 c.ClientIP()，格式为 host:port。
func New(
	ctx context.Context,
	header http.Header,
	remoteAddr, method, path string,
) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	req, err := http.NewRequestWithContext(ctx, method, path, nil)
	if err != nil {
		req, _ = http.NewRequestWithContext(ctx, http.MethodPost, path, nil)
	}
	req.Header = header.Clone()
	if req.Header == nil {
		req.Header = http.Header{}
	}
	req.RemoteAddr = remoteAddr
	req.Host = header.Get("Host")
	c.Request = req
	return c, recorder
}

// Status 返回合成响应写入器的状态码。
func Status(rec *httptest.ResponseRecorder) int {
	if rec == nil || rec.Code == 0 {
		return http.StatusOK
	}
	return rec.Code
}

// CopySetCookies 把合成响应里的 Set-Cookie 搬到目标响应头。
//
// 登录、会话续期、安全入口都会写 Cookie；漏掉这一步的表现是
// 「登录接口返回成功但下一个请求仍未登录」。
func CopySetCookies(dst http.Header, rec *httptest.ResponseRecorder) {
	if dst == nil || rec == nil {
		return
	}
	for _, cookie := range rec.Header().Values("Set-Cookie") {
		dst.Add("Set-Cookie", cookie)
	}
}
