package v2

import (
	"github.com/gin-gonic/gin"
	"mypanel/agent/app/api/v2/helper"
)

func (b *BaseApi) TerminalCapabilities(c *gin.Context) {
	helper.SuccessWithData(c, gin.H{"apiKeyLeaseVersion": 1})
}
