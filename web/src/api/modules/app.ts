import http from '@/api';
import { App } from '../interface/app';
import { resolveAppIconUrl } from '@/utils/app-icon';

// 应用图标是二进制响应（PNG 或 302），保留 HTTP 通道。
export function getAppIconUrl(appKey: string, node?: string, icon = ''): string {
    const baseURL = import.meta.env.VITE_API_URL as string;
    return resolveAppIconUrl(appKey, node, icon, baseURL);
}

// 以下接口属于 xpack / 企业版能力，社区版后端未开放，保留原样以免改动相关 UI 分支。
export const syncCutomAppStore = (req: App.AppStoreSync) => {
    return http.post(`/custom/app/sync`, req);
};

export const getCurrentNodeCustomAppConfig = () => {
    return http.get<App.CustomAppStoreConfig>(`/custom/app/config`);
};

export const installAppToNodes = (param: App.InstallAppToNodes) => {
    return http.post(`/core/xpack/sync/app/install`, param);
};

export const getLocalAppSyncConfig = () => {
    return http.get<App.LocalAppSyncConfig>('/core/xpack/settings/app/local-sync');
};

export const updateLocalAppSyncConfig = (config: App.LocalAppSyncConfig) => {
    return http.post('/core/xpack/settings/app/local-sync', config);
};

export const dispatchLocalAppSync = (req: App.AppStoreSync) => {
    return http.post('/core/xpack/settings/app/local-sync/dispatch', req);
};
