package v2

import "mypanel/agent/app/service"

type ApiGroup struct {
	BaseApi
}

var ApiGroupApp = new(ApiGroup)

type BaseApi struct{}

var (
	gpuGroupService  = &service.GPUGroupService{}
	dashboardService = service.NewIDashboardService()

	appService              = service.NewIAppService()
	appInstallService       = service.NewIAppInstalledService()
	appIgnoreUpgradeService = service.NewIAppIgnoreUpgradeService()

	mcpServerService = service.NewIMcpServerService()

	containerService       = service.NewIContainerService()
	composeTemplateService = service.NewIComposeTemplateService()
	imageRepoService       = service.NewIImageRepoService()
	imageService           = service.NewIImageService()
	dockerService          = service.NewIDockerService()

	dbCommonService = service.NewIDBCommonService()
	mongodbService  = service.NewIMongodbService()
	databaseService = service.NewIDatabaseService()

	cronjobService = service.NewICronjobService()

	fileService               = service.NewIFileService()
	fileHistoryService        = service.NewIFileHistoryService()
	fileShareService          = service.NewIFileShareService()
	sshService                = service.NewISSHService()
	firewallService           = service.NewIFirewallService()
	firewallSettingService    = service.NewIFirewallSettingService()
	forwardingService         = service.NewIForwardingService()
	dockerPortGuardService    = service.NewIDockerPortGuardService()
	monitorService            = service.NewIMonitorService()
	systemService             = service.NewISystemService()
	runtimeDiagnosticsService = service.NewIRuntimeDiagnosticsService()

	settingService      = service.NewISettingService()
	backupService       = service.NewIBackupService()
	backupRecordService = service.NewIBackupRecordService()

	websiteService            = service.NewIWebsiteService()
	websiteDnsAccountService  = service.NewIWebsiteDnsAccountService()
	websiteSSLService         = service.NewIWebsiteSSLService()
	websiteAcmeAccountService = service.NewIWebsiteAcmeAccountService()

	nginxService = service.NewINginxService()

	logService      = service.NewILogService()
	snapshotService = service.NewISnapshotService()

	processService       = service.NewIProcessService()
	phpExtensionsService = service.NewIPHPExtensionsService()

	hostToolService = service.NewIHostToolService()

	recycleBinService = service.NewIRecycleBinService()
	favoriteService   = service.NewIFavoriteService()
	hostService       = service.NewIHostService()

	websiteCAService = service.NewIWebsiteCAService()
	taskService      = service.NewITaskService()
	groupService     = service.NewIGroupService()
	alertService     = service.NewIAlertService()

	diskService = service.NewIDiskService()
)
