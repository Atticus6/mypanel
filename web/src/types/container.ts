import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    BuildImageRequestSchema,
    ComposeContainerSchema,
    ComposeProjectSchema,
    ComposeTemplateSchema,
    ContainerItemStatsSchema,
    ContainerLimitSchema,
    ContainerSchema,
    ContainerStatsItemSchema,
    ContainerStatsSampleSchema,
    ContainerStatusSchema,
    CreateComposeTemplateRequestSchema,
    CreateImageRepoRequestSchema,
    CreateNetworkRequestSchema,
    CreateVolumeRequestSchema,
    DaemonJsonConfSchema,
    DockerStatusSchema,
    ImageInfoSchema,
    ImageRepoOptionSchema,
    NetworkSchema,
    OperateContainersRequestSchema,
    OperateComposeRequestSchema,
    PinComposeRequestSchema,
    PruneContainersRequestSchema,
    PullImagesRequestSchema,
    PushImageRequestSchema,
    RenameContainerRequestSchema,
    SearchContainersRequestSchema,
    SearchImagesRequestSchema,
    TagImageRequestSchema,
    UpdateComposeTemplateRequestSchema,
    UpdateDaemonJsonByFileRequestSchema,
    UpdateImageRepoRequestSchema,
    VolumeSchema,
} from '@/gen/panel/agent/v1/container_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

// 容器域 DTO 统一由 proto 生成类型派生；没有 proto 对应物的结构保留为本地 UI 类型。
// int64/uint64 字段在 proto 中是 bigint，这里统一改回展示层使用的 number。
export namespace Container {
    export type ContainerOperate = Init<typeof OperateContainersRequestSchema> & { taskID?: string };
    export type ContainerRename = Init<typeof RenameContainerRequestSchema>;

    export interface ContainerCommit {
        taskID: string;
        containerID: string;
        containerName: string;
        newImageName: string;
        comment: string;
        author: string;
        pause: boolean;
    }

    export type ContainerSearch = Init<typeof SearchContainersRequestSchema>;

    export type ContainerStatus = Init<typeof ContainerStatusSchema> & {
        containerUsage: number;
        containerReclaimable: number;
        imageUsage: number;
        imageReclaimable: number;
        volumeUsage: number;
        volumeReclaimable: number;
        buildCacheUsage: number;
        buildCacheReclaimable: number;
    };

    export interface ContainerOption {
        name: string;
        state: string;
    }

    export interface ContainerFileReq {
        containerID: string;
        path: string;
    }
    export interface ContainerFileInfo {
        name: string;
        path: string;
        isDir: boolean;
        isLink: boolean;
        linkTo: string;
        size: number;
        mode: string;
        modTime: string;
    }
    export interface ContainerFileContent {
        content: string;
        size: number;
        truncated: boolean;
        isBinary: boolean;
    }

    export type ResourceLimit = Omit<Init<typeof ContainerLimitSchema>, 'memory'> & { memory: number };

    export interface ContainerHelper {
        taskID: string;
        name: string;
        image: string;
        imageInput: boolean;
        forcePull: boolean;
        networks: Array<ContainerNetwork>;
        hostname: string;
        domainName: string;
        dns: Array<string>;
        cmdStr: string;
        entrypointStr: string;
        memoryItem: number;
        cmd: Array<string>;
        workingDir: string;
        user: string;
        openStdin: boolean;
        tty: boolean;
        entrypoint: Array<string>;
        publishAllPorts: boolean;
        exposedPorts: Array<Port>;
        nanoCPUs: number;
        cpuShares: number;
        memory: number;
        volumes: Array<Volume>;
        extraHosts: Array<ExtraHost>;
        privileged: boolean;
        autoRemove: boolean;
        labels: Array<string>;
        env: Array<string>;
        restartPolicy: string;
    }
    export interface ExtraHost {
        hostname: string;
        ip: string;
    }

    export interface ContainerUpgrade {
        taskID: string;
        names: Array<string>;
        image: string;
        forcePull: boolean;
    }
    export interface Port {
        host: string;
        hostIP: string;
        containerPort: string;
        hostPort: string;
        protocol: string;
    }
    export interface Volume {
        type: string;
        sourceDir: string;
        containerDir: string;
        mode: string;
    }

    export type ContainerInfo = Omit<Init<typeof ContainerSchema>, 'network'> & {
        containerID?: string;
        network: Array<ContainerNetwork>;
        hasLoad: boolean;
        cpuPercent: number;
        memoryPercent: number;
    };
    export interface ContainerNetwork {
        network: string;
        ipv4: string;
        ipv6: string;
        macAddr: string;
        links?: Array<string>;
        aliases?: Array<string>;
        driverOpts?: Record<string, string>;
        gwPriority?: number;
        linkLocalIPs?: Array<string>;
    }

