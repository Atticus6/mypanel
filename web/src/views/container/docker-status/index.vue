<template>
    <div>
        <el-card v-if="isExist && !isActive && !prop.isHide" class="mask-prompt">
            <span>{{ $t('container.serviceUnavailable') }}</span>
            <el-button type="primary" link class="bt" @click="goSetting">【 {{ $t('container.setting') }} 】</el-button>
            <span>{{ $t('container.startIn') }}</span>
        </el-card>
        <NoSuchService v-if="!isExist" name="Docker" />
    </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import NoSuchService from '@/components/layout-content/no-such-service.vue';
import { routerToName } from '@/utils/router';
import { rpc } from '@/lib/rpc';

const prop = defineProps({
    isHide: Boolean,
});

const em = defineEmits(['search', 'mounted', 'update:is-active', 'update:is-exist', 'update:loading']);
const isActive = ref(true);
const isExist = ref(true);
const loadStatus = async () => {
    em('update:loading', true);
    await rpc.container.getDockerStatus({})
        .then((res) => {
            isActive.value = res.isActive;
            isExist.value = res.isExist;
            em('update:loading', false);
            em('update:is-active', isActive.value);
            em('update:is-exist', isExist.value);
            em('search');
            em('mounted');
        })
        .catch(() => {
            em('update:loading', false);
            em('update:is-active', false);
            em('update:is-exist', false);
        });
};

const goSetting = async () => {
    routerToName('ContainerSetting');
};

onMounted(() => {
    loadStatus();
});
</script>
