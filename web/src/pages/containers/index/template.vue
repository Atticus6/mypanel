<script setup lang="ts">
import PageView from '@/views/container/template/index.vue';
definePage({
    name: 'ComposeTemplate',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.composeTemplate',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
