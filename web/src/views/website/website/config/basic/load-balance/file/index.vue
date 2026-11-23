<template>
    <DrawerPro
        v-model="open"
        :header="$t('website.sourceFile')"
        @close="handleClose"
        :size="isMobile ? 'full' : 'normal'"
    >
        <CodemirrorPro v-model="req.content" mode="nginx"></CodemirrorPro>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="handleClose" :disabled="loading">{{ $t('commons.button.cancel') }}</el-button>
                <el-button v-permission type="primary" @click="submit()" :disabled="loading">
                    {{ $t('commons.button.confirm') }}
                </el-button>
            </span>
        </template>
    </DrawerPro>
</template>

<script lang="ts" setup>
import i18n from '@/lang';
import { FormInstance } from 'element-plus';
import { reactive, ref } from 'vue';
import { MsgSuccess } from '@/utils/message';
import CodemirrorPro from '@/components/codemirror-pro/index.vue';
import { Website } from '@/api/interface/website';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';

const { isMobile } = useGlobalStore();

const proxyForm = ref<FormInstance>();
const open = ref(false);
const loading = ref(false);
const em = defineEmits(['close']);
const handleClose = () => {
    proxyForm.value?.resetFields();
    open.value = false;
    em('close', false);
};
const req = reactive({
    name: '',
    websiteID: 0,
    content: '',
});

const acceptParams = async (ups: Website.NginxUpstreamFile) => {
    req.name = ups.name;
    req.websiteID = ups.websiteID;
    req.content = ups.content;
    open.value = true;
};

const submit = async () => {
    loading.value = true;
    rpc.website.updateLoadBalanceFile(req as any)
        .then(() => {
            MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            handleClose();
        })
        .finally(() => {
            loading.value = false;
        });
};

defineExpose({
    acceptParams,
});
</script>
