import { describe, expect, test } from 'bun:test';

import { normalizeInput, toFormPath } from './create-rpc';

describe('normalizeInput', () => {
    test('字段顺序不同但内容相同应得到相同结果', () => {
        expect(normalizeInput({ page: 1, pageSize: 20 })).toEqual(normalizeInput({ pageSize: 20, page: 1 }));
    });

    test('去掉 undefined 字段，避免同一语义产生两个缓存键', () => {
        expect(normalizeInput({ page: 1, name: undefined })).toEqual({ page: 1 });
    });

    test('递归排序嵌套对象并保留数组顺序', () => {
        expect(normalizeInput({ filter: { b: 2, a: 1 }, ids: [3, 1] })).toEqual({
            filter: { a: 1, b: 2 },
            ids: [3, 1],
        });
    });

    test('bigint 转成字符串，便于序列化进缓存键', () => {
        expect(normalizeInput({ total: 10n })).toEqual({ total: '10' });
    });
});

describe('toFormPath', () => {
    test('数组下标转成 Element Plus 的点号写法', () => {
        expect(toFormPath('items[0].port')).toBe('items.0.port');
    });

    test('普通字段原样返回', () => {
        expect(toFormPath('domain')).toBe('domain');
    });

    test('多层数组全部转换', () => {
        expect(toFormPath('groups[1].items[0].name')).toBe('groups.1.items.0.name');
    });
});
