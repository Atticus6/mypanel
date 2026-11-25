<script setup lang="ts">
import PageView from '@/views/host/process/process/index.vue';
definePage({
    name: 'Process',
    meta: {
        icon: 'p-process-menu',
        title: 'menu.processManage',
        detail: 'menu.process',
        activeMenu: '/hosts/process/process',
        permission: 'host_process_view',
    },
});
</script>

<template>
    <PageView />
</template>
