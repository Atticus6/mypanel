import router from '@/routers';
import { TabsStore } from '@/store';
import { hasRouteAccess } from '@/utils/rbac';
import i18n from '@/lang';
import { MsgError } from '@/utils/message';
import type { LocationQueryRaw, RouteLocationAsString, RouteLocationRaw, Router } from 'vue-router';
import type { RouteNamedMap } from 'vue-router/auto-routes';
import { panelCacheKey, readPanelCache, removePanelCache } from '@/utils/panel-cache';

// 路由名、参数都取自文件路由生成的映射表，拼错名字或漏传参数会在编译期报错。
export type RouteName = Extract<keyof RouteNamedMap, string>;
type RouteParams<Name extends RouteName> = RouteNamedMap[Name]['paramsRaw'];

const pushWithAccessCheck = async (to: RouteLocationRaw) => {
    const resolvedRoute = router.resolve(to);
    if (!hasRouteAccess(resolvedRoute)) {
        MsgError(i18n.global.t('commons.res.forbidden'));
        return;
    }
    await router.push(to);
    tabStoreMiddleWare();
};

/** Explicit navigation always opens the requested page, independent of tab caching. */
export const openPage = pushWithAccessCheck;

/** Only module-menu entry points restore the last visited route within that module. */
export const openMenu = async (to: RouteLocationRaw) => {
    let entry = router.resolve(to);
    const visited = new Set<string>();
    // Menu roots often redirect and only their destination declares activeMenu.
    while (!visited.has(entry.fullPath)) {
        visited.add(entry.fullPath);
        const redirect = entry.matched[entry.matched.length - 1]?.redirect;
        if (!redirect) break;
        entry = router.resolve(typeof redirect === 'function' ? redirect(entry, router.currentRoute.value) : redirect);
    }
    const menu = entry.meta.activeMenu;
    if (menu) {
        const key = panelCacheKey(String(menu));
        const cached = readPanelCache<unknown>('tabs', key);
        if (typeof cached === 'string') {
            const destination = router.resolve(cached);
            if (destination.matched.length && destination.meta.activeMenu === menu && hasRouteAccess(destination)) {
                return openPage(cached);
            }
        }
        if (cached !== undefined) removePanelCache('tabs', key);
    }
    return openPage(to);
};

// RouteLocationRaw 是按路由名展开的联合类型，TS 无法把联合的 name 收窄到单个成员；
// 入口参数已由 RouteName 约束，这里只在内部做一次断言。
export const routerToName = async (name: RouteName) => {
    await openPage({ name } as RouteLocationRaw);
};

export const routerToPath = async (path: RouteLocationAsString) => {
    await openPage({ path });
};

export const routerToFileWithPath = async (pathItem: string) => {
    await openPage({ name: 'File', query: { path: pathItem, uncached: 'true' } });
};

export const routerToNameWithQuery = async (name: RouteName, query: LocationQueryRaw) => {
    await openPage({ name, query } as RouteLocationRaw);
};

export const routerToPathWithQuery = async (path: RouteLocationAsString, query: LocationQueryRaw) => {
    await openPage({ path, query });
};

export const jumpToPath = (_router: Router, path: RouteLocationAsString) => {
    routerToPathWithQuery(path, { uncached: 'true' });
};

export const routerToNameWithParams = async <Name extends RouteName>(name: Name, params: RouteParams<Name>) => {
    await openPage({ name, params } as RouteLocationRaw);
};

/** 扩展包在运行时注册路由，OSS 侧没有对应文件，显式收口以免绕过主路由的类型检查。 */
export const routerToExtensionName = async (name: string, query?: LocationQueryRaw) => {
    await openPage({ name, query } as RouteLocationRaw);
};

const tabStoreMiddleWare = () => {
    try {
        let route = router.currentRoute;
        if (route.value.meta.ignoreTab) {
            return;
        }
        const tabsStore = TabsStore();
        tabsStore.addTab(route.value);
        tabsStore.activeTabPath = route.value?.path;
    } catch (error) {}
};
