package middleware

import (
	"github.com/gin-gonic/gin"
	"mypanel/agent/app/api/v2/helper"
	"mypanel/agent/utils/mcpapi"
)

func MCPErrorMetadata() gin.HandlerFunc {
	return helper.WithErrorMetadata(func(c *gin.Context, _ int, _ string, err error) {
		mcpapi.SetBusinessErrorHeader(c.Request, c.Writer.Header(), err)
	})
}
