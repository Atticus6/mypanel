// Package transport 把生成的 Connect 服务注册到 master 的 HTTP server。
//
// 每个服务都在这里登记一次：文件名、方法名、拦截器全部显式列出，
// 避免「注册了 handler 但忘了挂载」这类只能在运行时才发现的问题。
package transport

import (
	"net/http"

	"connectrpc.com/connect"
	"connectrpc.com/validate"
	"google.golang.org/protobuf/reflect/protoreflect"

	agentv1 "mypanel/proto/gen/go/panel/agent/v1"
	"mypanel/proto/gen/go/panel/agent/v1/agentv1connect"
	corev1 "mypanel/proto/gen/go/panel/core/v1"
	"mypanel/proto/gen/go/panel/core/v1/corev1connect"

	"mypanel/master/internal/server"
	agenttransport "mypanel/master/internal/transport/agent"
	coretransport "mypanel/master/internal/transport/core"
	"mypanel/master/internal/transport/interceptor"
	"mypanel/master/internal/transport/policy"
)

// Services 返回当前已实现的所有 Connect 服务。
//
// 新增服务时：生成 proto → 实现 server → 在这里追加一项。
// 策略由 proto 注解自动读取，不需要在这里手写鉴权规则。
func Services() []server.RPCService {
	policies := policy.Registry{}
	for _, descriptor := range ServiceDescriptors() {
		policies = policies.Merge(policy.ForService(descriptor))
	}

	handlerOpts := []connect.HandlerOption{
		connect.WithInterceptors(
			// panic 必须最先兜住，否则后续拦截器里的异常会打挂进程。
			interceptor.NewRecovery(),
			// 会话与 CSRF 复用 core 的实现，Cookie 名与续期策略保持不变。
			interceptor.NewSession(interceptor.Options{Policies: policies}),
			// Protovalidate：proto 是唯一校验规则来源。
			validate.NewInterceptor(),
		),
	}

	authPath, authHandler := corev1connect.NewAuthServiceHandler(coretransport.NewAuthServer(), handlerOpts...)
	settingPath, settingHandler := corev1connect.NewSettingServiceHandler(coretransport.NewSettingServer(), handlerOpts...)
	diagnosticsPath, diagnosticsHandler := corev1connect.NewDiagnosticsServiceHandler(coretransport.NewDiagnosticsServer(), handlerOpts...)
	coreLogPath, coreLogHandler := corev1connect.NewLogServiceHandler(coretransport.NewLogServer(), handlerOpts...)
	coreScriptPath, coreScriptHandler := corev1connect.NewScriptServiceHandler(coretransport.NewScriptServer(), handlerOpts...)
	commandPath, commandHandler := corev1connect.NewCommandServiceHandler(coretransport.NewCommandServer(), handlerOpts...)
	groupPath, groupHandler := corev1connect.NewGroupServiceHandler(coretransport.NewGroupServer(), handlerOpts...)
	backupAccountPath, backupAccountHandler := corev1connect.NewBackupsServiceHandler(coretransport.NewBackupServer(), handlerOpts...)
	websitePath, websiteHandler := agentv1connect.NewWebsiteServiceHandler(agenttransport.NewWebsiteServer(), handlerOpts...)
	hostPath, hostHandler := agentv1connect.NewHostServiceHandler(agenttransport.NewHostServer(), handlerOpts...)
	dashboardPath, dashboardHandler := agentv1connect.NewDashboardServiceHandler(agenttransport.NewDashboardServer(), handlerOpts...)
	filePath, fileHandler := agentv1connect.NewFileServiceHandler(agenttransport.NewFileServer(), handlerOpts...)
	cronjobPath, cronjobHandler := agentv1connect.NewCronjobServiceHandler(agenttransport.NewCronjobServer(), handlerOpts...)
	containerPath, containerHandler := agentv1connect.NewContainerServiceHandler(agenttransport.NewContainerServer(), handlerOpts...)
	databasePath, databaseHandler := agentv1connect.NewDatabaseServiceHandler(agenttransport.NewDatabaseServer(), handlerOpts...)
	alertPath, alertHandler := agentv1connect.NewAlertServiceHandler(agenttransport.NewAlertServer(), handlerOpts...)
	appPath, appHandler := agentv1connect.NewAppServiceHandler(agenttransport.NewAppServer(), handlerOpts...)
	backupPath, backupHandler := agentv1connect.NewBackupServiceHandler(agenttransport.NewBackupServer(), handlerOpts...)
	sslPath, sslHandler := agentv1connect.NewWebsiteSSLServiceHandler(agenttransport.NewWebsiteSSLServer(), handlerOpts...)
	firewallPath, firewallHandler := agentv1connect.NewFirewallServiceHandler(agenttransport.NewFirewallServer(), handlerOpts...)
	taskPath, taskHandler := agentv1connect.NewTaskServiceHandler(agenttransport.NewTaskServer(), handlerOpts...)
	logPath, logHandler := agentv1connect.NewLogServiceHandler(agenttransport.NewLogServer(), handlerOpts...)
	transferPath, transferHandler := agentv1connect.NewFileTransferServiceHandler(agenttransport.NewFileTransferServer(), handlerOpts...)
	agentSettingPath, agentSettingHandler := agentv1connect.NewAgentSettingServiceHandler(agenttransport.NewAgentSettingServer(), handlerOpts...)
	snapshotPath, snapshotHandler := agentv1connect.NewSnapshotServiceHandler(agenttransport.NewSnapshotServer(), handlerOpts...)
	terminalPath, terminalHandler := agentv1connect.NewTerminalServiceHandler(agenttransport.NewTerminalServer(), handlerOpts...)
	sshPath, sshHandler := agentv1connect.NewSSHServiceHandler(agenttransport.NewSSHServer(), handlerOpts...)
	monitorPath, monitorHandler := agentv1connect.NewMonitorServiceHandler(agenttransport.NewMonitorServer(), handlerOpts...)

	return []server.RPCService{
		{
			Name:    corev1connect.AuthServiceName,
			Path:    authPath,
			Handler: authHandler,
		},
		{
			Name:    corev1connect.SettingServiceName,
			Path:    settingPath,
			Handler: settingHandler,
		},
		{
			Name:    agentv1connect.WebsiteServiceName,
			Path:    websitePath,
			Handler: websiteHandler,
		},
		{
			Name:    agentv1connect.HostServiceName,
			Path:    hostPath,
			Handler: hostHandler,
		},
		{
			Name:    agentv1connect.DashboardServiceName,
			Path:    dashboardPath,
			Handler: dashboardHandler,
		},
		{
			Name:    agentv1connect.FileServiceName,
			Path:    filePath,
			Handler: fileHandler,
		},
		{
			Name:    agentv1connect.CronjobServiceName,
			Path:    cronjobPath,
			Handler: cronjobHandler,
		},
		{
			Name:    agentv1connect.ContainerServiceName,
			Path:    containerPath,
			Handler: containerHandler,
		},
		{
			Name:    agentv1connect.DatabaseServiceName,
			Path:    databasePath,
			Handler: databaseHandler,
		},
		{
			Name:    agentv1connect.AlertServiceName,
			Path:    alertPath,
			Handler: alertHandler,
		},
		{
			Name:    agentv1connect.AppServiceName,
			Path:    appPath,
			Handler: appHandler,
		},
		{
			Name:    agentv1connect.BackupServiceName,
			Path:    backupPath,
			Handler: backupHandler,
		},
		{
			Name:    agentv1connect.WebsiteSSLServiceName,
			Path:    sslPath,
			Handler: sslHandler,
		},
		{
			Name:    agentv1connect.FirewallServiceName,
			Path:    firewallPath,
			Handler: firewallHandler,
		},
		{
			Name:    agentv1connect.TaskServiceName,
			Path:    taskPath,
			Handler: taskHandler,
		},
		{
			Name:    agentv1connect.LogServiceName,
			Path:    logPath,
			Handler: logHandler,
		},
		{
			Name:    agentv1connect.AgentSettingServiceName,
			Path:    agentSettingPath,
			Handler: agentSettingHandler,
		},
		{
			Name:    corev1connect.LogServiceName,
			Path:    coreLogPath,
			Handler: coreLogHandler,
		},
		{
			Name:    corev1connect.BackupsServiceName,
			Path:    backupAccountPath,
			Handler: backupAccountHandler,
		},
		{
			Name:    corev1connect.CommandServiceName,
			Path:    commandPath,
			Handler: commandHandler,
		},
		{
			Name:    corev1connect.GroupServiceName,
			Path:    groupPath,
			Handler: groupHandler,
		},
		{
			Name:    corev1connect.ScriptServiceName,
			Path:    coreScriptPath,
			Handler: coreScriptHandler,
		},
		{
			Name:    corev1connect.DiagnosticsServiceName,
			Path:    diagnosticsPath,
			Handler: diagnosticsHandler,
		},
		{
			Name:    agentv1connect.MonitorServiceName,
			Path:    monitorPath,
			Handler: monitorHandler,
		},
		{
			Name:    agentv1connect.SSHServiceName,
			Path:    sshPath,
			Handler: sshHandler,
		},
		{
			Name:    agentv1connect.TerminalServiceName,
			Path:    terminalPath,
			Handler: terminalHandler,
		},
		{
			Name:    agentv1connect.SnapshotServiceName,
			Path:    snapshotPath,
			Handler: snapshotHandler,
		},
		{
			Name:    agentv1connect.FileTransferServiceName,
			Path:    transferPath,
			Handler: transferHandler,
		},
	}
}

