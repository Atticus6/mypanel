<script setup lang="ts">
import PageView from '@/views/container/compose/index.vue';
definePage({
    name: 'Compose',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.compose',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
