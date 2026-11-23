import { describe, expect, test } from 'bun:test';
import { create } from '@bufbuild/protobuf';

import { DashboardBaseSchema, DashboardCurrentSchema } from '@/gen/panel/agent/v1/dashboard_pb';
import { toHomeBaseInfo, toHomeCurrentInfo, toPlainNumbers } from './dashboard';

describe('toPlainNumbers', () => {
    test('bigint 转成 number', () => {
        expect(toPlainNumbers({ total: 10n })).toEqual({ total: 10 });
    });

    test('递归处理嵌套对象与数组', () => {
        expect(toPlainNumbers({ items: [{ size: 3n }, { size: 4n }] })).toEqual({
            items: [{ size: 3 }, { size: 4 }],
        });
    });

    test('普通字符串与布尔值保持不变', () => {
        expect(toPlainNumbers({ name: 'a', ok: true })).toEqual({ name: 'a', ok: true });
    });
});

describe('toHomeBaseInfo', () => {
    test('把 quickJumps 映射成页面使用的 quickJump，并补齐 httpProxy', () => {
        const base = create(DashboardBaseSchema, {
            hostname: 'demo',
            systemProxy: 'noProxy',
            cpuCores: 4,
            quickJumps: [{ id: 1, name: 'app', title: '应用' }],
        });

        const view = toHomeBaseInfo(base);
        expect(view.hostname).toBe('demo');
        expect(view.httpProxy).toBe('noProxy');
        expect(view.quickJump).toHaveLength(1);
        expect(view.quickJump[0].name).toBe('app');
    });

    test('uint64 字段在视图层是 number，可直接参与运算', () => {
        const base = create(DashboardBaseSchema, {
            currentInfo: { uptime: 3600n, memoryTotal: 8n * 1024n * 1024n * 1024n },
        });

        const view = toHomeBaseInfo(base);
        expect(typeof view.currentInfo.uptime).toBe('number');
        expect(view.currentInfo.uptime + 1).toBe(3601);
        expect(typeof view.currentInfo.memoryTotal).toBe('number');
    });
});

describe('toHomeCurrentInfo', () => {
    test('缺失 runningTime 时补齐默认值，避免旧页面读取 undefined', () => {
        const current = create(DashboardCurrentSchema, { uptime: 10n });
        const view = toHomeCurrentInfo(current);
        expect(view.runningTime).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        expect(view.shotTime).toBeInstanceOf(Date);
    });

    test('shotTime 转成 Date，保留采样时间语义', () => {
        const current = create(DashboardCurrentSchema, {
            shotTime: '2026-11-22T10:00:00+08:00',
            netBytesSent: 2048n,
        });
        const view = toHomeCurrentInfo(current);
        expect(view.shotTime.toISOString()).toBe('2026-11-22T02:00:00.000Z');
        expect(view.netBytesSent).toBe(2048);
    });
});
