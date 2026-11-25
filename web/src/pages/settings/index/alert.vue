<script setup lang="ts">
import PageView from '@/views/setting/alert/index.vue';
definePage({
    name: 'Alert',
    meta: {
        parent: 'menu.settings',
        activeMenu: '/settings',
        title: 'xpack.alert.alertNotice',
        permission: 'alert_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
