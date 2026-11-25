<script setup lang="ts">
import Layout from '@/layout/index.vue';
definePage({
    name: 'System-Menu',
    redirect: '/hosts/security',
    meta: { icon: 'p-host', title: 'menu.system', sort: 7 },
});
</script>

<template>
    <Layout />
</template>
