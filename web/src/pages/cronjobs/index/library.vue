<script setup lang="ts">
import PageView from '@/views/cronjob/library/index.vue';
definePage({
    name: 'Library',
    meta: { activeMenu: '/cronjobs', title: 'cronjob.library.library', permission: 'cronjob_view', hidden: true },
});
</script>

<template>
    <PageView />
</template>
