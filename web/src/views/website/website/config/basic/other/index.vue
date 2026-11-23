<template>
    <el-row :gutter="20" v-loading="loading">
        <el-col :xs="24" :sm="24" :md="18" :lg="14" :xl="8">
            <el-form ref="websiteForm" label-position="right" label-width="80px" :model="form" :rules="rules">
                <el-form-item :label="$t('commons.table.name')" prop="primaryDomain">
                    <el-input v-model="form.primaryDomain"></el-input>
                </el-form-item>
                <el-form-item :label="$t('website.alias')" prop="alias">
                    <el-input v-model="form.alias" disabled></el-input>
                </el-form-item>
                <GroupSelect
                    v-model="form.webSiteGroupId"
                    :prop="'webSiteGroupId'"
                    :groupType="'website'"
                ></GroupSelect>
                <el-form-item :label="$t('website.remark')" prop="remark">
                    <el-input v-model="form.remark"></el-input>
                </el-form-item>
                <el-form-item prop="IPV6">
                    <el-checkbox v-model="form.IPV6" :label="$t('website.ipv6')" size="large" />
                </el-form-item>
                <el-form-item>
                    <el-button v-permission type="primary" @click="submit(websiteForm)" :disabled="loading">
                        {{ $t('commons.button.save') }}
                    </el-button>
                </el-form-item>
            </el-form>
        </el-col>
    </el-row>
</template>

<script lang="ts" setup>
import GroupSelect from '@/views/website/website/components/group/index.vue';

import { Rules } from '@/global/form-rules';
import { computed, onMounted, reactive, ref } from 'vue';
import { FormInstance } from 'element-plus';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';

const websiteForm = ref<FormInstance>();
const props = defineProps({
    id: {
        type: Number,
        default: 0,
    },
});
const websiteId = computed(() => {
    return Number(props.id);
});
const loading = ref(false);
const form = reactive({
    id: websiteId.value,
    primaryDomain: '',
    remark: '',
    webSiteGroupId: 0,
    IPV6: false,
    alias: '',
    favorite: false,
});
const rules = ref({
    primaryDomain: [Rules.requiredInput, Rules.linuxName],
    webSiteGroupId: [Rules.requiredSelect],
});

const submit = async (formEl: FormInstance | undefined) => {
    if (!formEl) return;
    await formEl.validate((valid) => {
        if (!valid) {
            return;
        }
        if (form.remark && form.remark.length > 128) {
            MsgError(i18n.global.t('commons.rule.length128Err'));
            return;
        }
        loading.value = true;
        rpc.website
            .updateWebsite({
                id: form.id,
                primaryDomain: form.primaryDomain,
                remark: form.remark,
                websiteGroupId: form.webSiteGroupId,
                expireDate: '',
                ipv6: form.IPV6,
                favorite: form.favorite,
            })
            .then(() => {
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                search();
            })
            .finally(() => {
                loading.value = false;
            });
    });
};
const search = async () => {
    rpc.website.getWebsite({ id: websiteId.value }).then((res) => {
        form.primaryDomain = res.primaryDomain;
        form.remark = res.remark;
        form.webSiteGroupId = res.websiteGroupId;
        form.IPV6 = res.ipv6;
        form.alias = res.alias;
        form.favorite = res.favorite;
    });
};

onMounted(() => {
    search();
});
</script>
