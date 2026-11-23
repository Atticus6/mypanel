import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    FileAISettingSchema,
    FileHistorySettingSchema,
    SaveDescriptionRequestSchema,
    TerminalAISettingSchema,
    AgentSettingInfoSchema,
} from '@/gen/panel/agent/v1/setting_pb';
import {
    CreateSnapshotRequestSchema,
    DataTreeSchema,
    ImportSnapshotRequestSchema,
    RecoverSnapshotRequestSchema,
    SnapshotDataSchema,
    SnapshotInfoSchema,
} from '@/gen/panel/agent/v1/snapshot_pb';
import {
    PasskeyBeginResponseSchema,
    PasskeyInfoSchema,
    PasskeyRegisterBeginRequestSchema,
} from '@/gen/panel/core/v1/auth_pb';
import {
    SettingBaseInfoSchema,
    SettingInfoSchema,
    SSLInfoSchema,
    TerminalInfoSchema,
    UpdatePortRequestSchema,
    UpdateProxyRequestSchema,
    UpdateSettingRequestSchema,
    UpdateSSLRequestSchema,
    UpgradeInfoSchema,
} from '@/gen/panel/core/v1/setting_pb';

// 剥掉 protobuf 内部元字段，避免不同消息的 $typeName/$unknown 字面量类型互相冲突。
type Init<T extends DescMessage> = Omit<MessageInitShape<T>, '$typeName' | '$unknown'>;

// 设置域 DTO 统一来自 proto 生成类型；只保留旧页面仍在用的字段名兼容别名。
// License / Node 等 xpack 相关结构已无 proto 对应物，保留为纯 UI 类型。
export namespace Setting {
    export type AgentSettingInfo = Omit<
        Init<typeof AgentSettingInfoSchema>,
        'systemIp' | 'defaultIo' | 'localSshConnShow'
    > & {
        systemIP?: string;
        defaultIO?: string;
        localSSHConnShow?: string;
    };
    export type SettingInfo = Init<typeof SettingInfoSchema> & {
        sessionTimeout?: number;
        expirationDays?: number;
        serverPort?: number;
        allowIPs?: string;
        allowIPTrustedProxies?: string;
    };
    export type SettingBaseInfo = Init<typeof SettingBaseInfoSchema>;
    export type TerminalInfo = Init<typeof TerminalInfoSchema>;
    export type TerminalAIInfo = Init<typeof TerminalAISettingSchema>;
    export type FileManageAIInfo = Init<typeof FileAISettingSchema>;
    export type FileHistoryInfo = Omit<Init<typeof FileHistorySettingSchema>, 'diskQuotaMb'> & { diskQuotaMB?: number };
    export type SettingUpdate = Init<typeof UpdateSettingRequestSchema>;
    export type ProxyUpdate = Init<typeof UpdateProxyRequestSchema>;
    export type SSLUpdate = Omit<Init<typeof UpdateSSLRequestSchema>, 'sslId'> & { sslID?: number };
    export type SSLInfo = Init<typeof SSLInfoSchema> & { sslID?: number };
    export type PortUpdate = Omit<Init<typeof UpdatePortRequestSchema>, 'port'> & { serverPort?: number };
    export type PasskeyRegisterRequest = Init<typeof PasskeyRegisterBeginRequestSchema>;
    export type PasskeyBeginResponse = Omit<Init<typeof PasskeyBeginResponseSchema>, 'publicKey'> & {
        publicKey?: Record<string, any>;
    };
    export type PasskeyInfo = Init<typeof PasskeyInfoSchema>;
    export type CommonDescription = Init<typeof SaveDescriptionRequestSchema>;

    export type SnapshotCreate = Init<typeof CreateSnapshotRequestSchema>;
    export type SnapshotImport = Init<typeof ImportSnapshotRequestSchema>;
    export type SnapshotRecover = Init<typeof RecoverSnapshotRequestSchema> & { taskID?: string };
    export type SnapshotInfo = Omit<Init<typeof SnapshotInfoSchema>, 'size' | 'createdAt'> & {
        size?: number;
        createdAt?: string;
        taskID?: string;
        taskRecoverID?: string;
        taskRollbackID?: string;
    };
    export type SnapshotData = Init<typeof SnapshotDataSchema>;
    export type DataTree = Omit<Init<typeof DataTreeSchema>, 'size' | 'isCheck' | 'children'> & {
        size?: number;
        isShow?: boolean;
        Children?: DataTree[];
    };
    export type UpgradeInfo = Init<typeof UpgradeInfoSchema>;

    export interface License {
        licenseName: string;
        assigneeName: string;
        productPro: string;
        versionConstraint: string;
        trial: boolean;
        status: string;
        message: string;
        smsUsed: number;
        smsTotal: number;
    }
    export interface LicenseOptions {
        id: number;
        licenseName: string;
        totalFreeCount: number;
        availableXpackCount: number;
        availableFreeCount: number;
    }
    export interface LicenseStatus {
        productPro: string;
        status: string;
        smsTotal: number;
        smsUsed: number;
    }
    export interface LicenseEE {
        deviceID: string;
        corporation: string;
        isv: string;
        expired: string;
        product: string;
        edition: string;
        licenseVersion: string;
        count: number;
        serialNo: string;
        remark: string;
        ext: string;
        status: string;
        message: string;
    }
    export interface CommunityRestoreStatus {
        state: 'Ready' | 'Running' | 'Failed';
        message: string;
        packageExist: boolean;
        packageDirectory: string;
        packageName: string;
        packageURL: string;
    }
    export type CommunityRestoreMode = 'online' | 'offline';
    export interface NodeItem {
        id: number;
        groupID?: number;
        groupBelong?: string;
        addr: string;
        status: string;
        version: string;
        isXpack: boolean;
        isBound: boolean;
        isFavorite?: boolean;
        name: string;
    }
    export interface SimpleNodeItem {
        id: number;
        name: string;
        addr: string;
        description: string;
        systemVersion: string;
        securityEntrance: string;
        cpuUsedPercent: number;
        cpuTotal: number;
        memoryTotal: number;
        memoryUsedPercent: number;
    }
    export interface ReleasesNotes {
        Version: string;
        CreatedAt: string;
        Content: string;
        NewCount: number;
        OptimizationCount: number;
        FixCount: number;
    }
    export interface LicenseBind {
        nodeID: number;
        licenseID: number;
        syncList: string;
        withDockerRestart: boolean;
    }
    export interface LicenseUnbind {
        id: number;
        force: boolean;
        withDockerRestart: boolean;
    }
    export interface SmsInfo {
        licenseName: string;
        smsUsed: number;
        smsTotal: number;
    }
    export interface NodeAppItem {
        name: string;
        updateCount: number;
    }
}
