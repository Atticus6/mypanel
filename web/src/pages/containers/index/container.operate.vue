<script setup lang="ts">
import PageView from '@/views/container/container/operate/index.vue';
definePage({
    name: 'ContainerCreate',
    props: true,
    meta: { activeMenu: '/containers', permission: 'container_view', ignoreTab: true, hidden: true },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
