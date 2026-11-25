<script setup lang="ts">
import PageView from '@/components/error-message/404.vue';
definePage({
    name: '404',
    meta: { title: 'commons.msg.notFound', key: '404', hidden: true },
});
</script>

<template>
    <PageView />
</template>
