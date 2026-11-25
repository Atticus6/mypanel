<script setup lang="ts">
import PageView from '@/views/host/ssh/log/index.vue';
definePage({
    name: 'SSHLog',
    meta: {
        parent: 'menu.ssh',
        title: 'ssh.loginLogs',
        activeMenu: '/hosts/ssh/ssh',
        permission: 'host_ssh_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
