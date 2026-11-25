<script setup lang="ts">
import PageView from '@/views/host/ssh/ssh/index';
definePage({
    name: 'SSH',
    meta: {
        icon: 'p-ssh-menu',
        title: 'menu.ssh',
        detail: 'menu.config',
        activeMenu: '/hosts/ssh/ssh',
        permission: 'host_ssh_view',
    },
});
</script>

<template>
    <PageView />
</template>
