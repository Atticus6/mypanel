<script setup lang="ts">
import PageView from '@/views/app-store/apps/index.vue';
definePage({
    name: 'AppAll',
    props: true,
    meta: { activeMenu: '/apps', parent: 'menu.app', title: 'app.all', permission: 'app_view', hidden: true },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
