<script setup lang="ts">
import Layout from '@/layout/index.vue';
definePage({
    name: 'Cronjob-Menu',
    redirect: '/cronjobs/cronjob',
    meta: { icon: 'p-plan', title: 'menu.cronjob', permission: 'cronjob_view', sort: 9 },
});
</script>

<template>
    <Layout />
</template>
