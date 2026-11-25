<script setup lang="ts">
import PageView from '@/views/host/firewall/forward/index.vue';
definePage({
    name: 'FirewallForward',
    meta: {
        activeMenu: '/hosts/firewall/rules',
        parent: 'menu.firewall',
        title: 'firewall.forwardRule',
        permission: 'host_firewall_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
