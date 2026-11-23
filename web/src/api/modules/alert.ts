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

// 告警日志同步属于 xpack / 离线节点能力，社区版不提供；保留本地空操作避免调用不存在的 REST。
export const SyncAlertInfo = async (_req: { id: number }) => ({ data: undefined });
export const SyncAlertAll = async () => ({ data: undefined });
export const SyncOfflineAlert = async () => ({ data: undefined });
