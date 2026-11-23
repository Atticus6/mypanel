package providers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"mypanel/core/utils/ssh"
)

type MultiNodeProvider interface {
	Proxy(c *gin.Context, currentNode string)
	ProxyDocker(proxyURL string) error
	UpdateGroup(name string, group, newGroup uint) error
	CheckBackupUsed(name string) error
	LoadNodeInfo(currentNode string) (*ssh.ConnInfo, string, error)
	Sync(dataType string) error
	AutoUpgradeWithMaster()

	LoadRequestTransport() *http.Transport
}
