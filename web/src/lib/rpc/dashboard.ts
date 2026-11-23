import type { DashboardBase, DashboardCurrent } from '@/gen/panel/agent/v1/dashboard_pb';

/**
 * 把 protobuf 消息里的 bigint 递归转成 number。
 *
 * proto 的 uint64 在 protobuf-es 里是 bigint，而首页图表、格式化函数都按
 * number 运算。这里只在视图边界做一次转换，不改变协议本身的精度语义。
 */
export type Numberized<T> = T extends bigint
    ? number
    : T extends (infer U)[]
      ? Numberized<U>[]
      : T extends object
        ? { [K in keyof T]: Numberized<T[K]> }
        : T;

export function toPlainNumbers<T>(value: T): Numberized<T> {
    if (typeof value === 'bigint') {
        return Number(value) as unknown as Numberized<T>;
    }
    if (Array.isArray(value)) {
        return value.map((item) => toPlainNumbers(item)) as unknown as Numberized<T>;
    }
    if (value && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            result[key] = toPlainNumbers(item);
        }
        return result as Numberized<T>;
    }
    return value as Numberized<T>;
}

/**
 * 首页基础信息的视图模型。
 *
 * 字段名沿用 1Panel 现有页面（quickJump/currentInfo），
 * 让页面与子组件不需要同时改动；协议里仍然使用 proto 的命名。
 */
export function toHomeBaseInfo(base: DashboardBase) {
    return {
        ...toPlainNumbers(base),
        // 旧页面用 httpProxy 字段名，协议里叫 system_proxy。
        httpProxy: base.systemProxy,
        quickJump: base.quickJumps.map((item) => ({ ...toPlainNumbers(item) })),
        currentInfo: toHomeCurrentInfo(base.currentInfo),
    };
}

/**
 * 首页当前负载的视图模型。
 *
 * gpu/npu/xpu 与 top 进程属于独立的采集接口，尚未迁移的页面仍按原来的
 * 空数组处理，避免模板里出现 undefined。
 */
export function toHomeCurrentInfo(current?: DashboardCurrent) {
    // 字段缺失时用空对象兜底，保证返回类型始终一致。
    const data = toPlainNumbers(current ?? ({} as DashboardCurrent));
    return {
        ...data,
        // 旧页面对 shotTime 做 Date 运算，这里统一转成 Date。
        shotTime: data.shotTime ? new Date(data.shotTime) : new Date(0),
        runningTime: data.runningTime ?? { days: 0, hours: 0, minutes: 0, seconds: 0 },
        gpuData: [],
        npuData: [],
        xpuData: [],
        topCPUItems: [],
        topMemItems: [],
    };
}
