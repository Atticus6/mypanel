import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue';

type SizeTarget = Element | undefined | null;
type ObserverLike = {
    observe: (target: Element) => void;
    disconnect: () => void;
};
type ObserverCtor = new (callback: () => void) => ObserverLike;

/** 跟踪元素尺寸，ResizeObserver 由调用方注入，便于测试。 */
export function createElementSizeRef(target: Ref<SizeTarget>, ResizeObserverImpl?: ObserverCtor) {
    const width = ref(0);
    const height = ref(0);
    let observer: ObserverLike | undefined;

    const measure = (element: Element) => {
        const rect = element.getBoundingClientRect();
        width.value = rect.width;
        height.value = rect.height;
    };

    const stop = watch(
        target,
        (element) => {
            observer?.disconnect();
            observer = undefined;
            if (!element || typeof ResizeObserverImpl !== 'function') return;
            measure(element);
            observer = new ResizeObserverImpl(() => measure(element));
            observer.observe(element);
        },
        { immediate: true, flush: 'post' },
    );

    if (getCurrentScope()) {
        onScopeDispose(() => {
            stop();
            observer?.disconnect();
        });
    }
    return { width, height };
}

/** 元素宽高随布局变化更新。 */
export const useElementSize = (target: Ref<SizeTarget>) =>
    createElementSizeRef(target, typeof ResizeObserver !== 'undefined' ? ResizeObserver : undefined);
