import http from '@/api';
import { GlobalStore } from '@/store';

const alertConfigHiddenTypes = ['sms'];

// 计算排除的通知配置类型；社区版与国际版不展示短信通道。
export const resolveAlertConfigExcludeTypes = (excludeTypes: string[] = []): string[] => {
    const globalStore = GlobalStore();
    const types = new Set(excludeTypes);
    if (globalStore.isIntl || globalStore.isEE || !globalStore.isProductPro) {
        alertConfigHiddenTypes.forEach((type) => types.add(type));
    }
    return Array.from(types);
};

// 以下接口属于 xpack / 企业版能力，社区版后端未开放，保留原样以免改动相关 UI 分支。
export const SyncAlertInfo = (req: { id: number }) => {
    return http.post<any>(`/xpack/alert/logs/sync`, req);
};

export const SyncAlertAll = () => {
    return http.post<any>(`/xpack/alert/logs/sync/all`);
};

export const SyncOfflineAlert = () => {
    return http.post<any>(`/core/xpack/alert/offline/sync`);
};
