import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    HostSchema,
    HostGroupSchema,
    HostTreeChildSchema,
    HostTreeRequestSchema,
    SearchHostsRequestSchema,
    CreateHostRequestSchema,
    UpdateHostRequestSchema,
    UpdateHostGroupRequestSchema,
    TestHostInfoRequestSchema,
    ComponentInfoSchema,
    DiskPartBaseSchema,
    DiskDetailSchema,
    CompleteDiskDetailSchema,
    PartitionDiskRequestSchema,
    MountDiskRequestSchema,
    UnmountDiskRequestSchema,
    DiagnosticsSummarySchema,
    GoroutineGroupSchema,
    GoroutineSnapshotSchema,
    CreateDiagnosticsProfileRequestSchema,
} from '@/gen/panel/agent/v1/host_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

export namespace Host {
    export type TreeNode = Init<typeof HostTreeChildSchema>;
    export type HostTree = Init<typeof HostGroupSchema>;

    // 主机展示信息：凭据字段不进入 proto，由展示层自行补充；groupID 保留旧字段名。
    export type Host = Init<typeof HostSchema> & {
        groupID: number;
        password: string;
        privateKey: string;
        passPhrase: string;
        rememberPassword: boolean;
        updatedAt?: string;
    };

    export type HostOperate = Init<typeof UpdateHostRequestSchema> & {
        groupID: number;
        isLocal: boolean;
    };

    export type HostConnTest = Init<typeof TestHostInfoRequestSchema> & {
        isLocal: boolean;
        localSSHConnShow: string;
    };

    export type GroupChange = Init<typeof UpdateHostGroupRequestSchema> & { groupID: number };

    export type ReqSearch = Init<typeof HostTreeRequestSchema>;

    export type SearchWithPage = Init<typeof SearchHostsRequestSchema> & { groupID: number };

    export interface MonitorSetting {
        gpuMonitorStatus: string;
        gpuMonitorStoreDays: string;
        gpuMonitorInterval: string;
        defaultNetwork: string;
        defaultIO: string;
        monitorStatus: string;
        monitorStoreDays: string;
        monitorInterval: string;
    }
    export interface MonitorData {
        param: string;
        date: Array<Date>;
        value: Array<any>;
    }
    export interface MonitorSearch {
        param: string;
        io: string;
        network: string;
        startTime: Date;
        endTime: Date;
    }

    // 内存统计字段在 proto 中为 uint64（bigint），展示层按 number 处理。
    export type RuntimeDiagnosticsSummary = Omit<
        Init<typeof DiagnosticsSummarySchema>,
        'rss' | 'heapAlloc' | 'heapObjects'
    > & {
        rss: number;
        heapAlloc: number;
        heapObjects: number;
    };
    export type RuntimeGoroutineGroup = Init<typeof GoroutineGroupSchema>;
    export type RuntimeGoroutineSnapshot = Init<typeof GoroutineSnapshotSchema>;
    export type RuntimeProfileCreate = Omit<
        Init<typeof CreateDiagnosticsProfileRequestSchema>,
        '$typeName' | '$unknown' | 'type' | 'duration'
    > & {
        type: string;
        duration: number;
    };

    export interface SSHInfo {
        autoStart: boolean;
        isActive: boolean;
        message: string;
        port: string;
        listenAddress: string;
        passwordAuthentication: string;
        pubkeyAuthentication: string;
        encryptionMode: string;
        primaryKey: string;
        permitRootLogin: string;
        useDNS: string;
        currentUser: string;
    }
    export interface SSHUpdate {
        key: string;
        newValue: string;
    }
    export interface RootCert {
        name: string;
        mode: string;
        encryptionMode: string;
        passPhrase: string;
        privateKey: string;
        publicKey: string;
        description: string;
    }
    export interface RootCertInfo {
        id: number;
        createAt: Date;
        name: string;
        mode: string;
        encryptionMode: string;
        passPhrase: string;
        description: string;
        publicKey: string;
        privateKey: string;
    }
    export interface searchSSHLog {
        info: string;
        status: string;
        startTime?: string | Date;
        endTime?: string | Date;
        page: number;
        pageSize: number;
    }
    export interface analysisSSHLog {
        orderBy: string;
        page: number;
        pageSize: number;
    }
    export interface sshHistory {
        date: Date;
        area: string;
        user: string;
        authMode: string;
        address: string;
        port: string;
        status: string;
        message: string;
    }

    export type DiskBasicInfo = Init<typeof DiskPartBaseSchema>;

    // DiskCard 同时接收 DiskDetail（已分区）与 DiskPartBase（未分区），去掉 $typeName 以兼容两者。
    export type DiskInfo = Omit<Init<typeof DiskDetailSchema>, '$typeName' | '$unknown'> & {
        partitions?: DiskBasicInfo[];
    };

    // 总容量在 proto 中为 uint64（bigint），展示层按 number 处理。
    export type CompleteDiskInfo = Omit<Init<typeof CompleteDiskDetailSchema>, 'totalCapacity'> & {
        totalCapacity: number;
    };

    export type DiskPartition = Init<typeof PartitionDiskRequestSchema>;

    export type DiskMount = Init<typeof MountDiskRequestSchema>;

    export type DiskUmount = Init<typeof UnmountDiskRequestSchema>;

    export type ComponentInfo = Init<typeof ComponentInfoSchema>;
}
