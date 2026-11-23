export interface ChartHide {
    sharedMemory?: boolean;
    deviceID?: string;
    legacy?: boolean;
    productName: string;
    type?: 'gpu' | 'npu' | 'xpu';
    process: boolean;
    gpu: boolean;
    memory: boolean;
    power: boolean;
    powerLimit: boolean;
    temperature: boolean;
    speed: boolean;
}
export interface GPUProcess {
    pid: string;
    type: string;
    processName: string;
    usedMemory: string;
}
export interface ModelGPUConfig {
    group?: { id: number; name: string; revision: number };
    numa?: { mode: 'off' | 'auto' | 'manual'; nodes: number[] };
    mode: 'all' | 'count' | 'devices';
    count?: number;
    error?: string;
    enabled: boolean;
    deviceIDs: string[];
    capabilities: string[];
}
export interface AgentAccountModel {
    recordId: number;
    id: string;
    name: string;
    isVerifyModel?: boolean;
}

export interface AgentAccountItem {
    appInstallId?: number;
    id: number;
    provider: string;
    providerName: string;
    name: string;
    apiKey: string;
    rememberApiKey: boolean;
    baseUrl: string;
    models: AgentAccountModel[];
    apiType: string;
    authMode: string;
    verifyModel: string;
    verified: boolean;
    validateAvailability: boolean;
    verifiedAt?: string | null;
    verifyError?: string;
    remark: string;
    createdAt: string;
}

export interface AgentAccountSearch {
    page: number;
    pageSize: number;
    provider: string;
    apiType?: string;
    textOnly?: boolean;
    name: string;
}

export interface GPUGroup {
    description: string;
    id: number;
    name: string;
    imageType: string;
    revision: number;
    gpu: ModelGPUConfig;
    deployments: string[];
}

export interface ModelGPUDevice {
    index?: number;
    id: string;
    name: string;
    type: string;
    uuid?: string;
    numaNode?: number;
    available: boolean;
}

export interface ModelNUMANode {
    id: number;
    cpus: string;
    memory: boolean;
}

export interface MonitorGPUData {
    memoryActivity: Array<number | null>;
    encoderUtil: Array<number | null>;
    decoderUtil: Array<number | null>;
    jpegUtil: Array<number | null>;
    ofaUtil: Array<number | null>;
    mediaUtil: Array<number | null>;
    computeUtil: Array<number | null>;
    copyUtil: Array<number | null>;
    hotspotTemperature: Array<number | null>;
    fanRPM: Array<number | null>;
    aiCPUUtil: Array<number | null>;
    ctrlCPUUtil: Array<number | null>;
    ddrUsed: Array<number | null>;
    ddrTotal: Array<number | null>;
    hbmUsed: Array<number | null>;
    hbmTotal: Array<number | null>;
    ddrBandwidth: Array<number | null>;
    hbmBandwidth: Array<number | null>;
    memoryBandwidth: Array<number | null>;
    mediaFrequency: Array<number | null>;
    hugepagesUsed: Array<number | null>;
    hugepagesTotal: Array<number | null>;

    bucketSeconds: number;
    sampleCount: number;
    memoryTemperatureValue: Array<number | null>;
    frequencyValue: Array<number | null>;
    memoryFrequencyValue: Array<number | null>;
    date: Array<Date>;
    gpuValue: Array<number | null>;
    temperatureValue: Array<number | null>;
    powerTotal: Array<number | null>;
    powerUsed: Array<number | null>;
    powerPercent: Array<number | null>;
    memoryTotal: Array<number | null>;
    memoryUsed: Array<number | null>;
    memoryPercent: Array<number | null>;
    speedValue: Array<number | null>;
    processCount: Array<number | null>;
    gpuProcesses: Array<Array<GPUProcess>>;
}

export interface MonitorGPUOptions {
    supported: boolean;
    gpuType: string;
    options: Array<string>;
    chartHide: Array<ChartHide>;
}

export interface MonitorGPUSearch {
    aggregation?: 'avg' | 'max';
    deviceID?: string;
    legacy?: boolean;
    productName: string;
    startTime: Date;
    endTime: Date;
}


// AI / 模型 / MCP / Agent 能力已随 xpack 一并剔除。
// 这里保留少量返回空数据的本地桩，避免通用组件（GPU 配置、监控导出等）
// 因为引用已删除的 REST 接口而在运行时拿到 SPA 回退的 HTML。

export const getGPUOptions = async (_currentNode?: string) => ({
    data: { supported: false, chartHide: [] } as unknown as MonitorGPUOptions,
});

export const loadGPUMonitor = async (_param: MonitorGPUSearch, _currentNode?: string) => ({
    data: {} as unknown as MonitorGPUData,
});

export const loadModelGPUDevices = async (_currentNode?: string) => ({
    data: { devices: [], warnings: [], numaNodes: [] } as unknown as {
        devices: ModelGPUDevice[];
        warnings: string[];
        numaNodes: ModelNUMANode[];
    },
});

export const listGPUGroups = async (_currentNode?: string) => ({
    data: [] as GPUGroup[],
});

export const saveGPUGroup = async (_data: unknown) => ({
    data: undefined,
});

export const pageAgentAccounts = async (_req: AgentAccountSearch, _currentNode?: string) => ({
    data: { items: [], total: 0 } as unknown as { items: AgentAccountItem[]; total: number },
});
