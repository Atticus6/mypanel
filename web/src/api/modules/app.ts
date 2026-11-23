import { App } from '../../types/app';
import { resolveAppIconUrl } from '@/utils/app-icon';

// 应用图标是二进制响应（PNG 或 302），保留 HTTP 通道。
export function getAppIconUrl(appKey: string, node?: string, icon = ''): string {
    const baseURL = import.meta.env.VITE_API_URL as string;
    return resolveAppIconUrl(appKey, node, icon, baseURL);
}

// 自定义应用商店与本地同步属于 xpack 能力，社区版不提供；保留本地空操作以免调用不存在的 REST。
export const syncCutomAppStore = async (_req: App.AppStoreSync) => ({ message: '' });
export const getCurrentNodeCustomAppConfig = async () => ({ data: { status: 'Disable', imagePrefix: '' } });
export const installAppToNodes = async (_param: App.InstallAppToNodes) => ({ data: undefined });
export const getLocalAppSyncConfig = async () => ({ data: { enabled: false } });
export const updateLocalAppSyncConfig = async (_config: App.LocalAppSyncConfig) => ({ data: undefined });
export const dispatchLocalAppSync = async (_req: App.AppStoreSync) => ({ data: undefined });
