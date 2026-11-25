<script setup lang="ts">
import PageView from '@/views/setting/expired.vue';
definePage({
    name: 'Expired',
    meta: { parent: 'menu.settings', activeMenu: '/settings', ignoreTab: true, hidden: true },
});
</script>

<template>
    <PageView />
</template>
