<script setup lang="ts">
import PageView from '@/views/website/website/index.vue';
definePage({
    name: 'Website',
    meta: { icon: 'p-website', title: 'menu.website', permission: 'website_view' },
});
</script>

<template>
    <PageView />
</template>
