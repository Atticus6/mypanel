<script setup lang="ts">
import PageView from '@/views/setting/about/index.vue';
definePage({
    name: 'About',
    meta: { parent: 'menu.settings', activeMenu: '/settings', title: 'setting.about', adminOnly: true, hidden: true },
});
</script>

<template>
    <PageView />
</template>
