import { File } from '@/types/file';
export interface FileAISearchReq {
    path: string;
    query: string;
    responseLanguage?: string;
    containSub?: boolean;
    maxItems?: number;
    matchCase?: boolean;
    wholeWord?: boolean;
    useRegex?: boolean;
    extensions?: string[];
    minSize?: number;
    maxSize?: number;
    modifiedAfter?: string;
    modifiedBefore?: string;
    maxScanFiles?: number;
    maxFileBytes?: number;
    maxHitsPerFile?: number;
    maxTotalHits?: number;
    contentHitsPromptMaxBytes?: number;
    llmMaxOutputTokens?: number;
}
export interface FileAIContentHit {
    path: string;
    line: number;
    text: string;
}
export interface FileAISearchResult {
    mode?: 'ai' | 'grep';
    summary: string;
    hits: FileAIContentHit[];
    contentScannedFiles: number;
    contentHitsTruncated: boolean;
    truncated: boolean;
    preFiltered: boolean;
    itemCount: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    duration: string;
}
import http, { type RequestConfig } from '@/api';
import { TimeoutEnum } from '@/enums/http-enum';

export type FileUploadRequestConfig = RequestConfig & {
    skipErrorMessage?: boolean;
};

// 以下接口是二进制、WebSocket 或 AI 通道，不迁移到 RPC：
// 上传/分块上传/下载需要流式传输，AI 搜索依赖模型服务。
// 文件 AI 搜索依赖模型服务，已随 AI 域剔除；返回空结果避免调用不存在的 REST。
export const fileAiSearch = async (_params: FileAISearchReq) => ({
    data: { hits: [], itemCount: 0, summary: '' } as unknown as FileAISearchResult,
});

export const uploadFileData = (params: FormData, config: FileUploadRequestConfig) => {
    return http.upload<File.File>('files/upload', params, config);
};

export const chunkUploadFileData = (params: FormData, config: FileUploadRequestConfig) => {
    return http.upload<File.File>('files/chunkupload', params, config);
};

export const stopChunkUpload = (key: string, currentNode?: string) => {
    return http.post(
        'files/chunkupload/stop',
        { key },
        undefined,
        currentNode ? { CurrentNode: currentNode } : undefined,
    );
};

export const downloadFile = (params: File.FileDownload) => {
    return http.download<BlobPart>('files/download', params, { responseType: 'blob', timeout: TimeoutEnum.T_40S });
};
