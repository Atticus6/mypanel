<script setup lang="ts">
import PageView from '@/views/setting/backup-account/index.vue';
definePage({
    name: 'BackupAccount',
    meta: {
        parent: 'menu.settings',
        activeMenu: '/settings',
        title: 'setting.backupAccount',
        permission: 'backup_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
