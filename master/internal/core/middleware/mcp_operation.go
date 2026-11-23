package middleware

import (
	"github.com/gin-gonic/gin"
	"mypanel/core/utils/mcpapi"
)

func MCPLogPolicy(c *gin.Context) bool {
	return mcpapi.IsRequest(c.Request) && c.GetBool("MCP_API_AUTH")
}
