<script setup lang="ts">
import Layout from '@/layout/index.vue';
definePage({
    name: 'Container-Menu',
    redirect: '/containers/container',
    meta: { icon: 'p-docker1', title: 'menu.container', permission: 'container_view', sort: 6 },
});
</script>

<template>
    <Layout />
</template>
