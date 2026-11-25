<script setup lang="ts">
import PageView from '@/views/host/disk-management/disk/index.vue';
definePage({
    name: 'Disk',
    props: true,
    meta: { icon: 'p-disk-menu', title: 'menu.disk', permission: 'host_disk_view' },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
