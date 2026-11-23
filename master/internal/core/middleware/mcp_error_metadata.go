package middleware

import (
	"github.com/gin-gonic/gin"
	"mypanel/core/app/api/v2/helper"
	mcpmeta "mypanel/core/utils/mcpapi/metadata"
)

func MCPErrorMetadata() gin.HandlerFunc {
	return helper.WithErrorMetadata(func(c *gin.Context, _ int, messageKey string, _ error) {
		if messageKey == "ErrProxy" && c.GetBool("MCP_API_AUTH") && c.Request != nil && mcpmeta.TrustedRequest(c.Request) {
			c.Header(mcpmeta.BusinessCodeHeader, "ErrProxy")
		}
	})
}
