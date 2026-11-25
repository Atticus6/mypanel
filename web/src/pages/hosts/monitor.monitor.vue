<script setup lang="ts">
import PageView from '@/views/host/monitor/monitor/index.vue';
definePage({
    name: 'Monitorx',
    meta: {
        icon: 'p-system-monitor-menu',
        activeMenu: '/hosts/monitor/monitor',
        title: 'menu.monitor',
        permission: 'host_monitor_view',
    },
});
</script>

<template>
    <PageView />
</template>
