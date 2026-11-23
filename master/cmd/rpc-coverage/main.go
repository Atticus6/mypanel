// Command rpc-coverage 用 proto/manifest.yaml 对比 1Panel REST 路由与已实现的 RPC。
//
// manifest 是唯一事实来源：每条路由要么显式映射到 service.Method，
// 要么位于已剔除模块的前缀里，要么尚未迁移（不出现在 manifest 中）。
// 启发式只用于 -update-manifest 生成初稿，运行时不再猜测。
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

// pathParamPattern 匹配 Gin 风格与 OpenAPI 风格的路径参数占位符。
var pathParamPattern = regexp.MustCompile(`[{:]([A-Za-z0-9_]+)}?`)

// route 是一条基线 REST 路由。
type route struct {
	Method   string `json:"method"`
	Path     string `json:"path"`
	Target   string `json:"target,omitempty"`
	Service  string `json:"service,omitempty"`
	RPC      string `json:"rpc,omitempty"`
	Excluded bool   `json:"excluded,omitempty"`
	Covered  bool   `json:"covered"`
}

// snapshot 是提交入库的覆盖率基线快照。
type snapshot struct {
	GeneratedFrom string  `json:"generatedFrom"`
	Routes        []route `json:"routes"`
}

// manifest 是人工确认过的路由到 RPC 映射。
type manifest struct {
	Version          int               `yaml:"version"`
	ExcludedPrefixes []excludedPrefix  `yaml:"excluded_prefixes"`
	Routes           map[string]string `yaml:"routes"`
}

// excludedPrefix 描述一个不迁移的路径前缀。
type excludedPrefix struct {
	Prefix string `yaml:"prefix"`
	// Exact 为真时按完整路径匹配，用于剔除同一个前缀下仍有子路由需要迁移的情况，
	// 例如 /files/upload 被剔除，但 /files/upload/search 要迁移。
	Exact  bool   `yaml:"exact,omitempty"`
	Reason string `yaml:"reason"`
}

