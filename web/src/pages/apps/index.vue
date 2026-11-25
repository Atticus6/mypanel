<script setup lang="ts">
import PageView from '@/views/app-store/index';
definePage({
    name: 'App',
    redirect: '/apps/all',
    meta: { permission: 'app_view' },
});
</script>

<template>
    <PageView />
</template>
