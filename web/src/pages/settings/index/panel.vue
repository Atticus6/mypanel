<script setup lang="ts">
import PageView from '@/views/setting/panel/index.vue';
definePage({
    name: 'Panel',
    meta: { parent: 'menu.settings', activeMenu: '/settings', title: 'setting.panel', adminOnly: true, hidden: true },
});
</script>

<template>
    <PageView />
</template>
