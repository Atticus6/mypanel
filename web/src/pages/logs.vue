<script setup lang="ts">
import Layout from '@/layout/index.vue';
definePage({
    name: 'Log-Menu',
    redirect: '/logs/operation',
    meta: { title: 'menu.logs', icon: 'p-log', permission: 'log_view', sort: 11 },
});
</script>

<template>
    <Layout />
</template>