// overrides 修正启发式容易误判的路径。
var overrides = map[string]string{
	"POST /core/settings/search":                        "panel.core.v1.SettingService.GetInfo",
	"POST /core/settings/search/base":                   "panel.core.v1.SettingService.GetBaseInfo",
	"POST /core/settings/terminal/search":               "panel.core.v1.SettingService.GetTerminal",
	"POST /core/settings/terminal/update":               "panel.core.v1.SettingService.UpdateTerminal",
	"POST /core/settings/update":                        "panel.core.v1.SettingService.UpdateSetting",
	"GET /core/settings/interface":                      "panel.core.v1.SettingService.GetInterface",
	"GET /core/settings/memo":                           "panel.core.v1.SettingService.GetMemo",
	"POST /core/settings/memo":                          "panel.core.v1.SettingService.UpdateMemo",
	"GET /core/settings/file/download":                  "panel.core.v1.SettingService.GetFileDownloadPreference",
	"POST /core/settings/file/download":                 "panel.core.v1.SettingService.UpdateFileDownloadPreference",
	"POST /core/settings/port/update":                   "panel.core.v1.SettingService.UpdatePort",
	"POST /core/settings/bind/update":                   "panel.core.v1.SettingService.UpdateBindInfo",
	"GET /core/settings/search/available":               "panel.core.v1.SettingService.GetSystemAvailable",
	"POST /core/logs/login":                             "panel.core.v1.LogService.SearchLoginLogs",
	"POST /core/logs/operation":                         "panel.core.v1.LogService.SearchOperationLogs",
	"POST /core/logs/clean":                             "panel.core.v1.LogService.CleanLogs",
	"POST /core/script":                                 "panel.core.v1.ScriptService.Create",
	"POST /core/script/search":                          "panel.core.v1.ScriptService.Search",
	"POST /core/script/update":                          "panel.core.v1.ScriptService.Update",
	"POST /core/script/del":                             "panel.core.v1.ScriptService.Delete",
	"POST /core/script/sync":                            "panel.core.v1.ScriptService.Sync",
	"POST /core/commands":                               "panel.core.v1.CommandService.Create",
	"POST /core/commands/search":                        "panel.core.v1.CommandService.Search",
	"POST /core/commands/list":                          "panel.core.v1.CommandService.List",
	"POST /core/commands/tree":                          "panel.core.v1.CommandService.Tree",
	"POST /core/commands/update":                        "panel.core.v1.CommandService.Update",
	"POST /core/commands/del":                           "panel.core.v1.CommandService.Delete",
	"POST /core/commands/import":                        "panel.core.v1.CommandService.Import",
	"POST /core/commands/export":                        "panel.core.v1.CommandService.Export",
	"POST /core/groups":                                 "panel.core.v1.GroupService.Create",
	"POST /core/groups/search":                          "panel.core.v1.GroupService.List",
	"POST /core/groups/update":                          "panel.core.v1.GroupService.Update",
	"POST /core/groups/del":                             "panel.core.v1.GroupService.Delete",
	"POST /core/backups":                                "panel.core.v1.BackupsService.Create",
	"POST /core/backups/update":                         "panel.core.v1.BackupsService.Update",
	"POST /core/backups/del":                            "panel.core.v1.BackupsService.Delete",
	"POST /core/backups/refresh/token":                  "panel.core.v1.BackupsService.RefreshToken",
	"GET /core/backups/client/:clientType":              "panel.core.v1.BackupsService.GetClientInfo",
	"POST /core/auth/api/generate":                      "panel.core.v1.AuthService.GenerateAPIKey",
	"POST /core/auth/api/update":                        "panel.core.v1.AuthService.UpdateAPIConfig",
	"GET /core/auth/captcha":                            "panel.core.v1.AuthService.Captcha",
	"POST /core/auth/login":                             "panel.core.v1.AuthService.Login",
	"POST /core/auth/mfalogin":                          "panel.core.v1.AuthService.MFALogin",
	"POST /core/auth/logout":                            "panel.core.v1.AuthService.Logout",
	"GET /core/auth/setting":                            "panel.core.v1.AuthService.GetLoginSetting",
	"GET /core/auth/current":                            "panel.core.v1.AuthService.Current",
	"POST /core/auth/current/update":                    "panel.core.v1.AuthService.UpdateCurrentUser",
	"POST /core/auth/expired/reset":                     "panel.core.v1.AuthService.ResetExpiredPassword",
	"POST /core/auth/mfa":                               "panel.core.v1.AuthService.GetMFA",
	"POST /core/auth/mfa/bind":                          "panel.core.v1.AuthService.BindMFA",
	"POST /core/auth/mfa/close":                         "panel.core.v1.AuthService.CloseMFA",
	"POST /core/auth/passkey/begin":                     "panel.core.v1.AuthService.PasskeyBeginLogin",
	"POST /core/auth/passkey/finish":                    "panel.core.v1.AuthService.PasskeyFinishLogin",
	"POST /core/auth/passkey/register/begin":            "panel.core.v1.AuthService.PasskeyRegisterBegin",
	"POST /core/auth/passkey/register/finish":           "panel.core.v1.AuthService.PasskeyRegisterFinish",
	"GET /core/auth/passkey/list":                       "panel.core.v1.AuthService.PasskeyList",
	"POST /core/auth/passkey/del":                       "panel.core.v1.AuthService.PasskeyDelete",
	"GET /core/settings/ssl/info":                       "panel.core.v1.SettingService.GetSSLInfo",
	"POST /core/settings/ssl/update":                    "panel.core.v1.SettingService.UpdateSSL",
	"POST /core/settings/ssl/reload":                    "panel.core.v1.SettingService.ReloadSSL",
	"GET /core/settings/ssl/download":                   "panel.core.v1.SettingService.DownloadSSL",
	"POST /core/settings/ssl/download":                  "panel.core.v1.SettingService.DownloadSSL",
	"GET /core/settings/upgrade":                        "panel.core.v1.SettingService.GetUpgradeInfo",
	"POST /core/settings/upgrade":                       "panel.core.v1.SettingService.Upgrade",
	"POST /core/settings/upgrade/notes":                 "panel.core.v1.SettingService.GetUpgradeNotes",
	"GET /core/settings/upgrade/releases":               "panel.core.v1.SettingService.ListReleases",
	"GET /core/settings/apps/store/config":              "panel.core.v1.SettingService.GetAppStoreConfig",
	"POST /core/settings/apps/store/update":             "panel.core.v1.SettingService.UpdateAppStoreConfig",
	"POST /core/settings/menu/update":                   "panel.core.v1.SettingService.UpdateMenu",
	"POST /core/settings/menu/default":                  "panel.core.v1.SettingService.DefaultMenu",
	"POST /core/settings/proxy/update":                  "panel.core.v1.SettingService.UpdateProxy",
	"POST /settings/search":                             "panel.agent.v1.AgentSettingService.GetInfo",
	"POST /settings/update":                             "panel.agent.v1.AgentSettingService.UpdateSetting",
	"GET /settings/basedir":                             "panel.agent.v1.AgentSettingService.GetBaseDir",
	"GET /settings/website/dir":                         "panel.agent.v1.AgentSettingService.GetWebsiteDir",
	"POST /settings/terminal/ai/search":                 "panel.agent.v1.AgentSettingService.GetTerminalAI",
	"POST /settings/terminal/ai/update":                 "panel.agent.v1.AgentSettingService.UpdateTerminalAI",
	"POST /settings/files/ai/search":                    "panel.agent.v1.AgentSettingService.GetFileAI",
	"POST /settings/files/ai/update":                    "panel.agent.v1.AgentSettingService.UpdateFileAI",
	"POST /settings/file-history/search":                "panel.agent.v1.AgentSettingService.GetFileHistory",
	"POST /settings/file-history/update":                "panel.agent.v1.AgentSettingService.UpdateFileHistory",
	"POST /settings/description/save":                   "panel.agent.v1.AgentSettingService.SaveDescription",
	"GET /settings/search/available":                    "panel.agent.v1.AgentSettingService.GetSystemAvailable",
	"GET /settings/snapshot/load":                       "panel.agent.v1.SnapshotService.LoadData",
	"POST /settings/snapshot":                           "panel.agent.v1.SnapshotService.Create",
	"POST /settings/snapshot/recreate":                  "panel.agent.v1.SnapshotService.Recreate",
	"POST /settings/snapshot/import":                    "panel.agent.v1.SnapshotService.Import",
	"POST /settings/snapshot/description/update":        "panel.agent.v1.SnapshotService.UpdateDescription",
	"POST /settings/snapshot/del":                       "panel.agent.v1.SnapshotService.Delete",
	"POST /settings/snapshot/recover":                   "panel.agent.v1.SnapshotService.Recover",
	"POST /settings/snapshot/rollback":                  "panel.agent.v1.SnapshotService.Rollback",
	"POST /settings/snapshot/search":                    "panel.agent.v1.SnapshotService.Search",
	"POST /hosts":                                       "panel.agent.v1.HostService.Create",
	"POST /hosts/del":                                   "panel.agent.v1.HostService.DeleteHosts",
	"POST /hosts/update":                                "panel.agent.v1.HostService.UpdateHost",
	"POST /hosts/update/group":                          "panel.agent.v1.HostService.UpdateHostGroup",
	"POST /hosts/test/byinfo":                           "panel.agent.v1.HostService.TestByInfo",
	"POST /hosts/test/byid":                             "panel.agent.v1.HostService.TestByID",
	"GET /hosts/components/:name":                       "panel.agent.v1.HostService.CheckComponent",
	"GET /hosts/disks":                                  "panel.agent.v1.HostService.GetDisks",
	"POST /hosts/disks/partition":                       "panel.agent.v1.HostService.PartitionDisk",
	"POST /hosts/disks/mount":                           "panel.agent.v1.HostService.MountDisk",
	"POST /hosts/disks/unmount":                         "panel.agent.v1.HostService.UnmountDisk",
	"GET /hosts/diagnostics/summary":                    "panel.agent.v1.HostService.GetDiagnosticsSummary",
	"GET /hosts/diagnostics/goroutines":                 "panel.agent.v1.HostService.GetDiagnosticsGoroutines",
	"POST /hosts/diagnostics/profiles":                  "panel.agent.v1.HostService.CreateDiagnosticsProfile",
	"POST /hosts/terminal/sessions/search":              "panel.agent.v1.TerminalService.ListSessions",
	"POST /hosts/terminal/sessions/close":               "panel.agent.v1.TerminalService.CloseSession",
	"POST /hosts/terminal/sessions/closeAll":            "panel.agent.v1.TerminalService.CloseAllSessions",
	"GET /core/hosts/diagnostics/summary":               "panel.core.v1.DiagnosticsService.Summary",
	"GET /core/hosts/diagnostics/goroutines":            "panel.core.v1.DiagnosticsService.Goroutines",
	"POST /core/hosts/diagnostics/profiles":             "panel.core.v1.DiagnosticsService.CreateProfile",
	"POST /hosts/firewall/operate":                      "panel.agent.v1.FirewallService.Operate",
	"POST /hosts/firewall/forward/base":                 "panel.agent.v1.FirewallService.GetForwardBase",
	"POST /hosts/firewall/forward/search":               "panel.agent.v1.FirewallService.SearchForwardRules",
	"POST /hosts/firewall/forward/operate":              "panel.agent.v1.FirewallService.OperateForwardRules",
	"POST /hosts/firewall/forward/enable":               "panel.agent.v1.FirewallService.EnableForwarding",
	"POST /hosts/firewall/filter/operate":               "panel.agent.v1.FirewallService.OperateFilterChain",
	"POST /hosts/firewall/rules/reset":                  "panel.agent.v1.FirewallService.ResetRules",
	"POST /hosts/firewall/rules/native/detail":          "panel.agent.v1.FirewallService.GetNativeDetail",
	"POST /hosts/firewall/rules":                        "panel.agent.v1.FirewallService.CreateRules",
	"POST /hosts/firewall/rules/delete":                 "panel.agent.v1.FirewallService.DeleteRules",
	"POST /hosts/firewall/rules/update":                 "panel.agent.v1.FirewallService.UpdateRule",
	"POST /hosts/firewall/rules/reorder":                "panel.agent.v1.FirewallService.ReorderRule",
	"GET /hosts/firewall/settings":                      "panel.agent.v1.FirewallService.GetSettings",
	"POST /hosts/firewall/settings/whitelist":           "panel.agent.v1.FirewallService.CreateWhitelist",
	"POST /hosts/firewall/settings/whitelist/update":    "panel.agent.v1.FirewallService.UpdateWhitelist",
	"POST /hosts/firewall/settings/whitelist/delete":    "panel.agent.v1.FirewallService.DeleteWhitelist",
	"POST /hosts/firewall/settings/operate":             "panel.agent.v1.FirewallService.OperateBackend",
	"POST /hosts/firewall/settings/ipv6":                "panel.agent.v1.FirewallService.OperateIPv6",
	"POST /hosts/firewall/family/operate":               "panel.agent.v1.FirewallService.OperateFamily",
	"GET /hosts/firewall/docker/ports":                  "panel.agent.v1.FirewallService.ListDockerPorts",
	"GET /hosts/firewall/docker/endpoints":              "panel.agent.v1.FirewallService.ListDockerEndpoints",
	"POST /hosts/firewall/docker/operate":               "panel.agent.v1.FirewallService.OperateDocker",
	"POST /hosts/firewall/docker/policies/batch":        "panel.agent.v1.FirewallService.UpsertDockerPolicies",
	"POST /hosts/firewall/docker/policies/delete/batch": "panel.agent.v1.FirewallService.DeleteDockerPolicies",
	"GET /hosts/firewall/rules/backups":                 "panel.agent.v1.FirewallService.ListRuleBackups",
	"POST /hosts/ssh/search":                            "panel.agent.v1.SSHService.GetInfo",
	"POST /hosts/ssh/operate":                           "panel.agent.v1.SSHService.Operate",
	"POST /hosts/ssh/update":                            "panel.agent.v1.SSHService.Update",
	"POST /hosts/ssh/file":                              "panel.agent.v1.SSHService.LoadFile",
	"POST /hosts/ssh/file/update":                       "panel.agent.v1.SSHService.UpdateFile",
	"POST /hosts/ssh/cert":                              "panel.agent.v1.SSHService.CreateCert",
	"POST /hosts/ssh/cert/update":                       "panel.agent.v1.SSHService.UpdateCert",
	"POST /hosts/ssh/cert/sync":                         "panel.agent.v1.SSHService.SyncCerts",
	"POST /hosts/ssh/cert/search":                       "panel.agent.v1.SSHService.SearchCerts",
	"POST /hosts/ssh/cert/delete":                       "panel.agent.v1.SSHService.DeleteCerts",
	"POST /hosts/ssh/log":                               "panel.agent.v1.SSHService.SearchLogs",
	"POST /hosts/ssh/log/export":                        "panel.agent.v1.SSHService.ExportLogs",
	"POST /hosts/ssh/log/clean":                         "panel.agent.v1.SSHService.CleanLogs",
	"GET /settings/ssh/conn":                            "panel.agent.v1.AgentSettingService.GetLocalConn",
	"POST /settings/ssh/check":                          "panel.agent.v1.AgentSettingService.TestLocalConn",
	"POST /settings/ssh/check/info":                     "panel.agent.v1.AgentSettingService.TestConnByInfo",
	"POST /settings/ssh":                                "panel.agent.v1.AgentSettingService.SaveLocalConn",
	"POST /settings/ssh/default":                        "panel.agent.v1.AgentSettingService.SetDefaultConn",
	"POST /hosts/monitor/search":                        "panel.agent.v1.MonitorService.Search",
	"GET /hosts/monitor/setting":                        "panel.agent.v1.MonitorService.GetSetting",
	"POST /hosts/monitor/setting/update":                "panel.agent.v1.MonitorService.UpdateSetting",
	"POST /hosts/monitor/clean":                         "panel.agent.v1.MonitorService.Clean",
	"GET /hosts/monitor/iooptions":                      "panel.agent.v1.MonitorService.ListIOOptions",
	"GET /hosts/monitor/netoptions":                     "panel.agent.v1.MonitorService.ListNetworkOptions",
	"POST /containers/search":                           "panel.agent.v1.ContainerService.Search",
	"POST /containers/inspect":                          "panel.agent.v1.ContainerService.Inspect",
	"GET /containers/limit":                             "panel.agent.v1.ContainerService.GetLimit",
	"POST /containers/operate":                          "panel.agent.v1.ContainerService.OperateContainers",
	"POST /containers/rename":                           "panel.agent.v1.ContainerService.RenameContainer",
	"POST /containers/prune":                            "panel.agent.v1.ContainerService.Prune",
	"POST /containers/clean/log":                        "panel.agent.v1.ContainerService.CleanLogs",
	"GET /containers/network":                           "panel.agent.v1.ContainerService.ListNetworks",
	"POST /containers/network":                          "panel.agent.v1.ContainerService.CreateNetwork",
	"POST /containers/network/del":                      "panel.agent.v1.ContainerService.DeleteNetworks",
	"GET /containers/volume":                            "panel.agent.v1.ContainerService.ListVolumes",
	"POST /containers/volume":                           "panel.agent.v1.ContainerService.CreateVolume",
	"POST /containers/volume/del":                       "panel.agent.v1.ContainerService.DeleteVolumes",
	"POST /containers/image/remove":                     "panel.agent.v1.ContainerService.RemoveImages",
	"POST /containers/image/tag":                        "panel.agent.v1.ContainerService.TagImage",
	"POST /containers/compose/env":                      "panel.agent.v1.ContainerService.GetComposeEnv",
	"POST /containers/compose/test":                     "panel.agent.v1.ContainerService.TestCompose",
	"POST /containers/compose/operate":                  "panel.agent.v1.ContainerService.OperateCompose",
	"POST /containers/compose/pin":                      "panel.agent.v1.ContainerService.PinCompose",
	"POST /containers/compose/clean/log":                "panel.agent.v1.ContainerService.CleanComposeLogs",
	"GET /containers/template":                          "panel.agent.v1.ContainerService.ListTemplates",
	"POST /containers/template":                         "panel.agent.v1.ContainerService.CreateTemplate",
	"POST /containers/template/update":                  "panel.agent.v1.ContainerService.UpdateTemplate",
	"POST /containers/template/del":                     "panel.agent.v1.ContainerService.DeleteTemplates",
	"POST /containers/template/batch":                   "panel.agent.v1.ContainerService.BatchTemplates",
	"GET /containers/repo":                              "panel.agent.v1.ContainerService.ListRepos",
	"POST /containers/repo":                             "panel.agent.v1.ContainerService.CreateRepo",
	"POST /containers/repo/update":                      "panel.agent.v1.ContainerService.UpdateRepo",
	"POST /containers/repo/del":                         "panel.agent.v1.ContainerService.DeleteRepo",
	"POST /containers/repo/status":                      "panel.agent.v1.ContainerService.CheckRepoStatus",
	"GET /containers/docker/status":                     "panel.agent.v1.ContainerService.GetDockerStatus",
	"POST /containers/docker/operate":                   "panel.agent.v1.ContainerService.OperateDocker",
	"POST /containers/image/pull":                       "panel.agent.v1.ContainerService.PullImages",
	"POST /containers/image/push":                       "panel.agent.v1.ContainerService.PushImage",
	"POST /containers/image/build":                      "panel.agent.v1.ContainerService.BuildImage",
	"POST /containers/image/remote/search":              "panel.agent.v1.ContainerService.SearchRemoteImages",
	"GET /containers/daemonjson":                        "panel.agent.v1.ContainerService.GetDaemonJson",
	"POST /containers/daemonjson/update":                "panel.agent.v1.ContainerService.UpdateDaemonJson",
	"POST /containers/daemonjson/update/byfile":         "panel.agent.v1.ContainerService.UpdateDaemonJsonByFile",
	"POST /containers/logoption/update":                 "panel.agent.v1.ContainerService.UpdateLogOption",
	"POST /containers/ipv6option/update":                "panel.agent.v1.ContainerService.UpdateIpv6Option",
	"POST /containers/list":                             "panel.agent.v1.ContainerService.ListContainers",
	"POST /containers/list/byimage":                     "panel.agent.v1.ContainerService.ListContainersByImage",
	"POST /containers/users":                            "panel.agent.v1.ContainerService.GetContainerUsers",
	"GET /containers/list/stats":                        "panel.agent.v1.ContainerService.GetContainerStats",
	"POST /containers/item/stats":                       "panel.agent.v1.ContainerService.GetContainerItemStats",
	"GET /containers/stats/:id":                         "panel.agent.v1.ContainerService.SampleContainerStats",
	"POST /containers/image/search":                     "panel.agent.v1.ContainerService.SearchImages",
	"POST /containers/network/search":                   "panel.agent.v1.ContainerService.SearchNetworks",
	"POST /containers/volume/search":                    "panel.agent.v1.ContainerService.SearchVolumes",
	"POST /containers/repo/search":                      "panel.agent.v1.ContainerService.SearchImageRepos",
	"POST /containers/template/search":                  "panel.agent.v1.ContainerService.SearchComposeTemplates",
	"POST /apps/installed/update/versions":              "panel.agent.v1.AppService.UpdateVersions",
	"POST /apps/installed/check":                        "panel.agent.v1.AppService.CheckInstalled",
	"POST /apps/install":                                "panel.agent.v1.AppService.Install",
	"POST /apps/installed/op":                           "panel.agent.v1.AppService.Operate",
	"GET /containers/status":                            "panel.agent.v1.ContainerService.Status",
	"POST /containers/compose/search":                   "panel.agent.v1.ContainerService.SearchCompose",
	"POST /hosts/search":                                "panel.agent.v1.HostService.Search",
	"POST /hosts/info":                                  "panel.agent.v1.HostService.Get",
	"POST /hosts/tree":                                  "panel.agent.v1.HostService.Tree",
	"POST /hosts/firewall/base":                         "panel.agent.v1.FirewallService.BaseInfo",
	"POST /hosts/firewall/rules/search":                 "panel.agent.v1.FirewallService.Inventory",
	"POST /logs/tasks/search":                           "panel.agent.v1.TaskService.Search",
	"GET /logs/tasks/executing/count":                   "panel.agent.v1.TaskService.CountExecuting",
	"GET /logs/system/files":                            "panel.agent.v1.LogService.ListSystemFiles",
	"GET /logs/system/services":                         "panel.agent.v1.LogService.ListRunningServices",
	"GET /logs/system/status":                           "panel.agent.v1.LogService.SystemStatus",
	"POST /alert/search":                                "panel.agent.v1.AlertService.Page",
	"POST /backups/search":                              "panel.agent.v1.BackupService.Search",
	"GET /dashboard/base/os":                            "panel.agent.v1.DashboardService.GetOsInfo",
	"GET /dashboard/quick/option":                       "panel.agent.v1.DashboardService.QuickJumps",
	"GET /dashboard/base/:ioOption/:netOption":          "panel.agent.v1.DashboardService.BaseInfo",
	"GET /dashboard/current/:ioOption/:netOption":       "panel.agent.v1.DashboardService.CurrentInfo",
	"POST /apps/search":                                 "panel.agent.v1.AppService.SearchApps",
	"GET /apps/:key":                                    "panel.agent.v1.AppService.GetApp",
	"POST /apps/installed/search":                       "panel.agent.v1.AppService.SearchInstalled",
	"POST /cronjobs/search":                             "panel.agent.v1.CronjobService.Search",
	"POST /cronjobs/load/info":                          "panel.agent.v1.CronjobService.Get",
	"POST /cronjobs/search/records":                     "panel.agent.v1.CronjobService.SearchRecords",
	"POST /cronjobs/records/log":                        "panel.agent.v1.CronjobService.LoadRecordLog",
	"POST /websites/search":                             "panel.agent.v1.WebsiteService.Search",
	"POST /websites":                                    "panel.agent.v1.WebsiteService.Create",
	"POST /websites/del":                                "panel.agent.v1.WebsiteService.Delete",
	"POST /websites/proxy/config":                       "panel.agent.v1.WebsiteService.UpdateProxyCache",
	"GET /websites/:id":                                 "panel.agent.v1.WebsiteService.GetWebsite",
	"GET /websites/list":                                "panel.agent.v1.WebsiteService.List",
	"POST /websites/options":                            "panel.agent.v1.WebsiteService.Options",
	"POST /websites/operate":                            "panel.agent.v1.WebsiteService.OperateWebsite",
	"POST /websites/update":                             "panel.agent.v1.WebsiteService.UpdateWebsite",
	"POST /websites/check":                              "panel.agent.v1.WebsiteService.Check",
	"POST /websites/group/change":                       "panel.agent.v1.WebsiteService.ChangeGroup",
	"POST /websites/batch/group":                        "panel.agent.v1.WebsiteService.BatchGroup",
	"POST /websites/batch/operate":                      "panel.agent.v1.WebsiteService.BatchOperate",
	"POST /websites/php/version":                        "panel.agent.v1.WebsiteService.ChangePHPVersion",
	"POST /websites/crosssite":                          "panel.agent.v1.WebsiteService.OperateCrossSite",
	"GET /websites/cors/:id":                            "panel.agent.v1.WebsiteService.GetCors",
	"POST /websites/cors/update":                        "panel.agent.v1.WebsiteService.UpdateCors",
	"POST /websites/dir":                                "panel.agent.v1.WebsiteService.GetSiteDir",
	"POST /websites/dir/update":                         "panel.agent.v1.WebsiteService.UpdateSiteDir",
	"POST /websites/dir/permission":                     "panel.agent.v1.WebsiteService.UpdateSitePermission",
	"GET /websites/rewrite/custom":                      "panel.agent.v1.WebsiteService.ListCustomRewrite",
	"POST /websites/rewrite/custom":                     "panel.agent.v1.WebsiteService.OperateCustomRewrite",
	"POST /websites/proxies/file":                       "panel.agent.v1.WebsiteService.UpdateProxyFile",
	"POST /websites/proxies/delete":                     "panel.agent.v1.WebsiteService.DeleteProxy",
	"POST /websites/proxies/status":                     "panel.agent.v1.WebsiteService.UpdateProxyStatus",
	"POST /websites/proxy/clear":                        "panel.agent.v1.WebsiteService.ClearProxyCache",
	"POST /websites/auths":                              "panel.agent.v1.WebsiteService.GetAuth",
	"POST /websites/auths/update":                       "panel.agent.v1.WebsiteService.UpdateAuth",
	"POST /websites/auths/path":                         "panel.agent.v1.WebsiteService.GetPathAuth",
	"POST /websites/auths/path/update":                  "panel.agent.v1.WebsiteService.UpdatePathAuth",
	"POST /websites/redirect/file":                      "panel.agent.v1.WebsiteService.UpdateRedirectFile",
	"POST /websites/stream/update":                      "panel.agent.v1.WebsiteService.UpdateStream",
	"GET /websites/resource/:id":                        "panel.agent.v1.WebsiteService.GetResource",
	"POST /websites/domains":                            "panel.agent.v1.WebsiteService.CreateDomains",
	"POST /websites/domains/del":                        "panel.agent.v1.WebsiteService.DeleteDomain",
	"POST /websites/domains/update":                     "panel.agent.v1.WebsiteService.UpdateDomain",
	"POST /websites/dns":                                "panel.agent.v1.WebsiteService.CreateDNSAccount",
	"POST /websites/dns/update":                         "panel.agent.v1.WebsiteService.UpdateDNSAccount",
	"POST /websites/dns/del":                            "panel.agent.v1.WebsiteService.DeleteDNSAccount",
	"GET /websites/databases":                           "panel.agent.v1.WebsiteService.ListDatabases",
	"POST /websites/databases":                          "panel.agent.v1.WebsiteService.ChangeDatabase",
	"POST /websites/lbs/file":                           "panel.agent.v1.WebsiteService.UpdateLoadBalanceFile",
	"POST /websites/log/operate":                        "panel.agent.v1.WebsiteService.OperateLog",
	"POST /websites/proxies/update":                     "panel.agent.v1.WebsiteService.UpdateProxy",
	"GET /websites/ssl/:id":                             "panel.agent.v1.WebsiteSSLService.GetByID",
	"GET /websites/ssl/website/:websiteId":              "panel.agent.v1.WebsiteSSLService.GetByWebsite",
	"POST /websites/ssl":                                "panel.agent.v1.WebsiteSSLService.Create",
	"POST /websites/ssl/list":                           "panel.agent.v1.WebsiteSSLService.List",
	"POST /websites/ssl/update":                         "panel.agent.v1.WebsiteSSLService.Update",
	"POST /websites/ssl/obtain":                         "panel.agent.v1.WebsiteSSLService.Apply",
	"POST /websites/ssl/resolve":                        "panel.agent.v1.WebsiteSSLService.GetDNSResolve",
	"POST /websites/ssl/del":                            "panel.agent.v1.WebsiteSSLService.Delete",
	"POST /websites/ssl/push":                           "panel.agent.v1.WebsiteSSLService.Push",
	"POST /websites/ca/search":                          "panel.agent.v1.WebsiteSSLService.SearchCA",
	"GET /websites/ca/:id":                              "panel.agent.v1.WebsiteSSLService.GetCA",
	"POST /websites/ca":                                 "panel.agent.v1.WebsiteSSLService.CreateCA",
	"POST /websites/ca/del":                             "panel.agent.v1.WebsiteSSLService.DeleteCA",
	"POST /websites/ca/renew":                           "panel.agent.v1.WebsiteSSLService.RenewCA",
	"POST /websites/acme":                               "panel.agent.v1.WebsiteSSLService.CreateACME",
	"POST /websites/acme/search":                        "panel.agent.v1.WebsiteSSLService.SearchACMEAccounts",
	"POST /websites/acme/update":                        "panel.agent.v1.WebsiteSSLService.UpdateACME",
	"POST /websites/acme/del":                           "panel.agent.v1.WebsiteSSLService.DeleteACME",
	"GET /websites/proxy/config/{id}":                   "panel.agent.v1.WebsiteService.GetProxyCache",
	"POST /websites/config":                             "panel.agent.v1.WebsiteService.GetNginxScopeConfig",
	"POST /websites/config/update":                      "panel.agent.v1.WebsiteService.UpdateNginxScopeConfig",
	"POST /websites/ssl/search":                         "panel.agent.v1.WebsiteSSLService.Search",
	"POST /websites/dns/search":                         "panel.agent.v1.WebsiteSSLService.SearchDNSAccounts",
	"GET /websites/domains/:websiteId":                  "panel.agent.v1.WebsiteService.ListDomains",
	"POST /files/search":                                "panel.agent.v1.FileService.ListFiles",
	"POST /files/mode":                                  "panel.agent.v1.FileService.ChangeMode",
	"POST /files/compress":                              "panel.agent.v1.FileService.Compress",
	"POST /websites/log/search":                         "panel.agent.v1.WebsiteService.GetLog",
	"GET /websites/:id/config/:type":                    "panel.agent.v1.WebsiteService.GetNginxFile",
	"POST /websites/nginx/update":                       "panel.agent.v1.WebsiteService.UpdateNginxFile",
	"POST /websites/default/server":                     "panel.agent.v1.WebsiteService.ChangeDefault",
	"POST /websites/rewrite":                            "panel.agent.v1.WebsiteService.GetRewrite",
	"POST /websites/rewrite/update":                     "panel.agent.v1.WebsiteService.UpdateRewrite",
	"POST /websites/redirect":                           "panel.agent.v1.WebsiteService.GetRedirect",
	"POST /websites/redirect/update":                    "panel.agent.v1.WebsiteService.UpdateRedirect",
	"GET /websites/:id/lbs":                             "panel.agent.v1.WebsiteService.GetLoadBalances",
	"POST /websites/lbs/create":                         "panel.agent.v1.WebsiteService.CreateLoadBalance",
	"POST /websites/lbs/update":                         "panel.agent.v1.WebsiteService.UpdateLoadBalance",
	"POST /websites/lbs/del":                            "panel.agent.v1.WebsiteService.DeleteLoadBalance",
	"GET /websites/realip/config/:id":                   "panel.agent.v1.WebsiteService.GetRealIP",
	"POST /websites/realip/config":                      "panel.agent.v1.WebsiteService.UpdateRealIP",
	"GET /websites/default/html/:type":                  "panel.agent.v1.WebsiteService.GetDefaultHtml",
	"POST /websites/default/html/update":                "panel.agent.v1.WebsiteService.UpdateDefaultHtml",
	"GET /websites/:id/https":                           "panel.agent.v1.WebsiteService.GetHTTPS",
	"POST /websites/:id/https":                          "panel.agent.v1.WebsiteService.UpdateHTTPS",
	"POST /websites/proxies":                            "panel.agent.v1.WebsiteService.GetProxies",
	"POST /websites/leech":                              "panel.agent.v1.WebsiteService.GetAntiLeech",
	"POST /websites/leech/update":                       "panel.agent.v1.WebsiteService.UpdateAntiLeech",
	"POST /files/del":                                   "panel.agent.v1.FileService.Delete",
	"POST /files/recycle/search":                        "panel.agent.v1.FileService.SearchRecycle",
	"POST /files/recycle/reduce":                        "panel.agent.v1.FileService.RestoreRecycle",
	"POST /files/favorite/search":                       "panel.agent.v1.FileService.SearchFavorites",
	"POST /files/favorite":                              "panel.agent.v1.FileService.AddFavorite",
	"POST /files/favorite/del":                          "panel.agent.v1.FileService.DeleteFavorite",
	"POST /files/history/search":                        "panel.agent.v1.FileService.SearchHistory",
	"POST /files/rename":                                "panel.agent.v1.FileService.ChangeName",
	"POST /files/decompress":                            "panel.agent.v1.FileService.DeCompress",
	"POST /files/content":                               "panel.agent.v1.FileService.GetFile",
	"GET /apps/checkupdate":                             "panel.agent.v1.AppService.GetAppUpdate",
	"GET /apps/detail/:appId/:version/:type":            "panel.agent.v1.AppService.GetAppDetail",
	"GET /apps/detail/node/:appKey/:version":            "panel.agent.v1.AppService.GetAppDetailByKey",
	"GET /apps/details/:id":                             "panel.agent.v1.AppService.GetAppDetailByID",
	"GET /apps/ignored/detail":                          "panel.agent.v1.AppService.ListIgnoredApps",
	"POST /apps/ignored/cancel":                         "panel.agent.v1.AppService.CancelIgnoreAppUpgrade",
	"POST /apps/installed/conf":                         "panel.agent.v1.AppService.GetDefaultConfig",
	"POST /apps/installed/config/update":                "panel.agent.v1.AppService.UpdateInstalledConfig",
	"POST /apps/installed/conninfo":                     "panel.agent.v1.AppService.LoadAppConnInfo",
	"GET /apps/installed/delete/check/:appInstallId":    "panel.agent.v1.AppService.CheckDeleteInstalled",
	"POST /apps/installed/ignore":                       "panel.agent.v1.AppService.IgnoreAppUpgrade",
	"GET /apps/installed/info/:appInstallId":            "panel.agent.v1.AppService.GetInstalledInfo",
	"GET /apps/installed/list":                          "panel.agent.v1.AppService.ListInstalled",
	"POST /apps/installed/loadport":                     "panel.agent.v1.AppService.LoadAppPort",
	"GET /apps/installed/params/:appInstallId":          "panel.agent.v1.AppService.GetInstalledParams",
	"POST /apps/installed/params/update":                "panel.agent.v1.AppService.UpdateInstalled",
	"POST /apps/installed/port/change":                  "panel.agent.v1.AppService.ChangeAppPort",
	"POST /apps/installed/sort/update":                  "panel.agent.v1.AppService.UpdateInstalledSort",
	"POST /apps/installed/sync":                         "panel.agent.v1.AppService.SyncInstalled",
	"GET /apps/services/:key":                           "panel.agent.v1.AppService.GetAppServices",
	"POST /apps/sync/local":                             "panel.agent.v1.AppService.SyncAppsFromLocal",
	"POST /apps/sync/remote":                            "panel.agent.v1.AppService.SyncAppsFromRemote",
	"GET /apps/tags":                                    "panel.agent.v1.AppService.GetAppTags",
	"POST /files":                                       "panel.agent.v1.FileService.CreateFile",
	"POST /files/batch/check":                           "panel.agent.v1.FileService.BatchCheckFiles",
	"POST /files/batch/del":                             "panel.agent.v1.FileService.BatchDeleteFiles",
	"POST /files/batch/role":                            "panel.agent.v1.FileService.BatchChangeRole",
	"POST /files/check":                                 "panel.agent.v1.FileService.CheckFile",
	"POST /files/compress/stop":                         "panel.agent.v1.FileService.StopCompress",
	"POST /files/convert":                               "panel.agent.v1.FileService.ConvertFiles",
	"POST /files/convert/log":                           "panel.agent.v1.FileService.SearchConvertLogs",
	"POST /files/decompress/stop":                       "panel.agent.v1.FileService.StopDecompress",
	"POST /files/depth/size":                            "panel.agent.v1.FileService.GetDepthSize",
	"POST /files/history/content":                       "panel.agent.v1.FileService.GetHistoryContent",
	"POST /files/history/del":                           "panel.agent.v1.FileService.DeleteHistory",
	"POST /files/history/restore":                       "panel.agent.v1.FileService.RestoreHistory",
	"POST /files/mount":                                 "panel.agent.v1.FileService.ListMounts",
	"POST /files/move":                                  "panel.agent.v1.FileService.MoveFiles",
	"POST /files/move/stop":                             "panel.agent.v1.FileService.StopMove",
	"POST /files/owner":                                 "panel.agent.v1.FileService.ChangeOwner",
	"POST /files/preview":                               "panel.agent.v1.FileService.PreviewFile",
	"POST /files/read/:type":                            "panel.agent.v1.FileService.ReadFileLines",
	"POST /files/recycle/clear":                         "panel.agent.v1.FileService.ClearRecycle",
	"GET /files/recycle/status":                         "panel.agent.v1.FileService.GetRecycleStatus",
	"POST /files/remark":                                "panel.agent.v1.FileService.SetRemark",
	"POST /files/remarks":                               "panel.agent.v1.FileService.GetRemarks",
	"POST /files/save":                                  "panel.agent.v1.FileService.SaveFile",
	"GET /files/share/check":                            "panel.agent.v1.FileService.CheckShare",
	"POST /files/share/create":                          "panel.agent.v1.FileService.CreateShare",
	"POST /files/share/del":                             "panel.agent.v1.FileService.DeleteShare",
	"POST /files/share/detail":                          "panel.agent.v1.FileService.GetShare",
	"GET /files/share/info":                             "panel.agent.v1.FileService.GetPublicShare",
	"POST /files/share/search":                          "panel.agent.v1.FileService.SearchShares",
	"POST /files/size":                                  "panel.agent.v1.FileService.GetSize",
	"POST /files/tree":                                  "panel.agent.v1.FileService.GetFileTree",
	"POST /files/upload/search":                         "panel.agent.v1.FileService.SearchUpload",
	"POST /files/user/group":                            "panel.agent.v1.FileService.GetUsersAndGroups",
	"POST /files/wget":                                  "panel.agent.v1.FileService.Wget",
	"POST /files/wget/stop":                             "panel.agent.v1.FileService.StopWget",
	"GET /files/wget/process/keys":                      "panel.agent.v1.FileService.GetWgetProcessKeys",
	"POST /files/wget/process/remove":                   "panel.agent.v1.FileService.RemoveWgetRecords",
}

