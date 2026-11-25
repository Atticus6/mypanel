<script setup lang="ts">
import PageView from '@/views/website/ssl/ca/index.vue';
definePage({
    name: 'SSL-CA',
    meta: {
        activeMenu: '/websites/ssl',
        title: 'menu.ssl',
        detail: 'ssl.selfSigned',
        permission: 'website_cert_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
