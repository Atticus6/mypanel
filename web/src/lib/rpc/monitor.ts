import type { MonitorSeries } from '@/gen/panel/agent/v1/monitor_pb';

/**
 * 监控图表的视图模型。
 *
 * proto 把三类采样（基础负载、磁盘 IO、网络）拆成独立字段，
 * 页面则沿用 1Panel 的 `{ param, date, value }` 结构。这里在视图边界做一次合并，
 * 页面里的 `item.value` 用法不需要跟着改。
 */
export interface MonitorChartSeries {
    param: string;
    date: string[];
    value: unknown[];
}

/**
 * 把 proto 序列转换成图表序列。
 *
 * 依据 param 选择对应的数组；未知 param 返回空 value，
 * 避免页面拿到 undefined 后再去 map。
 */
export function toMonitorChartSeries(series: MonitorSeries): MonitorChartSeries {
    const param = series.param;
    let value: unknown[] = [];
    if (param === 'base') {
        value = series.base.map((item) => ({
            cpu: item.cpu,
            memory: item.memory,
            loadUsage: item.loadUsage,
            cpuLoad1: item.cpuLoad1,
            cpuLoad5: item.cpuLoad5,
            cpuLoad15: item.cpuLoad15,
            topCPUItems: item.topCpuItems.map(toProcess),
            topMemItems: item.topMemItems.map(toProcess),
        }));
    } else if (param === 'io') {
        value = series.io.map((item) => ({
            name: item.name,
            read: Number(item.read),
            write: Number(item.write),
            count: Number(item.count),
            time: Number(item.time),
        }));
    } else if (param === 'network') {
        value = series.network.map((item) => ({
            name: item.name,
            up: item.up,
            down: item.down,
        }));
    }
    return { param, date: [...series.dates], value };
}

function toProcess(item: { name: string; pid: number; percent: number; memory: bigint; cmd: string; user: string }) {
    return {
        name: item.name,
        pid: item.pid,
        percent: item.percent,
        memory: Number(item.memory),
        cmd: item.cmd,
        user: item.user,
    };
}
