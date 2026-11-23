<template>
    <el-tabs tab-position="left" v-model="index">
        <el-tab-pane :label="'OpenResty'" name="0">
            <Nginx :id="id" v-if="index == '0'"></Nginx>
        </el-tab-pane>
    </el-tabs>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import Nginx from './nginx/index.vue';
import { rpc } from '@/lib/rpc';

const props = defineProps({
    id: {
        type: Number,
        default: 0,
    },
});

const id = computed(() => {
    return props.id;
});

let index = ref('0');
let configPHP = ref(false);
let installId = ref(0);

const getWebsiteDetail = async () => {
    const res = await rpc.website.getWebsite({ id: props.id });
    if (res.type === 'runtime') {
        installId.value = res.appInstallId;
        // 运行时能力已剔除，不再请求 runtime 详情。
        configPHP.value = false;
    }
};

onMounted(() => {
    getWebsiteDetail();
});
</script>
