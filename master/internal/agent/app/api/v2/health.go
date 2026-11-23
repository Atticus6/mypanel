package v2

import (
	"github.com/gin-gonic/gin"
	"mypanel/agent/app/api/v2/helper"
)

// @Tags Health
// @Summary Check health
// @Success 200
// @Security ApiKeyAuth
// @Security Timestamp
// @Router /health/check [get]
func (b *BaseApi) CheckHealth(c *gin.Context) {
	helper.Success(c)
}
