<script setup lang="ts">
import PageView from '@/views/container/setting/index.vue';
definePage({
    name: 'ContainerSetting',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.setting',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
