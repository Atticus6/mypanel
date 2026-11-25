# 文件路由约定

本目录是 `unplugin-vue-router` 的路由源。新增页面只需在此按 URL 结构建 `.vue` 文件，
路由记录（路径、父子嵌套）由文件与目录名生成，不再维护 `src/routers/modules/*.ts`。

页面元数据写在 `<script setup>` 的 `definePage()` 宏里，例如：

```vue
<script setup lang="ts">
import PageView from '@/views/app-store/apps/index.vue';
definePage({
    name: 'AppAll',
    meta: { activeMenu: '/apps', title: 'app.all', permission: 'app_view', hidden: true },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
```

约定：

- `name` 保持与原 1Panel 一致（`Home-Menu`、`App-Menu` 等），后端下发的菜单隐藏配置依赖这些名字。
- `meta.sort` 只标在九个一级菜单分组首页上，决定侧栏顺序；`meta.hidden` 替代旧的非标准 `hidden` 字段。
- 布局分组首页渲染 `<Layout />`，中间层级渲染原 `@/views/...` 组件；实际业务代码仍放在 `src/views/`。
- 嵌套到同一 URL 下但不需要嵌套布局的路由用 `.` 拼文件名（如 `hosts/firewall.rules.vue` → `/hosts/firewall/rules`），
  需要中间布局的用 `xxx/index/` 子目录（如 `apps/index/all.vue` → `/apps/all`，父级是 `apps/index.vue`）。
- `props: true` 的页面必须在模板里用 `v-bind="$route.params"` 把参数透传给业务组件。
- 带 store 判断的动态重定向、菜单排序和 catch-all 无法写进宏，集中在 `src/routers/router.ts` 处理。
- `src/typed-router.d.ts` 由插件生成，随代码提交，不要手改。
