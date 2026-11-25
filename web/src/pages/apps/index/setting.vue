<script setup lang="ts">
import PageView from '@/views/app-store/setting/index.vue';
definePage({
    name: 'AppStoreSetting',
    props: true,
    meta: {
        activeMenu: '/apps',
        parent: 'menu.app',
        title: 'commons.button.set',
        permission: 'app_view',
        hidden: true,
    },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
