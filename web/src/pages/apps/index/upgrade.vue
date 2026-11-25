<script setup lang="ts">
import PageView from '@/views/app-store/installed/index.vue';
definePage({
    name: 'AppUpgrade',
    props: true,
    meta: { activeMenu: '/apps', parent: 'menu.app', title: 'app.canUpgrade', permission: 'app_view', hidden: true },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
