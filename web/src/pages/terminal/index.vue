<script setup lang="ts">
import PageView from '@/views/terminal/index.vue';
definePage({
    name: 'Terminal',
    props: true,
    meta: { protectedRoleOnly: true },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
