import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    BackupCheckResultSchema,
    BackupDataRequestSchema,
    BackupOperateSchema,
    BackupOptionSchema,
    BackupRecordEntrySchema,
    BackupSchema,
    DownloadBackupRecordRequestSchema,
    ListBucketsRequestSchema,
    LoadRecordSizeRequestSchema,
    RecordFileSizeSchema,
    RecoverDataRequestSchema,
    SearchBackupRecordsByCronjobRequestSchema,
    SearchBackupRecordsRequestSchema,
    SearchBackupsRequestSchema,
} from '@/gen/panel/agent/v1/backup_pb';
import { BackupClientInfoSchema } from '@/gen/panel/core/v1/backup_pb';

// 剥掉 protobuf 内部元字段，避免不同消息的 $typeName/$unknown 字面量类型互相冲突。
type Init<T extends DescMessage> = Omit<MessageInitShape<T>, '$typeName' | '$unknown'>;

// 备份域 DTO 统一来自 proto 生成类型；只保留旧页面仍在用的字段名兼容别名。
export namespace Backup {
    export type SearchWithType = Init<typeof SearchBackupsRequestSchema>;
    export type BackupOption = Init<typeof BackupOptionSchema>;

    type BackupInfoBase = Init<typeof BackupSchema> & Init<typeof BackupOperateSchema>;
    export type BackupInfo = Omit<BackupInfoBase, 'createdAt'> & {
        bucketInput?: boolean;
        varsJson?: Record<string, any>;
        createdAt?: Date;
    };

    export type CheckResult = Init<typeof BackupCheckResultSchema>;
    export type ClientInfo = Init<typeof BackupClientInfoSchema> & {
        client_id?: string;
        client_secret?: string;
        redirect_uri?: string;
    };
    export type BackupOperate = Init<typeof BackupOperateSchema>;

    export type RecordDownload = Init<typeof DownloadBackupRecordRequestSchema> & { downloadAccountID?: number };
    export type RecordInfo = Omit<Init<typeof BackupRecordEntrySchema>, 'createdAt'> & {
        downloadAccountID?: number;
        size?: number;
        createdAt?: Date;
    };
    export type ForBucket = Init<typeof ListBucketsRequestSchema>;
    export type SearchBackupRecord = Init<typeof SearchBackupRecordsRequestSchema>;
    export type SearchForSize = Init<typeof LoadRecordSizeRequestSchema> & { cronjobID?: number };
    export type RecordFileSize = Omit<Init<typeof RecordFileSizeSchema>, 'size'> & { size: number };
    export type SearchBackupRecordByCronjob = Init<typeof SearchBackupRecordsByCronjobRequestSchema> & {
        cronjobID?: number;
    };
    export type Backup = Init<typeof BackupDataRequestSchema> & { taskID?: string };
    export type Recover = Init<typeof RecoverDataRequestSchema> & { downloadAccountID?: number; taskID?: string };
}
