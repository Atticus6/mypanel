<script setup lang="ts">
import PageView from '@/views/login/index.vue';
definePage({
    name: 'entrance',
    props: true,
});
</script>

<template>
    <PageView v-bind="$route.params" />
</template>
