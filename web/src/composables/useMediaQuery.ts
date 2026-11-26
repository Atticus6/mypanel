import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue';

/** matchMedia 的最小依赖面，便于注入假实现做测试。 */
type MediaQueryListLike = {
    matches: boolean;
    addEventListener?: (type: 'change', listener: () => void) => void;
    removeEventListener?: (type: 'change', listener: () => void) => void;
};
type MatchMedia = (query: string) => MediaQueryListLike;

/** 创建响应式媒体查询，matchMedia 由调用方注入。 */
export function createMediaQueryRef(query: string, matchMedia: MatchMedia | undefined): Ref<boolean> {
    const matches = ref(false);
    if (typeof matchMedia !== 'function') return matches;

    const list = matchMedia(query);
    const update = () => {
        matches.value = list.matches;
    };
    update();
    list.addEventListener?.('change', update);

    if (getCurrentScope()) {
        onScopeDispose(() => list.removeEventListener?.('change', update));
    }
    return matches;
}

/** 跟随 CSS 媒体查询变化的布尔值。 */
export const useMediaQuery = (query: string): Ref<boolean> =>
    createMediaQueryRef(query, typeof window !== 'undefined' ? (q) => window.matchMedia(q) : undefined);
