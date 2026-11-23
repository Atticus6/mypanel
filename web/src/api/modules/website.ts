import http from '@/api';
import { Website } from '../interface/website';
import { File } from '../interface/file';
import { TimeoutEnum } from '@/enums/http-enum';

// 以下接口是二进制上传/下载通道，保留 HTTP 实现，不迁移到 RPC。
export const uploadSSL = (req: Website.SSLUpload) => {
    return http.post<any>(`/websites/ssl/upload`, req);
};

export const uploadSSLFile = (params: FormData) => {
    return http.upload<File.File>(`/websites/ssl/upload/file`, params, {});
};

export const downloadFile = (params: Website.SSLDownload) => {
    return http.download<BlobPart>(`/websites/ssl/download`, params, {
        responseType: 'blob',
        timeout: TimeoutEnum.T_40S,
    });
};

export const downloadCAFile = (params: Website.SSLDownload) => {
    return http.download<BlobPart>(`/websites/ca/download`, params, {
        responseType: 'blob',
        timeout: TimeoutEnum.T_40S,
    });
};

export const uploadCA = (params: FormData) => {
    return http.upload(`/websites/ca/upload`, params);
};
