package router

import (
	"github.com/gin-gonic/gin"
	v2 "mypanel/agent/app/api/v2"
	"mypanel/agent/app/service"
	"mypanel/agent/global"
	"mypanel/agent/i18n"
	"mypanel/agent/middleware"
	rou "mypanel/agent/router"
)

var (
	Router *gin.Engine
)

func Routers() *gin.Engine {
	if err := service.ConfigurePanelMCPTasks(); err != nil {
		panic(err)
	}
	Router = gin.Default()
	Router.Use(i18n.UseI18n())
	Router.Use(middleware.MCPErrorMetadata())
	registerMCPRuntime(Router)

	PrivateGroup := Router.Group("/api/v2")
	if !global.IsMaster {
		PrivateGroup.Use(middleware.Certificate())
	}
	PrivateGroup.Use(middleware.OperationResolveMeta())
	PrivateGroup.Use(v2.PanelMCPTaskAccess())
	PrivateGroup.Use(v2.MCPBusinessDispatch())
	for _, router := range rou.RouterGroupApp {
		router.InitRouter(PrivateGroup)
	}
	PrivateGroup.GET("/health/check", v2.ApiGroupApp.BaseApi.CheckHealth)

	return Router
}
