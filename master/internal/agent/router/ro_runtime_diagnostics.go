package router

import (
	"github.com/gin-gonic/gin"
	v2 "mypanel/agent/app/api/v2"
)

type RuntimeDiagnosticsRouter struct{}

func (s *RuntimeDiagnosticsRouter) InitRouter(Router *gin.RouterGroup) {
	diagnosticsRouter := Router.Group("hosts/diagnostics")
	baseApi := v2.ApiGroupApp.BaseApi
	{
		diagnosticsRouter.GET("/summary", baseApi.LoadRuntimeDiagnosticsSummary)
		diagnosticsRouter.GET("/goroutines", baseApi.LoadRuntimeGoroutines)
		diagnosticsRouter.POST("/profiles", baseApi.CreateRuntimeProfile)
	}
}
