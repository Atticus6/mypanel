<script setup lang="ts">
import PageView from '@/views/container/image/index.vue';
definePage({
    name: 'Image',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.image',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
