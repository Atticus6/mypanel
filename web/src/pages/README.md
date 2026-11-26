# 文件路由约定

本目录是 Vue Router 内置文件路由的路由源（由 `vue-router/vite` 插件扫描）。新增页面只需在此按 URL 结构建 `.tsx` 文件，
路由记录（路径、父子嵌套）由文件与目录名生成，不再维护 `src/routers/modules/*.ts`。

页面元数据写在 `definePage()` 宏里（TSX 中全局可用，构建时被提取），例如：

```tsx
import PageView from '@/pages/apps/_components/apps/index';
definePage({
    name: 'AppAll',
    meta: { activeMenu: '/apps', title: 'app.all', permission: 'app_view', hidden: true },
});

export default defineComponent(() => () => <PageView {...useRoute().params} />);
```

约定：

- `name` 保持与原 1Panel 一致（`Home-Menu`、`App-Menu` 等），后端下发的菜单隐藏配置依赖这些名字。
- `meta.sort` 只标在九个一级菜单分组首页上，决定侧栏顺序；`meta.hidden` 替代旧的非标准 `hidden` 字段。
- 布局分组首页渲染 `<Layout />`，中间层级渲染同一功能目录下 `_components/` 里的业务组件。
  `_components/` 已在 `vite.config.ts` 中用 `exclude: ['**/_components/**']` 排除，里面的 `.tsx` 不会生成路由。
- 嵌套到同一 URL 下但不需要嵌套布局的路由用 `.` 拼文件名（如 `hosts/firewall.rules.tsx` → `/hosts/firewall/rules`），
  需要中间布局的用 `xxx/index/` 子目录（如 `apps/index/all.tsx` → `/apps/all`，父级是 `apps/index.tsx`）。
- `props: true` 的页面需要把 `useRoute().params` 透传给业务组件。
- 带 store 判断的动态重定向、菜单排序和 catch-all 无法写进宏，集中在 `src/routers/router.ts` 处理。
- `src/types/typed-router.d.ts` 由插件生成，随代码提交，不要手改；其中 `RouteNamedMap` 同时驱动路由跳转的类型检查。
- 跳转优先用 `@/utils/router` 的封装：名字与参数都经生成的类型校验；只有运行时注册的扩展包路由走 `routerToExtensionName`。
