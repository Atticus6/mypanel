<script setup lang="ts">
import PageView from '@/views/container/network/index.vue';
definePage({
    name: 'Network',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.network',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
