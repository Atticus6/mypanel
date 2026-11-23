package providers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"mypanel/agent/app/dto"
	"mypanel/agent/app/model"
)

type MultiNodeProvider interface {
	IsXpack() bool
	IsUseCustomApp() bool
	GetImagePrefix() string
	RemoveTamper(website string)
	StartClam(startClam *model.Clam, isUpdate bool) (int, error)
	LoadNodeInfo(isBase bool) (model.NodeInfo, error)

	LoadRequestTransport() *http.Transport
	ValidateCertificate(c *gin.Context) bool
	PushSSLToNode(websiteSSL *model.WebsiteSSL) error
	PushPHPExtensionsToNode(req dto.PHPExtensionsPush) error
	GetAgentInfo() (*dto.AgentInfo, error)
}
