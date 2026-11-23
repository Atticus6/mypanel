<template>
    <el-row :gutter="20" v-loading="loading">
        <el-col :xs="24" :sm="18" :md="8" :lg="8" :xl="8">
            <el-form @submit.prevent ref="defaultForm" label-position="top" :model="defaultModel" :rules="rules">
                <el-form-item :label="$t('website.defaultDoc')" prop="index">
                    <el-input v-model="defaultModel.index" type="textarea" :rows="8"></el-input>
                </el-form-item>
            </el-form>
            <el-button v-permission type="primary" @click="submit(defaultForm)" :disabled="loading">
                {{ $t('commons.button.save') }}
            </el-button>
        </el-col>
    </el-row>
</template>

<script lang="ts" setup>
import { Website } from '@/api/interface/website';
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import { FormInstance } from 'element-plus';
import { computed, onMounted, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';

const props = defineProps({
    id: {
        type: Number,
        default: 0,
    },
});
const websiteId = computed(() => {
    return Number(props.id);
});
const defaultForm = ref<FormInstance>();
let rules = ref({
    index: [Rules.requiredInput, Rules.nginxDoc],
});
let defaultModel = ref({
    index: '',
});
let req = ref({
    operate: 'update',
    scope: 'index',
    websiteId: websiteId.value,
    params: {},
});

let loading = ref(false);

const submit = async (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    await formEl.validate((valid) => {
        if (!valid) {
            return;
        }
        req.value.params = defaultModel.value;
        loading.value = true;
        rpc.website.updateNginxScopeConfig({
            websiteId: req.value.websiteId,
            scope: req.value.scope,
            operate: req.value.operate,
            paramsJson: JSON.stringify(req.value.params ?? []),
        })
            .then(() => {
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                search(req.value);
            })
            .finally(() => {
                loading.value = false;
            });
    });
};

const search = (req: Website.NginxConfigReq) => {
    loading.value = true;
    rpc.website.getNginxScopeConfig({ websiteId: req.websiteId, scope: req.scope })
        .then((res) => {
            if (res.params.length > 0) {
                const params = res.params[0].params;
                let values = '';
                for (const param of params) {
                    values = values + param + '\n';
                }
                defaultModel.value.index = values;
            }
        })
        .finally(() => {
            loading.value = false;
        });
};

onMounted(() => {
    search(req.value);
});
</script>