    export type ContainerItemStats = Omit<
        Init<typeof ContainerItemStatsSchema>,
        | 'sizeRw'
        | 'sizeRootFs'
        | 'containerUsage'
        | 'containerReclaimable'
        | 'imageUsage'
        | 'imageReclaimable'
        | 'volumeUsage'
        | 'volumeReclaimable'
        | 'buildCacheUsage'
        | 'buildCacheReclaimable'
    > & {
        sizeRw: number;
        sizeRootFs: number;
        containerUsage: number;
        containerReclaimable: number;
        imageUsage: number;
        imageReclaimable: number;
        volumeUsage: number;
        volumeReclaimable: number;
        buildCacheUsage: number;
        buildCacheReclaimable: number;
    };

    export type ContainerListStats = Omit<
        Init<typeof ContainerStatsItemSchema>,
        'cpuTotalUsage' | 'systemUsage' | 'memoryCache' | 'memoryUsage' | 'memoryLimit'
    > & {
        containerID?: string;
        cpuTotalUsage: number;
        systemUsage: number;
        memoryCache: number;
        memoryUsage: number;
        memoryLimit: number;
    };

    export type ContainerStats = Init<typeof ContainerStatsSampleSchema> & {
        networkRX?: number;
        networkTX?: number;
    };

    export interface ContainerInspect {
        id: string;
        type: string;
        detail: string;
    }

    export type ContainerPrune = Init<typeof PruneContainersRequestSchema> & { taskID?: string };
    export interface ContainerPruneReport {
        deletedNumber: number;
        spaceReclaimed: number;
    }
    export interface Options {
        option: string;
    }

    export type ImageSearch = Init<typeof SearchImagesRequestSchema>;

    export type ImageInfo = Omit<Init<typeof ImageInfoSchema>, 'size'> & {
        size: number;
        name?: string;
    };
    export type ImageBuild = Init<typeof BuildImageRequestSchema> & { taskID?: string };
    export type ImagePull = Init<typeof PullImagesRequestSchema> & { taskID?: string; repoID?: number };
    export type ImageTag = Init<typeof TagImageRequestSchema> & { sourceID?: string };
    export type ImagePush = Init<typeof PushImageRequestSchema> & { taskID?: string; repoID?: number };

    export interface ImageLoad {
        taskID: string;
        paths: Array<string>;
    }
    export interface ImageSave {
        taskID: string;
        tagName: string;
        path: string;
        name: string;
    }

    export type NetworkInfo = Init<typeof NetworkSchema> & {
        expand: boolean;
    };
    export type NetworkCreate = Init<typeof CreateNetworkRequestSchema>;

    export type VolumeInfo = Omit<Init<typeof VolumeSchema>, 'labels'> & {
        labels: Array<string>;
        expand: boolean;
    };
    export type VolumeCreate = Init<typeof CreateVolumeRequestSchema>;

    export type RepoCreate = Init<typeof CreateImageRepoRequestSchema>;
    export type RepoUpdate = Init<typeof UpdateImageRepoRequestSchema>;
    // 页面把仓库行当作通用模板行传入弹窗，保留无 $typeName 的纯结构，避免跨消息类型不兼容。
    export interface RepoInfo {
        id: number;
        createdAt?: string;
        name: string;
        downloadUrl: string;
        protocol: string;
        username: string;
        password: string;
        auth: boolean;
    }
    export type RepoOptions = Init<typeof ImageRepoOptionSchema> & { downloadUrl?: string };

    export type ComposeInfo = Init<typeof ComposeProjectSchema> & { expand: boolean };
    export type ComposeContainer = Init<typeof ComposeContainerSchema>;

    export interface ComposeCreate {
        taskID: string;
        name: string;
        dirName: string;
        from: string;
        file: string;
        path: string;
        template: number;
        env: string;
        forcePull: boolean;
    }
    export type ComposeOperation = Init<typeof OperateComposeRequestSchema>;

    export interface ComposeUpdate {
        taskID: string;
        name: string;
        path: string;
        content: string;
        env: string;
        forcePull: boolean;
        createdBy: string;
    }
    export type ComposePin = Init<typeof PinComposeRequestSchema> & { isPinned?: boolean };

    export type TemplateCreate = Init<typeof CreateComposeTemplateRequestSchema>;
    export type TemplateUpdate = Init<typeof UpdateComposeTemplateRequestSchema>;
    export type TemplateInfo = Init<typeof ComposeTemplateSchema>;

    export interface BatchDelete {
        taskID: string;
        names: Array<string>;
    }

    export type DaemonJsonUpdateByFile = Init<typeof UpdateDaemonJsonByFileRequestSchema>;
    export type DockerStatus = Init<typeof DockerStatusSchema>;
    export type DaemonJsonConf = Init<typeof DaemonJsonConfSchema>;

    export interface ContainerLogInfo {
        container: string;
        since: string;
        tail: number;
        containerType: string;
    }
}
