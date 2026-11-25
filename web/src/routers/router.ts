import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { routes as generatedRoutes } from 'vue-router/auto-routes';
import { GlobalStore } from '@/store';

// 由 src/pages 下的文件生成路由；这里的职责只剩两类无法写进 definePage 的调整：
// 1. 带 store 判断的函数式重定向；2. 菜单排序与 catch-all。

const redirectToAvailableSetting = () => {
    const globalStore = GlobalStore();
    if (globalStore.isAdmin) {
        return '/settings/panel';
    }
    if (globalStore.hasPermission('alert_view')) {
        return '/settings/alert';
    }
    if (globalStore.hasPermission('backup_view')) {
        return '/settings/backupaccount';
    }
    return '/settings/apikeys';
};

// definePage 只接受静态字面量，设置模块的动态重定向在运行时补回。
const applyRuntimeRedirects = (records: RouteRecordRaw[]): void => {
    for (const record of records) {
        if (record.name === 'Setting-Menu' || record.name === 'Setting') {
            record.redirect = redirectToAvailableSetting;
        }
        if (Array.isArray(record.children)) {
            applyRuntimeRedirects(record.children as RouteRecordRaw[]);
        }
    }
};

// 生成的路由是只读的，这里复制一份供运行时补正。
const mutableRoutes = [...generatedRoutes] as unknown as RouteRecordRaw[];
applyRuntimeRedirects(mutableRoutes);

// 菜单模块按 meta.sort 排序；sort 由各分组首页的 definePage 声明。
export const rolesRoutes: RouteRecordRaw[] = mutableRoutes
    .filter((route) => typeof route.meta?.sort === 'number')
    .sort((a, b) => (a.meta?.sort as number) - (b.meta?.sort as number));

export const routerArray: RouteRecordRaw[] = rolesRoutes;

// 侧栏只展示未标记 meta.hidden 的直接子路由。
export const menuList: RouteRecordRaw[] = [];
rolesRoutes.forEach((item) => {
    const menuItem = JSON.parse(JSON.stringify(item));
    menuItem.children = (Array.isArray(menuItem.children) ? menuItem.children : []).filter(
        (child: RouteRecordRaw) => !child.meta?.hidden,
    );
    menuList.push(menuItem as RouteRecordRaw);
});

const otherRoutes = mutableRoutes.filter((route) => typeof route.meta?.sort !== 'number');

export const routes: RouteRecordRaw[] = [
    ...rolesRoutes,
    ...otherRoutes,
    { path: '/:path(.*)', redirect: { name: '404' } },
];

const router = createRouter({
    history: createWebHistory('/'),
    routes,
    strict: false,
    scrollBehavior: () => ({ left: 0, top: 0 }),
});

export default router;