// fallbackExclusions 在 manifest 不存在时使用，与 manifest 的首版内容一致。
var fallbackExclusions = []excludedPrefix{
	{Prefix: "/ai", Reason: "AI 模块已剔除"},
	{Prefix: "/vms", Reason: "VM 模块已剔除"},
	{Prefix: "/toolbox", Reason: "Toolbox 模块已剔除"},
	{Prefix: "/runtimes", Reason: "网站运行时已剔除"},
	{Prefix: "/websites/runtimes", Reason: "网站运行时已剔除"},
	{Prefix: "/websites/templates", Reason: "网站模板已剔除"},
	{Prefix: "/settings/license", Reason: "License 已剔除"},
	{Prefix: "/enterprise", Reason: "企业版功能已剔除"},
}

func main() {
	baseline := flag.String("baseline", "../1Panel", "1Panel 源码目录")
	protoDir := flag.String("proto", "../proto", "proto 目录")
	manifestPath := flag.String("manifest", "../proto/manifest.yaml", "路由映射 manifest")
	snapshotPath := flag.String("snapshot", "../proto/route-coverage.json", "覆盖率快照路径")
	updateManifest := flag.Bool("update-manifest", false, "根据基线重新生成 manifest")
	updateSnapshot := flag.Bool("update", false, "重新生成覆盖率快照")
	flag.Parse()

	services, err := parseProtoServices(*protoDir)
	if err != nil {
		fail("解析 proto 失败: %v", err)
	}

	routes, err := collectRoutes(*baseline)
	if err != nil {
		fail("解析基线路由失败: %v", err)
	}
	if len(routes) == 0 {
		fail("没有从 %s 解析到任何 @Router 注解", *baseline)
	}

	if *updateManifest {
		m := buildManifest(routes, *manifestPath)
		if err := writeManifest(*manifestPath, m); err != nil {
			fail("写入 manifest 失败: %v", err)
		}
		fmt.Printf("已生成 manifest: %s（%d 条映射）\n", *manifestPath, len(m.Routes))
	}

	m, err := loadManifest(*manifestPath)
	if err != nil {
		fail("读取 manifest 失败（首次请运行 -update-manifest）: %v", err)
	}
	applyManifest(routes, m, services)

	if *updateSnapshot {
		snap := snapshot{GeneratedFrom: *baseline, Routes: routes}
		data, err := json.MarshalIndent(snap, "", "  ")
		if err != nil {
			fail("序列化快照失败: %v", err)
		}
		if err := os.WriteFile(*snapshotPath, append(data, '\n'), 0o644); err != nil {
			fail("写入快照失败: %v", err)
		}
		printStats(routes, m)
		fmt.Printf("已更新快照: %s\n", *snapshotPath)
		return
	}

	previous, err := loadSnapshot(*snapshotPath)
	if err != nil {
		fail("读取快照失败（首次请运行 -update）: %v", err)
	}
	failed := compare(previous, routes)
	if failed {
		os.Exit(1)
	}
	printStats(routes, m)
}

