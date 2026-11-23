package v2

import (
	"net"
	"net/http"

	"github.com/gin-gonic/gin"
	"mypanel/agent/constant"
	"mypanel/agent/global"
	"mypanel/agent/utils/taskscope"
)

func PanelMCPTaskAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		if hasPanelMCPTaskAccess(c.Request) {
			c.Request = c.Request.WithContext(taskscope.WithGrants(c.Request.Context(), constant.TaskScopePanelMCP))
		}
		c.Next()
	}
}

func hasPanelMCPTaskAccess(req *http.Request) bool {
	if !global.IsMaster {
		return false
	}
	local, ok := req.Context().Value(http.LocalAddrContextKey).(net.Addr)
	values := req.Header.Values("X-Panel-MCP-Task-Access")
	return ok && local.Network() == "unix" && len(values) == 1 && values[0] == "1"
}
