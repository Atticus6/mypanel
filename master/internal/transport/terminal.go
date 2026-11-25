package transport

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	agentapi "mypanel/agent/app/api/v2"
	coreglobal "mypanel/core/global"
	coreinitrouter "mypanel/core/init/router"
	psession "mypanel/core/init/session/psession"
	terminalsession "mypanel/core/utils/terminal_session"
)

// MCPHandler 返回 /mcp 的处理器（POST/GET/DELETE）。
func MCPHandler() gin.HandlerFunc {
	return coreinitrouter.MCPTransportHandler()
}

// TerminalWSHandler 返回 /ws/terminal 的 WebSocket 处理器。
//
// 1Panel 原本由 core 反向代理到 agent，并在代理层注入 X-Panel-User-* 头。
// 单进程下没有代理，所以这里先跑 core 的会话中间件，再从会话推导终端身份，
// 写入同样的转发头，最后复用 agent 现有的 PTY 处理逻辑。
func TerminalWSHandler() gin.HandlerFunc {
	api := agentapi.BaseApi{}
	return func(c *gin.Context) {
		// 这里不能用 middleware.SessionAuth：它按 1Panel 的 HTTP 信封返回 200，
		// 而 WebSocket 握手失败必须是真正的 401，客户端才会停止重连。
		if coreglobal.SESSION == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "message": "ErrNotLogin"})
			return
		}
		session, err := coreglobal.SESSION.Get(c)
		if err != nil || session.ID == "" || session.Name == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "message": "ErrNotLogin"})
			return
		}
		c.Set(psession.GinContextSessionUserKey, session)

		identity, ok := terminalsession.FromContext(c)
		if !ok {
			// 未登录或会话失效：不升级 WebSocket，直接返回未认证。
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    http.StatusUnauthorized,
				"message": "ErrNotLogin",
			})
			return
		}
		terminalsession.SetForwardedHeaders(c, identity)

		// kind 优先取查询参数；旧路径 /api/v2/hosts/terminal/{local,ssh,container}
		// 没有 kind 参数，按路径末段推断，保持与原版前端一致。
		kind := c.Query("kind")
		if kind == "" {
			switch {
			case strings.HasSuffix(c.Request.URL.Path, "/ssh"):
				kind = "ssh"
			case strings.HasSuffix(c.Request.URL.Path, "/container"):
				kind = "container"
			}
		}
		switch kind {
		case "ssh":
			api.WsHostSSH(c)
		case "container":
			api.WsContainerTerminal(c)
		default:
			api.WsLocalTerminal(c)
		}
	}
}

// ProcessWSHandler 返回 /api/v2/process/ws 的进程监控 WebSocket 处理器。
//
// 单进程 master 没有 agent 的反向代理，因此这里复用 core 会话鉴权，
// 再交给 agent 原有的 ProcessWs 升级逻辑，避免请求回落到 SPA 返回 HTML。
func ProcessWSHandler() gin.HandlerFunc {
	api := agentapi.BaseApi{}
	return func(c *gin.Context) {
		if coreglobal.SESSION == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "message": "ErrNotLogin"})
			return
		}
		session, err := coreglobal.SESSION.Get(c)
		if err != nil || session.ID == "" || session.Name == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "message": "ErrNotLogin"})
			return
		}
		c.Set(psession.GinContextSessionUserKey, session)
		api.ProcessWs(c)
	}
}

// ContainerLogsHandler 返回容器日志 SSE 处理器。
//
// /containers/search/log 是 SSE 流，不能走 Connect/gRPC；单进程下直接复用 agent
// 已有的流式实现，并在入口处复用 core 会话，避免绕过登录鉴权。
func ContainerLogsHandler() gin.HandlerFunc {
	api := agentapi.BaseApi{}
	return func(c *gin.Context) {
		if coreglobal.SESSION == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "message": "ErrNotLogin"})
			return
		}
		session, err := coreglobal.SESSION.Get(c)
		if err != nil || session.ID == "" || session.Name == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": http.StatusUnauthorized, "message": "ErrNotLogin"})
			return
		}
		c.Set(psession.GinContextSessionUserKey, session)
		api.ContainerStreamLogs(c)
	}
}
