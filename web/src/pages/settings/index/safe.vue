<script setup lang="ts">
import PageView from '@/views/setting/safe/index.vue';
definePage({
    name: 'Safe',
    meta: { parent: 'menu.settings', activeMenu: '/settings', title: 'setting.safe', adminOnly: true, hidden: true },
});
</script>

<template>
    <PageView />
</template>
