<script setup lang="ts">
import PageView from '@/views/container/dashboard/index.vue';
definePage({
    name: 'ContainerDashboard',
    props: true,
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'menu.home',
        hidden: true,
    },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
