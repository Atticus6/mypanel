<script setup lang="ts">
import PageView from '@/views/host/ssh/session/index.vue';
definePage({
    name: 'SSHSession',
    meta: {
        parent: 'menu.ssh',
        title: 'ssh.session',
        activeMenu: '/hosts/ssh/ssh',
        permission: 'host_ssh_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
