<script setup lang="ts">
import PageView from '@/views/website/ssl/index.vue';
definePage({
    name: 'SSL',
    meta: { icon: 'p-ssl-menu', title: 'menu.ssl', permission: 'website_cert_view' },
});
</script>

<template>
    <PageView />
</template>
