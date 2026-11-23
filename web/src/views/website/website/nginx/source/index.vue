<template>
    <div v-loading="loading">
        <CodemirrorPro v-model="content" mode="nginx" :heightDiff="350"></CodemirrorPro>
        <div class="mt-2.5">
            <el-button v-permission @click="getDefaultConfig()" :disabled="loading">
                {{ $t('app.defaultConfig') }}
            </el-button>
            <el-button v-permission type="primary" @click="submit()" :disabled="loading">
                {{ $t('commons.button.save') }}
            </el-button>
        </div>
        <el-row>
            <el-col :span="4">
                <el-alert
                    v-if="useOld"
                    class="mt-2.5"
                    :title="$t('app.defaultConfigHelper')"
                    type="info"
                    :closable="false"
                ></el-alert>
            </el-col>
        </el-row>
    </div>
</template>
<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import CodemirrorPro from '@/components/codemirror-pro/index.vue';
import { rpc } from '@/lib/rpc';

let content = ref('');
let loading = ref(false);
let useOld = ref(false);

const submit = () => {
    loading.value = true;
    rpc.openresty
        .updateConfigFile({
            content: content.value,
            backup: useOld.value,
        })
        .then(() => {
            MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            getNginxConfig();
        })
        .finally(() => {
            loading.value = false;
        });
};

const getNginxConfig = async () => {
    try {
        const res = await rpc.openresty.getConfig({});
        content.value = res.content;
        useOld.value = false;
    } catch (error) {}
};

const getDefaultConfig = async () => {
    loading.value = true;
    try {
        const res = await rpc.app.getDefaultConfig({ type: 'openresty', name: '' });
        content.value = res.content;
        useOld.value = true;
    } catch (error) {}
    loading.value = false;
};

onMounted(() => {
    getNginxConfig();
});
</script>
