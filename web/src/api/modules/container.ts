import http, { type RequestConfig } from '@/api';
import { Container } from '../../types/container';
import { TimeoutEnum } from '@/enums/http-enum';

// 以下接口是二进制流、WebSocket 相关或已剔除能力的通道，保留 HTTP 实现。
export const listContainerFiles = (params: Container.ContainerFileReq) => {
    return http.post<Array<Container.ContainerFileInfo>>(`/containers/files/search`, params, TimeoutEnum.T_40S);
};

export const uploadContainerFile = (params: FormData, config?: RequestConfig & { skipErrorMessage?: boolean }) => {
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

export const DownloadFile = (params: Container.ContainerLogInfo) => {
    return http.download<BlobPart>('/containers/download/log', params, {
        responseType: 'blob',
        timeout: TimeoutEnum.T_5M,
    });
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

export const loadDaemonJsonFile = () => {
    return http.get<string>(`/containers/daemonjson/file`);
};

export interface RemoteImage {
    name: string;
    description: string;
}
