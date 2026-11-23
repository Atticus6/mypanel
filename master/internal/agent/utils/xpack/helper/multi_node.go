package helper

import (
	"crypto/tls"
	"net"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"mypanel/agent/app/dto"
	"mypanel/agent/app/model"
	"mypanel/agent/buserr"
	"mypanel/agent/global"
	"mypanel/agent/utils/xpack/providers"
)

type multiNodeHelper struct{}

func NewIMultiNodeProvider() providers.MultiNodeProvider {
	return &multiNodeHelper{}
}

func (m *multiNodeHelper) RemoveTamper(website string) {}

func (m *multiNodeHelper) StartClam(startClam *model.Clam, isUpdate bool) (int, error) {
	return 0, buserr.New("ErrXpackNotFound")
}

func (m *multiNodeHelper) LoadNodeInfo(isBase bool) (model.NodeInfo, error) {
	// 单进程模式下安装目录与版本由 master 注入，不再读取 /usr/local/bin/1pctl。
	var info model.NodeInfo
	info.BaseDir = global.CONF.Base.InstallDir
	info.Version = global.CONF.Base.Version
	info.Scope = "master"
	global.IsMaster = true
	return info, nil
}

func (m *multiNodeHelper) GetImagePrefix() string {
	return ""
}

func (m *multiNodeHelper) IsUseCustomApp() bool {
	return false
}

func (m *multiNodeHelper) IsXpack() bool {
	return false
}

func (m *multiNodeHelper) LoadRequestTransport() *http.Transport {
	return &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		DialContext: (&net.Dialer{
			Timeout:   60 * time.Second,
			KeepAlive: 60 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
		IdleConnTimeout:       15 * time.Second,
	}
}

func (m *multiNodeHelper) ValidateCertificate(c *gin.Context) bool {
	return true
}

func (m *multiNodeHelper) PushSSLToNode(websiteSSL *model.WebsiteSSL) error {
	return nil
}

func (m *multiNodeHelper) GetAgentInfo() (*dto.AgentInfo, error) {
	return nil, nil
}

func (m *multiNodeHelper) PushPHPExtensionsToNode(req dto.PHPExtensionsPush) error {
	return buserr.New("ErrXpackNotFound")
}
