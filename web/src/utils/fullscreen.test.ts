import { describe, expect, test } from 'bun:test';
import { isFullscreenActive, isFullscreenEnabled } from './fullscreen';

describe('全屏状态判定', () => {
    test('浏览器不支持或未启用时返回 false', () => {
        expect(isFullscreenEnabled(null)).toBe(false);
        expect(isFullscreenActive(null)).toBe(false);
        expect(isFullscreenEnabled({ fullscreenEnabled: false } as Document)).toBe(false);
    });

    test('根据 fullscreenElement 判断是否处于全屏', () => {
        const doc = { fullscreenEnabled: true, fullscreenElement: null } as Document;
        expect(isFullscreenEnabled(doc)).toBe(true);
        expect(isFullscreenActive(doc)).toBe(false);
        doc.fullscreenElement = {} as Element;
        expect(isFullscreenActive(doc)).toBe(true);
    });
});
