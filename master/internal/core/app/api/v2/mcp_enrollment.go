package v2

import (
	"github.com/gin-gonic/gin"
	"mypanel/core/app/api/v2/helper"
	"mypanel/core/app/dto"
	"mypanel/core/app/service"
)

func (b *BaseApi) RevealMCPCredential(c *gin.Context) {
	s, owner, ok := mcpManagement(c, true, false)
	if !ok {
		return
	}
	var req dto.MCPCredentialMutation
	if !mcpRead(c, &req) {
		return
	}
	result, err := s.Reveal(owner, req)
	if err != nil {
		mcpManagementError(c, err)
		return
	}
	helper.SuccessWithData(c, result)
}

func (b *BaseApi) RotateMCPCredential(c *gin.Context) {
	s, owner, ok := mcpManagement(c, true, false)
	if !ok {
		return
	}
	var req dto.MCPCredentialMutation
	if !mcpRead(c, &req) {
		return
	}
	result, err := s.Rotate(owner, req)
	if err != nil {
		mcpManagementError(c, err)
		return
	}
	helper.SuccessWithData(c, result)
}

func (b *BaseApi) ExportMCPCredential(c *gin.Context) {
	s, owner, ok := mcpManagement(c, true, false)
	if !ok {
		return
	}
	var req dto.MCPEnrollmentExport
	if !mcpRead(c, &req) {
		return
	}
	settings, err := service.NewMCPRuntimeService().Settings()
	if err != nil {
		mcpManagementError(c, err)
		return
	}
	endpoint := mcpPublicEndpoint(c, settings.ExternalURL)
	website, err := service.NewMCPRuntimeService().WebsiteStatus(c.Request.Context())
	if err != nil {
		mcpManagementError(c, err)
		return
	}
	if website.State != "unbound" {
		endpoint = website.Endpoint
	}
	result, err := s.ExportMarkdown(owner, req, endpoint, c.GetHeader("Accept-Language"))
	if err != nil {
		mcpManagementError(c, err)
		return
	}
	helper.SuccessWithData(c, result)
}
