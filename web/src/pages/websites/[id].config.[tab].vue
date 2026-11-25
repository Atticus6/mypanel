<script setup lang="ts">
import PageView from '@/views/website/website/config/index.vue';
definePage({
    name: 'WebsiteConfig',
    props: true,
    meta: { activeMenu: '/websites', ignoreTab: true, permission: 'website_view', hidden: true },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
