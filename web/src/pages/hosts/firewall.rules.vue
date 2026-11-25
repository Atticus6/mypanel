<script setup lang="ts">
import PageView from '@/views/host/firewall/rule/index.vue';
definePage({
    name: 'FirewallPort',
    meta: {
        icon: 'p-firewalld-menu',
        activeMenu: '/hosts/firewall/rules',
        title: 'menu.firewall',
        permission: 'host_firewall_view',
    },
});
</script>

<template>
    <PageView />
</template>
