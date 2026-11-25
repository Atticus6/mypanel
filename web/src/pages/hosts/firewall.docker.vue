<script setup lang="ts">
import PageView from '@/views/host/firewall/docker/index.vue';
definePage({
    name: 'FirewallDockerGuard',
    meta: {
        activeMenu: '/hosts/firewall/rules',
        parent: 'menu.firewall',
        title: 'firewall.dockerGuard',
        permission: 'host_firewall_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