// buildManifest 生成 manifest 初稿：显式 overrides 优先，其余只在方法确实存在时写入。
// buildManifest 依据基线生成 manifest。
//
// 已剔除前缀以现有 manifest 为准：它们是人工维护的决策，重新生成 routes 时
// 不能把它们丢掉，否则门禁会把「已确认不迁移」的接口重新算成未映射。
func buildManifest(routes []route, path string) manifest {
	exclusions := append([]excludedPrefix(nil), fallbackExclusions...)
	if existing, err := loadManifest(path); err == nil && len(existing.ExcludedPrefixes) > 0 {
		exclusions = existing.ExcludedPrefixes
	}
	m := manifest{Version: 1, ExcludedPrefixes: exclusions, Routes: map[string]string{}}
	for _, r := range routes {
		key := r.Method + " " + r.Path
		if isExcluded(r.Path, m.ExcludedPrefixes) {
			continue
		}
		if target, ok := overrides[normalizeRouteKey(key)]; ok {
			m.Routes[normalizeRouteKey(key)] = target
			continue
		}
		if target, ok := overrides[key]; ok {
			m.Routes[normalizeRouteKey(key)] = target
		}
	}
	return m
}

// loadManifest 读取 YAML manifest。
func loadManifest(path string) (manifest, error) {
	var m manifest
	data, err := os.ReadFile(path)
	if err != nil {
		return m, err
	}
	if err := yaml.Unmarshal(data, &m); err != nil {
		return m, err
	}
	if m.Routes == nil {
		m.Routes = map[string]string{}
	}
	return m, nil
}

