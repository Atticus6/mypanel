<script setup lang="ts">
import PageView from '@/views/container/repo/index.vue';
definePage({
    name: 'Repo',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.repo',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
