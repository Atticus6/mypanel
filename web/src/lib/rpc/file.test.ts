import { describe, expect, test } from 'bun:test';
import { create } from '@bufbuild/protobuf';

import { FileEntrySchema, FileListSchema } from '@/gen/panel/agent/v1/file_pb';
import { toFileEntryView, toFileListView } from './file';

describe('toFileEntryView', () => {
    test('int64 的 size 转成 number，并映射 favoriteID', () => {
        const entry = create(FileEntrySchema, {
            name: 'a.txt',
            size: 2048n,
            favoriteId: 7,
            isDir: false,
        });
        const view = toFileEntryView(entry);
        expect(view.size).toBe(2048);
        expect(view.favoriteID).toBe(7);
        expect(view.isDir).toBe(false);
    });

    test('递归转换子条目', () => {
        const entry = create(FileEntrySchema, {
            name: 'root',
            isDir: true,
            items: [{ name: 'child', size: 3n }],
        });
        const view = toFileEntryView(entry);
        expect(view.items).toHaveLength(1);
        expect(view.items[0].size).toBe(3);
    });
});

describe('toFileListView', () => {
    test('itemTotal 转成 number 并保留追加写标记', () => {
        const list = create(FileListSchema, {
            path: '/tmp',
            name: 'tmp',
            itemTotal: 12,
            isAppendOnly: true,
            items: [{ name: 'a.txt', size: 1n }],
        });
        const view = toFileListView(list);
        expect(view.itemTotal).toBe(12);
        expect(view.isAppendOnly).toBe(true);
        expect(view.items[0].size).toBe(1);
    });
});
