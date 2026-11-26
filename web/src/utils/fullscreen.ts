/** 浏览器全屏 API 的薄封装，避免依赖第三方库。 */

const currentDocument = () => (typeof document === 'undefined' ? null : document);

export const isFullscreenEnabled = (doc: Document | null = currentDocument()): boolean => !!doc?.fullscreenEnabled;

export const isFullscreenActive = (doc: Document | null = currentDocument()): boolean => !!doc?.fullscreenElement;

export async function requestFullscreen(target?: Element): Promise<void> {
    const doc = currentDocument();
    if (!doc?.fullscreenEnabled) return;
    await (target ?? doc.documentElement).requestFullscreen();
}

export async function exitFullscreen(): Promise<void> {
    const doc = currentDocument();
    if (doc?.fullscreenElement) await doc.exitFullscreen();
}

export async function toggleFullscreen(): Promise<void> {
    if (isFullscreenActive()) await exitFullscreen();
    else await requestFullscreen();
}

/** 注册全屏状态变化监听，返回取消注册函数。 */
export function onFullscreenChange(callback: () => void): () => void {
    const doc = currentDocument();
    doc?.addEventListener('fullscreenchange', callback);
    return () => doc?.removeEventListener('fullscreenchange', callback);
}

export const fullscreen = {
    get isEnabled() {
        return isFullscreenEnabled();
    },
    get isFullscreen() {
        return isFullscreenActive();
    },
    request: requestFullscreen,
    exit: exitFullscreen,
    toggle: toggleFullscreen,
    onChange: onFullscreenChange,
};
