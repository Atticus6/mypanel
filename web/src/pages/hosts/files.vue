<script setup lang="ts">
import PageView from '@/views/host/file-management/index.vue';
definePage({
    name: 'File',
    props: true,
    meta: { icon: 'p-file-menu', title: 'menu.files', permission: 'host_file_view' },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
