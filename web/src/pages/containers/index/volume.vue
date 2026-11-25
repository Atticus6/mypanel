<script setup lang="ts">
import PageView from '@/views/container/volume/index.vue';
definePage({
    name: 'Volume',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.volume',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
