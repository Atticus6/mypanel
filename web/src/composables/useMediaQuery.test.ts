import { describe, expect, test } from 'bun:test';
import { createMediaQueryRef } from './useMediaQuery';

describe('createMediaQueryRef', () => {
    test('读取初始匹配结果', () => {
        const state = { matches: true };
        const mq = createMediaQueryRef('(min-width: 100px)', () => state);
        expect(mq.value).toBe(true);
    });

    test('监听 change 事件后更新值', () => {
        const state = { matches: false };
        let listener: (() => void) | undefined;
        const mq = createMediaQueryRef('(max-width: 10px)', () => ({
            get matches() {
                return state.matches;
            },
            addEventListener: (_type, fn) => {
                listener = fn;
            },
        }));
        expect(mq.value).toBe(false);
        state.matches = true;
        listener?.();
        expect(mq.value).toBe(true);
    });

    test('没有 matchMedia 时返回 false，不抛错', () => {
        expect(createMediaQueryRef('x', undefined).value).toBe(false);
    });
});
