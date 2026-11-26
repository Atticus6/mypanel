import { describe, expect, test } from 'bun:test';
import { ref } from 'vue';
import { createElementSizeRef } from './useElementSize';

class FakeObserver {
    static callback: () => void = () => {};
    observed = 0;
    disconnected = 0;

    constructor(callback: () => void) {
        FakeObserver.callback = callback;
    }

    observe() {
        this.observed++;
    }

    disconnect() {
        this.disconnected++;
    }
}

const makeElement = (width: number, height: number) =>
    ({ getBoundingClientRect: () => ({ width, height }) }) as unknown as Element;

describe('createElementSizeRef', () => {
    test('初始测量元素宽高', () => {
        const target = ref<Element | undefined>(makeElement(120, 40));
        const { width, height } = createElementSizeRef(target, FakeObserver);
        expect(width.value).toBe(120);
        expect(height.value).toBe(40);
    });

    test('观察到尺寸变化时更新', () => {
        const element = makeElement(10, 20);
        const target = ref<Element | undefined>(element);
        const { width, height } = createElementSizeRef(target, FakeObserver);
        (element.getBoundingClientRect as () => DOMRect) = () => ({ width: 200, height: 80 }) as DOMRect;
        FakeObserver.callback();
        expect(width.value).toBe(200);
        expect(height.value).toBe(80);
    });

    test('没有 ResizeObserver 时宽高保持 0', () => {
        const { width, height } = createElementSizeRef(ref(makeElement(5, 5)), undefined);
        expect(width.value).toBe(0);
        expect(height.value).toBe(0);
    });
});
