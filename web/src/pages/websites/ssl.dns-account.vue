<script setup lang="ts">
import PageView from '@/views/website/ssl/dns-account/index.vue';
definePage({
    name: 'SSL-DNS',
    meta: {
        activeMenu: '/websites/ssl',
        title: 'menu.ssl',
        detail: 'website.dnsAccountManage',
        permission: 'website_cert_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView />
</template>
