import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    ListeningProcessSchema,
    StopProcessRequestSchema,
} from '@/gen/panel/agent/v1/process_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

export namespace Process {
    export type StopReq = Init<typeof StopProcessRequestSchema>;
    export type ListeningProcess = Init<typeof ListeningProcessSchema> & {
    PID?: number;
    Port?: Record<string, unknown>;
    Protocol?: number;
    Name?: string;
};

    // 进程详情由 detailJson 透传，组件自行按字段展示。
    export interface PsProcessData {
        PID: number;
        name: string;
        PPID: number;
        username: string;
        status: string;
        startTime: string;
        numThreads: number;
        numConnections: number;
        cpuPercent: string;
        diskRead: string;
        diskWrite: string;
        cmdLine: string;
        rss: string;
        vms: string;
        hwm: string;
        data: string;
        stack: string;
        locked: string;
        swap: string;
        dirty: string;
        pss: string;
        uss: string;
        shared: string;
        text: string;
        cpuValue: number;
        rssValue: number;
        envs: string[];
        openFiles: OpenFilesStat[];
        connects: ProcessConnect[];
    }

    export interface ProcessConnect {
        type: string;
        status: string;
        localaddr: string;
        remoteaddr: string;
        PID: number;
        name: string;
    }
    export type ProcessConnects = ProcessConnect[];
    export interface OpenFilesStat {
        path: string;
        fd: number;
    }
}