// writeManifest 以稳定顺序写出 YAML。
func writeManifest(path string, m manifest) error {
	keys := make([]string, 0, len(m.Routes))
	for key := range m.Routes {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var b strings.Builder
	b.WriteString("# 1Panel REST 路由 → proto RPC 映射。\n")
	b.WriteString("# 由 `go run ./master/cmd/rpc-coverage -update-manifest` 生成初稿，人工确认后提交。\n")
	b.WriteString("version: 1\n\nexcluded_prefixes:\n")
	for _, item := range m.ExcludedPrefixes {
		b.WriteString("  - prefix: " + item.Prefix + "\n")
		if item.Exact {
			b.WriteString("    exact: true\n")
		}
		b.WriteString("    reason: " + item.Reason + "\n")
	}
	b.WriteString("\nroutes:\n")
	for _, key := range keys {
		b.WriteString("  \"" + key + "\": " + m.Routes[key] + "\n")
	}
	return os.WriteFile(path, []byte(b.String()), 0o644)
}

// applyManifest 把 manifest 应用到路由列表。
func applyManifest(routes []route, m manifest, services map[string]map[string]bool) {
	matched := make(map[string]bool, len(m.Routes))
	for i := range routes {
		if isExcluded(routes[i].Path, m.ExcludedPrefixes) {
			routes[i].Excluded = true
			continue
		}
		key := normalizeRouteKey(routes[i].Method + " " + routes[i].Path)
		target, ok := m.Routes[key]
		if !ok {
			continue
		}
		matched[key] = true
		routes[i].Target = target
		parts := strings.Split(target, ".")
		if len(parts) < 2 {
			continue
		}
		routes[i].RPC = parts[len(parts)-1]
		routes[i].Service = strings.Join(parts[:len(parts)-1], ".")
		if methods, ok := services[routes[i].Service]; ok && methods[routes[i].RPC] {
			routes[i].Covered = true
		}
	}
	// 未被任何基线路由命中的映射说明路径写错了（例如 :id 与 {id} 不一致），
	// 静默忽略会让覆盖率高估，必须显式提示。
	var stale []string
	for key := range m.Routes {
		if !matched[key] {
			stale = append(stale, key)
		}
	}
	if len(stale) > 0 {
		sort.Strings(stale)
		fmt.Printf("警告: %d 条 manifest 映射未命中任何基线路由：\n", len(stale))
		for _, key := range stale {
			fmt.Printf("  %s\n", key)
		}
	}
}

// normalizeRouteKey 把路径参数统一成 :name 形式。
//
// 基线用 {name}，历史 manifest 里混用 :name；两者语义相同，
// 比较前统一，避免映射因为写法差异悄悄失效。
func normalizeRouteKey(key string) string {
	return pathParamPattern.ReplaceAllString(key, ":$1")
}

// isExcluded 判断路径是否属于已剔除模块。
func isExcluded(path string, prefixes []excludedPrefix) bool {
	for _, item := range prefixes {
		if item.Exact {
			if path == item.Prefix {
				return true
			}
			continue
		}
		if strings.HasPrefix(path, item.Prefix) {
			return true
		}
	}
	return false
}

// parseProtoServices 解析 proto 里的 service 与 rpc 方法。
func parseProtoServices(dir string) (map[string]map[string]bool, error) {
	services := map[string]map[string]bool{}
	serviceRe := regexp.MustCompile(`(?m)^service\s+(\w+)\s*\{`)
	rpcRe := regexp.MustCompile(`(?m)^\s*rpc\s+(\w+)\s*\(`)
	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() || !strings.HasSuffix(path, ".proto") {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		text := string(data)
		pkg := "panel.agent.v1"
		if m := regexp.MustCompile(`(?m)^package\s+([\w.]+);`).FindStringSubmatch(text); m != nil {
			pkg = m[1]
		}
		locs := serviceRe.FindAllStringSubmatchIndex(text, -1)
		for i, loc := range locs {
			name := text[loc[2]:loc[3]]
			end := len(text)
			if i+1 < len(locs) {
				end = locs[i+1][0]
			}
			methods := map[string]bool{}
			for _, m := range rpcRe.FindAllStringSubmatch(text[loc[0]:end], -1) {
				methods[m[1]] = true
			}
			services[pkg+"."+name] = methods
		}
		return nil
	})
	return services, err
}

