<script setup lang="ts">
import PageView from '@/views/app-store/installed/index.vue';
definePage({
    name: 'AppInstalled',
    props: true,
    meta: { activeMenu: '/apps', parent: 'menu.app', title: 'app.installed', permission: 'app_view', hidden: true },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
