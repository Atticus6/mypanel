<script setup lang="ts">
import PageView from '@/views/host/monitor/setting/index.vue';
definePage({
    name: 'HostMonitorSetting',
    meta: {
        activeMenu: '/hosts/monitor/monitor',
        title: 'menu.monitor',
        detail: 'commons.button.set',
        permission: 'host_monitor_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
