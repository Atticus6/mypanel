<script setup lang="ts">
import PageView from '@/views/host/firewall/setting/index.vue';
definePage({
    name: 'FirewallSetting',
    meta: {
        activeMenu: '/hosts/firewall/rules',
        parent: 'menu.firewall',
        title: 'commons.button.set',
        permission: 'host_firewall_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