// collectRoutes 从 1Panel 的 Swagger 注解提取路由。
func collectRoutes(root string) ([]route, error) {
	seen := map[string]bool{}
	var routes []route
	routesRe := regexp.MustCompile(`@Router\s+(\S+)\s+\[(\w+)\]`)
	for _, dir := range []string{"core", "agent"} {
		base := filepath.Join(root, dir)
		if _, err := os.Stat(base); err != nil {
			return nil, fmt.Errorf("%s 不存在: %w", base, err)
		}
		err := filepath.Walk(base, func(path string, info os.FileInfo, err error) error {
			if err != nil || info.IsDir() || !strings.HasSuffix(path, ".go") {
				return nil
			}
			data, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			for _, m := range routesRe.FindAllStringSubmatch(string(data), -1) {
				key := strings.ToUpper(m[2]) + " " + m[1]
				if seen[key] {
					continue
				}
				seen[key] = true
				routes = append(routes, route{Method: strings.ToUpper(m[2]), Path: m[1]})
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	sort.Slice(routes, func(i, j int) bool {
		if routes[i].Path == routes[j].Path {
			return routes[i].Method < routes[j].Method
		}
		return routes[i].Path < routes[j].Path
	})
	return routes, nil
}

// loadSnapshot 读取快照。
func loadSnapshot(path string) (*snapshot, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var snap snapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return nil, err
	}
	return &snap, nil
}

// compare 检查覆盖率退化、映射目标丢失或基线路由集合变化。
func compare(previous *snapshot, current []route) bool {
	prev := map[string]route{}
	for _, item := range previous.Routes {
		prev[item.Method+" "+item.Path] = item
	}
	currentSet := map[string]bool{}
	failed := false
	for _, item := range current {
		key := item.Method + " " + item.Path
		currentSet[key] = true
		old, ok := prev[key]
		if !ok {
			fmt.Printf("基线新增路由未入快照: %s（确认后运行 -update）\n", key)
			failed = true
			continue
		}
		if old.Covered && !item.Covered {
			fmt.Printf("覆盖率退化: %s 之前映射到 %s，现在无效\n", key, old.Target)
			failed = true
		}
		if old.Excluded != item.Excluded {
			fmt.Printf("剔除状态变化: %s（确认后运行 -update）\n", key)
			failed = true
		}
	}
	for key := range prev {
		if !currentSet[key] {
			fmt.Printf("基线路由消失: %s（若为有意删除请运行 -update）\n", key)
			failed = true
		}
	}
	if failed {
		fmt.Println("RPC 基线覆盖率门禁失败")
	}
	return failed
}

// printStats 输出总览与按域覆盖率。
func printStats(routes []route, m manifest) {
	byService := map[string][2]int{}
	covered, excluded, unmapped := 0, 0, 0
	for _, item := range routes {
		if item.Excluded {
			excluded++
			continue
		}
		if item.Service == "" {
			unmapped++
			continue
		}
		stat := byService[item.Service]
		stat[1]++
		if item.Covered {
			covered++
			stat[0]++
		}
		byService[item.Service] = stat
	}
	names := make([]string, 0, len(byService))
	for name := range byService {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		stat := byService[name]
		fmt.Printf("  %-40s %3d/%3d\n", name, stat[0], stat[1])
	}
	fmt.Printf("总计: 覆盖 %d，剔除 %d，未映射 %d，基线 %d\n", covered, excluded, unmapped, len(routes))
	fmt.Printf("manifest 映射条数: %d\n", len(m.Routes))
}

func fail(format string, args ...interface{}) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
