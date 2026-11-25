<script setup lang="ts">
import PageView from '@/views/login/index.vue';
definePage({
    name: 'login',
    props: true,
    meta: { key: 'login' },
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
