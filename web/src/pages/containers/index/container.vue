<script setup lang="ts">
import PageView from '@/views/container/container/index.vue';
definePage({
    name: 'ContainerItem',
    props: true,
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'menu.container',
        hidden: true,
    },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
