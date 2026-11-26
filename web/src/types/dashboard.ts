import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    DashboardBaseSchema,
    DashboardCurrentSchema,
    DiskInfoSchema,
    LauncherOptionSchema,
    OsInfoSchema,
    QuickDirectorySchema,
    QuickJumpSchema,
    RunningTimeSchema,
    TopProcessSchema,
} from '@/gen/panel/agent/v1/dashboard_pb';

// 剥掉 protobuf 内部元字段，避免不同消息的 $typeName/$unknown 字面量类型互相冲突。
type Init<T extends DescMessage> = Omit<MessageInitShape<T>, '$typeName' | '$unknown'>;

// 仪表盘 DTO 统一来自 proto 生成类型；int64 字段在 TS 为 bigint，
// 为兼容旧页面按 number 使用，统一 Omit 后补 number 字段。
// GPU/NPU/XPU 等加速卡信息无 proto 对应物，保留为纯 UI 类型。
export namespace Dashboard {
    export type OsInfo = Omit<Init<typeof OsInfoSchema>, 'diskSize'> & { diskSize?: number };
    export type QuickDirectory = Init<typeof QuickDirectorySchema>;
    export type QuickJump = Init<typeof QuickJumpSchema>;

    export type AppLauncherOption = Init<typeof LauncherOptionSchema>;

    export type BaseInfo = Omit<Init<typeof DashboardBaseSchema>, 'currentInfo' | 'quickJumps'> & {
        httpProxy?: string;
        quickJump?: QuickJump[];
        quickJumps?: QuickJump[];
        currentInfo?: CurrentInfo;
    };

    type CurrentInit = Init<typeof DashboardCurrentSchema>;
    export type CurrentInfo = Omit<
        CurrentInit,
        | 'uptime'
        | 'procs'
        | 'memoryTotal'
        | 'memoryUsed'
        | 'memoryFree'
        | 'memoryShard'
        | 'memoryCache'
        | 'memoryAvailable'
        | 'swapMemoryTotal'
        | 'swapMemoryAvailable'
        | 'swapMemoryUsed'
        | 'ioReadBytes'
        | 'ioWriteBytes'
        | 'ioCount'
        | 'ioReadTime'
        | 'ioWriteTime'
        | 'netBytesSent'
        | 'netBytesRecv'
        | 'runningTime'
        | 'shotTime'
        | 'diskData'
    > & {
        uptime?: number;
        procs?: number;
        memoryTotal?: number;
        memoryUsed?: number;
        memoryFree?: number;
        memoryShard?: number;
        memoryCache?: number;
        memoryAvailable?: number;
        swapMemoryTotal?: number;
        swapMemoryAvailable?: number;
        swapMemoryUsed?: number;
        ioReadBytes?: number;
        ioWriteBytes?: number;
        ioCount?: number;
        ioReadTime?: number;
        ioWriteTime?: number;
        netBytesSent?: number;
        netBytesRecv?: number;
        runningTime?: RunningTime;
        diskData?: DiskInfo[];
        shotTime?: Date;
        gpuData?: any[];
        npuData?: any[];
        xpuData?: any[];
        topCPUItems?: Process[];
        topMemItems?: Process[];
    };

    export type RunningTime = Omit<Init<typeof RunningTimeSchema>, 'days' | 'hours' | 'minutes' | 'seconds'> & {
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
    };
    export type Process = Omit<Init<typeof TopProcessSchema>, 'memory'> & { memory?: number };
    export type DiskInfo = Omit<
        Init<typeof DiskInfoSchema>,
        'total' | 'free' | 'used' | 'inodesTotal' | 'inodesUsed' | 'inodesFree'
    > & {
        total?: number;
        free?: number;
        used?: number;
        inodesTotal?: number;
        inodesUsed?: number;
        inodesFree?: number;
    };
}
