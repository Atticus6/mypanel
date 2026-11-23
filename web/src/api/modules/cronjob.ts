import http from '@/api';
import { TimeoutEnum } from '@/enums/http-enum';

// 计划任务导出返回文件流，保留 HTTP 二进制通道。
export const exportCronjob = (params: { ids: Array<number> }) => {
    return http.download<BlobPart>('cronjobs/export', params, { responseType: 'blob', timeout: TimeoutEnum.T_40S });
};
