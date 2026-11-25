<script setup lang="ts">
import PageView from '@/views/website/ssl/acme-account/index.vue';
definePage({
    name: 'SSL-ACME',
    meta: {
        activeMenu: '/websites/ssl',
        title: 'menu.ssl',
        detail: 'website.acmeAccountManage',
        permission: 'website_cert_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
