import http from '@/api';
import type { AxiosRequestConfig } from 'axios';
import { ResPage, SearchWithPage } from '../interface';
import { Container } from '../interface/container';
import { TimeoutEnum } from '@/enums/http-enum';

export const searchContainer = (params: Container.ContainerSearch, currentNode?: string, signal?: AbortSignal) => {
    return http.postWithConfig<ResPage<Container.ContainerInfo>>(`/containers/search`, params, {
        timeout: TimeoutEnum.T_40S,
        headers: currentNode ? { CurrentNode: currentNode } : undefined,
        signal,
    });
};
export const listContainerFiles = (params: Container.ContainerFileReq) => {
    return http.post<Array<Container.ContainerFileInfo>>(`/containers/files/search`, params, TimeoutEnum.T_40S);
};
export const uploadContainerFile = (params: FormData, config?: AxiosRequestConfig & { skipErrorMessage?: boolean }) => {
    return http.upload(`/containers/files/upload`, params, {
        timeout: TimeoutEnum.T_5M,
        ...config,
        headers: { 'Content-Type': 'multipart/form-data', ...config?.headers },
    });
};
export const getContainerFileContent = (params: Container.ContainerFileReq) => {
    return http.post<Container.ContainerFileContent>(`/containers/files/content`, params, TimeoutEnum.T_40S);
};
export const getContainerFileSize = (params: Container.ContainerFileReq) => {
    return http.post<number>(`/containers/files/size`, params, TimeoutEnum.T_40S);
};
export const deleteContainerFile = (params: { containerID: string; paths: string[] }) => {
    return http.post(`/containers/files/del`, params, TimeoutEnum.T_40S);
};
export const downloadContainerFile = (params: { containerID: string; path: string }) => {
    return http.download<BlobPart>(`/containers/files/download`, params, {
        responseType: 'blob',
        timeout: TimeoutEnum.T_40S,
    });
};
export const loadContainerStatus = (currentNode?: string, containersOnly = false, signal?: AbortSignal) => {
    return http.get<Container.ContainerStatus>(`/containers/status`, containersOnly ? { containersOnly: true } : {}, {
        headers: currentNode ? { CurrentNode: currentNode } : undefined,
        signal,
    });
};
export const createContainer = (params: Container.ContainerHelper) => {
    return http.post(`/containers`, params, TimeoutEnum.T_10M);
};
export const updateContainer = (params: Container.ContainerHelper) => {
    return http.post(`/containers/update`, params, TimeoutEnum.T_10M);
};
export const upgradeContainer = (params: Container.ContainerUpgrade, node?: string) => {
    return http.post(`/containers/upgrade`, params, TimeoutEnum.T_10M, node ? { CurrentNode: node } : undefined);
};
export const commitContainer = (params: Container.ContainerCommit) => {
    return http.post(`/containers/commit`, params);
};
export const loadContainerInfo = (name: string) => {
    return http.post<Container.ContainerHelper>(`/containers/info`, { name: name });
};
export const inspect = (params: Container.ContainerInspect) => {
    return http.post<string>(`/containers/inspect`, params);
};

export const DownloadFile = (params: Container.ContainerLogInfo) => {
    return http.download<BlobPart>('/containers/download/log', params, {
        responseType: 'blob',
        timeout: TimeoutEnum.T_5M,
    });
};

// image
export const searchImage = (params: Container.ImageSearch, currentNode?: string) => {
    return http.post<ResPage<Container.ImageInfo>>(
        `/containers/image/search`,
        params,
        TimeoutEnum.T_60S,
        currentNode ? { CurrentNode: currentNode } : undefined,
    );
};
export const listAllImage = () => {
    return http.get<Array<Container.ImageInfo>>(`/containers/image/all`);
};
export const listImage = () => {
    return http.get<Array<Container.Options>>(`/containers/image`);
};
export const imageLoad = (params: Container.ImageLoad, currentNode?: string) => {
    return http.post(
        `/containers/image/load`,
        params,
        TimeoutEnum.T_10M,
        currentNode ? { CurrentNode: currentNode } : undefined,
    );
};
export const imageSave = (params: Container.ImageSave) => {
    return http.post(`/containers/image/save`, params, TimeoutEnum.T_10M);
};

// network
export const searchNetwork = (params: SearchWithPage) => {
    return http.post<ResPage<Container.NetworkInfo>>(`/containers/network/search`, params);
};

// volume
export const searchVolume = (params: SearchWithPage) => {
    return http.post<ResPage<Container.VolumeInfo>>(`/containers/volume/search`, params);
};

// repo
export const searchImageRepo = (params: SearchWithPage) => {
    return http.post<ResPage<Container.RepoInfo>>(`/containers/repo/search`, params);
};

// composeTemplate
export const searchComposeTemplate = (params: SearchWithPage) => {
    return http.post<ResPage<Container.TemplateInfo>>(`/containers/template/search`, params);
};

// compose
export const searchCompose = (params: SearchWithPage) => {
    return http.post<ResPage<Container.ComposeInfo>>(`/containers/compose/search`, params);
};
export const upCompose = (params: Container.ComposeCreate) => {
    return http.post<string>(`/containers/compose`, params);
};
export const composeUpdate = (params: Container.ComposeUpdate) => {
    return http.post(`/containers/compose/update`, params, TimeoutEnum.T_10M);
};

// docker
export const loadDaemonJsonFile = () => {
    return http.get<string>(`/containers/daemonjson/file`);
};

export interface RemoteImage {
    name: string;
    description: string;
}

export interface ContainerImageCheckUpdateStatus {
    taskID: string;
    enabled: boolean;
    running: boolean;
    checked: number;
    updates: number;
    failed: number;
    skipped: number;
    error: string;
    finishedAt: number;
}
export const getContainerImageCheckUpdateStatus = (node: string, signal?: AbortSignal) =>
    http.get<ContainerImageCheckUpdateStatus>(
        '/containers/image-updates',
        {},
        { headers: { CurrentNode: node }, signal },
    );
export const runContainerImageCheckUpdate = (node: string) =>
    http.postWithConfig<ContainerImageCheckUpdateStatus>(
        '/containers/image-updates/check',
        {},
        { headers: { CurrentNode: node } },
    );
export const setContainerImageCheckUpdateSchedule = (enabled: boolean, node: string) =>
    http.postWithConfig<ContainerImageCheckUpdateStatus>(
        '/containers/image-updates/schedule',
        { enabled },
        { headers: { CurrentNode: node } },
    );
