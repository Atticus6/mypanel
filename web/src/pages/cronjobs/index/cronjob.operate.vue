<script setup lang="ts">
import PageView from '@/views/cronjob/cronjob/operate/index.vue';
definePage({
    name: 'CronjobOperate',
    meta: { activeMenu: '/cronjobs', ignoreTab: true, permission: 'cronjob_view', hidden: true },
});
</script>

<template>
    <PageView />
</template>
