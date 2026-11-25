<script setup lang="ts">
import Layout from '@/layout/index.vue';
definePage({
    name: 'Terminal-Menu',
    redirect: '/terminal',
    meta: { title: 'menu.terminal', icon: 'p-terminal2', protectedRoleOnly: true, sort: 8 },
});
</script>

<template>
    <Layout />
</template>
