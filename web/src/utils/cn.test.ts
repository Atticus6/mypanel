import { describe, expect, test } from 'bun:test';
import { cn } from './cn';

describe('cn 类名合并', () => {
    test('普通字符串原样透传', () => {
        expect(cn('p-2', 'text-red-500')).toBe('p-2 text-red-500');
    });

    test('忽略假值条件类', () => {
        expect(cn('p-2', false && 'text-red-500', undefined, null, '')).toBe('p-2');
    });

    test('合并冲突的 Tailwind 原子类，保留最后一个', () => {
        expect(cn('p-2', 'p-4')).toBe('p-4');
        expect(cn('text-red-500', true && 'text-blue-500')).toBe('text-blue-500');
    });

    test('支持对象与数组形式的条件类', () => {
        expect(cn({ 'font-bold': true, hidden: false }, ['flex', 'gap-2'])).toBe('font-bold flex gap-2');
    });
});
