<script setup lang="ts">
import PageView from '@/views/setting/snapshot/index.vue';
definePage({
    name: 'Snapshot',
    meta: {
        parent: 'menu.settings',
        activeMenu: '/settings',
        title: 'setting.snapshot',
        adminOnly: true,
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
