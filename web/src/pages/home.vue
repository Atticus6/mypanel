<script setup lang="ts">
import Layout from '@/layout/index.vue';
definePage({
    name: 'Home-Menu',
    path: '/',
    redirect: '/',
    meta: { icon: 'p-home', title: 'menu.home', sort: 1 },
});
</script>

<template>
    <Layout />
</template>
