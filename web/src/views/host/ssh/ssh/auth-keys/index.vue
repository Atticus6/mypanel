<template>
    <div>
        <DrawerPro v-model="open" :header="$t('ssh.authKeys')" size="large">
            <div v-loading="loading">
                <CodemirrorPro
                    :heightDiff="160"
                    v-model="conf"
                    :lineWrapping="true"
                    placeholder="# The authorized_keys file does not exist or is empty (~/ssh/authorized_keys)"
                />
            </div>
            <template #footer>
                <span class="dialog-footer">
                    <el-button :disabled="loading" type="primary" @click="onSaveFile">
                        {{ $t('commons.button.save') }}
                    </el-button>
                </span>
            </template>
        </DrawerPro>
    </div>
</template>

<script setup lang="ts">
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { ref } from 'vue';
import { rpc } from '@/lib/rpc';
const conf = ref();
const loading = ref();
const open = ref();

const acceptParams = async (): Promise<void> => {
    loadFile();
    open.value = true;
};
const loadFile = async () => {
    const res = await rpc.ssh.loadFile({ name: 'authKeys' });
    conf.value = res.content || '';
};
const onSaveFile = async () => {
    ElMessageBox.confirm(i18n.global.t('ssh.authKeysHelper'), i18n.global.t('ssh.authKeys'), {
        confirmButtonText: i18n.global.t('commons.button.confirm'),
        cancelButtonText: i18n.global.t('commons.button.cancel'),
        type: 'info',
    }).then(async () => {
        loading.value = true;
        await rpc.ssh.updateFile({ key: 'authKeys', value: conf.value })
            .then(() => {
                loading.value = false;
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                open.value = false;
            })
            .catch(() => {
                loading.value = false;
            });
    });
};

defineExpose({
    acceptParams,
});
</script>
