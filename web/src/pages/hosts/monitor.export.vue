<script setup lang="ts">
import PageView from '@/views/host/monitor/export/index.vue';
definePage({
    name: 'HostMonitorExport',
    meta: {
        activeMenu: '/hosts/monitor/monitor',
        title: 'menu.monitor',
        detail: 'commons.button.export',
        permission: 'host_monitor_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
