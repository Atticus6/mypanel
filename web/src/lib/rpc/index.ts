import type { DescService } from '@bufbuild/protobuf';

import { AuthService } from '@/gen/panel/core/v1/auth_pb';
import { SettingService } from '@/gen/panel/core/v1/setting_pb';
import { DiagnosticsService } from '@/gen/panel/core/v1/diagnostics_pb';
import { LogService as CoreLogService } from '@/gen/panel/core/v1/log_pb';
import { ScriptService } from '@/gen/panel/core/v1/script_pb';
import { CommandService } from '@/gen/panel/core/v1/command_pb';
import { GroupService } from '@/gen/panel/core/v1/group_pb';
import { BackupsService } from '@/gen/panel/core/v1/backup_pb';
import { WebsiteService } from '@/gen/panel/agent/v1/website_pb';
import { HostService } from '@/gen/panel/agent/v1/host_pb';
import { DashboardService } from '@/gen/panel/agent/v1/dashboard_pb';
import { FileService } from '@/gen/panel/agent/v1/file_pb';
import { CronjobService } from '@/gen/panel/agent/v1/cronjob_pb';
import { ContainerService } from '@/gen/panel/agent/v1/container_pb';
import { DatabaseService } from '@/gen/panel/agent/v1/database_pb';
import { AlertService } from '@/gen/panel/agent/v1/alert_pb';
import { AppService } from '@/gen/panel/agent/v1/app_pb';
import { BackupService } from '@/gen/panel/agent/v1/backup_pb';
import { WebsiteSSLService } from '@/gen/panel/agent/v1/website_ssl_pb';
import { FirewallService } from '@/gen/panel/agent/v1/firewall_pb';
import { TaskService } from '@/gen/panel/agent/v1/task_pb';
import { LogService } from '@/gen/panel/agent/v1/log_pb';
import { FileTransferService } from '@/gen/panel/agent/v1/file_transfer_pb';
import { AgentSettingService } from '@/gen/panel/agent/v1/setting_pb';
import { SnapshotService } from '@/gen/panel/agent/v1/snapshot_pb';
import { TerminalService } from '@/gen/panel/agent/v1/terminal_pb';
import { SSHService } from '@/gen/panel/agent/v1/ssh_pb';
import { MonitorService } from '@/gen/panel/agent/v1/monitor_pb';
import { createRpc } from './create-rpc';
import { transport } from './transport';

/**
 * 唯一手工维护的 RPC 注册表。
 *
 * 只登记 service descriptor，不登记 method，也不写 hook。
 * 方法名、入参类型、出参类型，以及 useQuery / useMutation 等入口
 * 全部由 `createRpc` 从 descriptor 推导。
 *
 * 命名空间约定：core 统一放在 `rpc.core.*` 下，agent 直接挂在根上，
 * 与 1Panel 原来的 `api/modules` 分组习惯保持一致。
 */
const services = {
    core: {
        auth: AuthService,
        setting: SettingService,
        diagnostics: DiagnosticsService,
        log: CoreLogService,
        script: ScriptService,
        command: CommandService,
        group: GroupService,
        backups: BackupsService,
    },
    website: WebsiteService,
    host: HostService,
    dashboard: DashboardService,
    file: FileService,
    cronjob: CronjobService,
    container: ContainerService,
    database: DatabaseService,
    alert: AlertService,
    app: AppService,
    backup: BackupService,
    ssl: WebsiteSSLService,
    firewall: FirewallService,
    task: TaskService,
    log: LogService,
    fileTransfer: FileTransferService,
    agentSetting: AgentSettingService,
    snapshot: SnapshotService,
    terminal: TerminalService,
    ssh: SSHService,
    monitor: MonitorService,
} as const satisfies Record<string, DescService | Record<string, DescService>>;

export const rpc = createRpc(services, transport);

export type { Rpc, ServiceRpc, ValidateResult, ViolationItem } from './create-rpc';
export { toFormPath } from './create-rpc';
export { transport } from './transport';