// FileHandlers 返回大文件上传/下载的 HTTP 处理器。
//
// 它们与 FileTransferService 共用同一个票据存储；server 层只负责挂载。
func FileHandlers() (http.Handler, http.Handler) {
	return agenttransport.FileHandlers()
}

// ServiceDescriptors 返回注册表里用到的 proto 服务描述符。
//
// 拦截器按这份清单读取方法策略；新增服务时只改这里和上面的 handler 注册。
func ServiceDescriptors() []protoreflect.ServiceDescriptor {
	descriptors := make([]protoreflect.ServiceDescriptor, 0, 16)
	if auth := corev1.File_panel_core_v1_auth_proto.Services().ByName("AuthService"); auth != nil {
		descriptors = append(descriptors, auth)
	}
	if setting := corev1.File_panel_core_v1_setting_proto.Services().ByName("SettingService"); setting != nil {
		descriptors = append(descriptors, setting)
	}
	if diagnostics := corev1.File_panel_core_v1_diagnostics_proto.Services().ByName("DiagnosticsService"); diagnostics != nil {
		descriptors = append(descriptors, diagnostics)
	}
	if logs := corev1.File_panel_core_v1_log_proto.Services().ByName("LogService"); logs != nil {
		descriptors = append(descriptors, logs)
	}
	if script := corev1.File_panel_core_v1_script_proto.Services().ByName("ScriptService"); script != nil {
		descriptors = append(descriptors, script)
	}
	if command := corev1.File_panel_core_v1_command_proto.Services().ByName("CommandService"); command != nil {
		descriptors = append(descriptors, command)
	}
	if group := corev1.File_panel_core_v1_group_proto.Services().ByName("GroupService"); group != nil {
		descriptors = append(descriptors, group)
	}
	if backup := corev1.File_panel_core_v1_backup_proto.Services().ByName("BackupsService"); backup != nil {
		descriptors = append(descriptors, backup)
	}
	for _, file := range []protoreflect.FileDescriptor{
		agentv1.File_panel_agent_v1_website_proto,
		agentv1.File_panel_agent_v1_host_proto,
		agentv1.File_panel_agent_v1_dashboard_proto,
		agentv1.File_panel_agent_v1_file_proto,
		agentv1.File_panel_agent_v1_cronjob_proto,
		agentv1.File_panel_agent_v1_container_proto,
		agentv1.File_panel_agent_v1_database_proto,
		agentv1.File_panel_agent_v1_alert_proto,
		agentv1.File_panel_agent_v1_app_proto,
		agentv1.File_panel_agent_v1_backup_proto,
		agentv1.File_panel_agent_v1_website_ssl_proto,
		agentv1.File_panel_agent_v1_firewall_proto,
		agentv1.File_panel_agent_v1_task_proto,
		agentv1.File_panel_agent_v1_log_proto,
		agentv1.File_panel_agent_v1_file_transfer_proto,
		agentv1.File_panel_agent_v1_setting_proto,
		agentv1.File_panel_agent_v1_snapshot_proto,
		agentv1.File_panel_agent_v1_terminal_proto,
		agentv1.File_panel_agent_v1_ssh_proto,
		agentv1.File_panel_agent_v1_monitor_proto,
	} {
		for i := 0; i < file.Services().Len(); i++ {
			descriptors = append(descriptors, file.Services().Get(i))
		}
	}
	return descriptors
}
