<script setup lang="ts">
import PageView from '@/views/cronjob/cronjob/index.vue';
definePage({
    name: 'CronjobItem',
    meta: { activeMenu: '/cronjobs', title: 'menu.cronjob', permission: 'cronjob_view', hidden: true },
});
</script>

<template>
    <PageView />
</template>
