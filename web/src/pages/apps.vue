<script setup lang="ts">
import Layout from '@/layout/index.vue';
definePage({
    name: 'App-Menu',
    redirect: '/apps/all',
    meta: { icon: 'p-appstore', title: 'menu.apps', permission: 'app_view', sort: 2 },
});
</script>

<template>
    <Layout />
</template>
