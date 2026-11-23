import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    ReadSystemLogsRequestSchema,
    SystemLogBatchSchema,
    SystemLogEntrySchema,
    SystemLogStatusSchema,
    ReadTaskLogsRequestSchema,
} from '@/gen/panel/agent/v1/log_pb';
import { SearchTasksRequestSchema, TaskSchema } from '@/gen/panel/agent/v1/task_pb';
import {
    CleanLogsRequestSchema,
    LoginLogEntrySchema,
    OperationLogEntrySchema,
    SearchLoginLogsRequestSchema,
    SearchOperationLogsRequestSchema,
} from '@/gen/panel/core/v1/log_pb';

// 剥掉 protobuf 内部元字段，避免不同消息的 $typeName/$unknown 字面量类型互相冲突。
type Init<T extends DescMessage> = Omit<MessageInitShape<T>, '$typeName' | '$unknown'>;

// 日志域 DTO 统一来自 proto 生成类型；只保留旧页面仍在用的字段名兼容别名。
export namespace Log {
    export type OperationLog = Omit<Init<typeof OperationLogEntrySchema>, 'latencyMs' | 'createdAt'> & {
        apiKeyID?: string;
        detailZH?: string;
        detailEN?: string;
        latency?: number;
        createdAt?: string;
    };
    export type SearchOpLog = Init<typeof SearchOperationLogsRequestSchema>;
    export type SearchLgLog = Init<typeof SearchLoginLogsRequestSchema>;
    export type LoginLogs = Init<typeof LoginLogEntrySchema>;
    export type CleanLog = Init<typeof CleanLogsRequestSchema>;

    export type SystemLog = Omit<Init<typeof SystemLogBatchSchema>, 'items'> & { items: SystemLogItem[] };
    export type SystemLogStatus = Omit<Init<typeof SystemLogStatusSchema>, 'source'> & {
        source: 'journalctl' | 'file';
    };
    export type SystemLogSearch = Init<typeof ReadSystemLogsRequestSchema>;
    export type SystemLogItem = Init<typeof SystemLogEntrySchema>;

    export type SearchTaskReq = Init<typeof SearchTasksRequestSchema> & { taskID?: string };
    export type TaskLogReadReq = Init<typeof ReadTaskLogsRequestSchema> & { taskID?: string; resourceID?: number };
    export type Task = Omit<
        Init<typeof TaskSchema>,
        'operationLogId' | 'resourceId' | 'endAt' | 'createdAt'
    > & {
        operationLogID?: number;
        resourceID?: number;
        endAt?: Date;
        createdAt?: Date;
        progressCurrent?: number;
        progressTotal?: number;
        progressPercent?: number;
        progressMessage?: string;
    };
}
