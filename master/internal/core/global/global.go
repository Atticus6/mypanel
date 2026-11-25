package global

import (
	"os"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/nicksnyder/go-i18n/v2/i18n"
	"github.com/robfig/cron/v3"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
	"gorm.io/gorm"
	"mypanel/core/init/auth"
	"mypanel/core/init/session/psession"
)

var (
	DB      *gorm.DB
	AlertDB *gorm.DB
	TaskDB  *gorm.DB
	AgentDB *gorm.DB
	LOG     *logrus.Logger
	CONF    ServerConfig
	VALID   *validator.Validate
	SESSION *psession.PSession
	Viper   *viper.Viper

	I18n       *i18n.Localizer
	I18nForCmd *i18n.Localizer

	Cron *cron.Cron

	ScriptSyncJobID cron.EntryID

	IPTracker *auth.IPTracker
)

type DBOption func(*gorm.DB) *gorm.DB

// 下面的 RepoURL/ResourceURL/AppRepoURL 优先读取 MYPANEL_UPGRADE_REPO_URL 等
// 环境变量作为用户自定义发布源，未配置时回落到原版 1Panel 官方地址。

func RepoURL() string {
	if value := strings.TrimSpace(os.Getenv("MYPANEL_UPGRADE_REPO_URL")); value != "" {
		return strings.TrimRight(value, "/")
	}
	if CONF.Base.IsEnterprise {
		return "https://resource.fit2cloud.com/1panel/package/enterprise"
	}
	if CONF.Base.Edition != "intl" {
		return "https://resource.fit2cloud.com/1panel/package/v2"
	}
	return "https://resource.1panel.pro/v2"
}
func ResourceURL() string {
	if value := strings.TrimSpace(os.Getenv("MYPANEL_UPGRADE_RESOURCE_URL")); value != "" {
		return strings.TrimRight(value, "/")
	}
	if CONF.Base.IsEnterprise {
		return "https://resource.fit2cloud.com/1panel/resource/v2"
	}
	if CONF.Base.Edition != "intl" {
		return "https://resource.fit2cloud.com/1panel/resource/v2"
	}
	return "https://resource.1panel.pro/v2/resource"
}
func AppRepoURL() string {
	if value := strings.TrimSpace(os.Getenv("MYPANEL_UPGRADE_APP_URL")); value != "" {
		return strings.TrimRight(value, "/")
	}
	if CONF.Base.IsEnterprise {
		return "https://apps-assets.fit2cloud.com"
	}
	if CONF.Base.Edition != "intl" {
		return "https://apps-assets.fit2cloud.com"
	}
	return "https://apps.1panel.pro"
}
