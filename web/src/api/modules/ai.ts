import type { AI } from '@/types/ai';

// AI / 模型 / MCP / Agent 能力已随 xpack 一并剔除。
// 这里保留少量返回空数据的本地桩，避免通用组件（GPU 配置、监控导出等）
// 因为引用已删除的 REST 接口而在运行时拿到 SPA 回退的 HTML。

export const getGPUOptions = async (_currentNode?: string) => ({
    data: { supported: false, chartHide: [] } as unknown as AI.MonitorGPUOptions,
});

export const loadGPUMonitor = async (_param: AI.MonitorGPUSearch, _currentNode?: string) => ({
    data: {} as unknown as AI.MonitorGPUData,
});

export const loadModelGPUDevices = async (_currentNode?: string) => ({
    data: { devices: [], warnings: [], numaNodes: [] } as unknown as {
        devices: AI.ModelGPUDevice[];
        warnings: string[];
        numaNodes: AI.ModelNUMANode[];
    },
});

export const listGPUGroups = async (_currentNode?: string) => ({
    data: [] as AI.GPUGroup[],
});

export const saveGPUGroup = async (_data: unknown) => ({
    data: undefined,
});

export const pageAgentAccounts = async (_req: AI.AgentAccountSearch, _currentNode?: string) => ({
    data: { items: [], total: 0 } as unknown as { items: AI.AgentAccountItem[]; total: number },
});
