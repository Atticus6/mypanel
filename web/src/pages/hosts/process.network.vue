<script setup lang="ts">
import PageView from '@/views/host/process/network/index.vue';
definePage({
    name: 'ProcessNetwork',
    meta: {
        parent: 'menu.processManage',
        title: 'menu.network',
        activeMenu: '/hosts/process/process',
        permission: 'host_process_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
