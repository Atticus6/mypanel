<template>
    <DrawerPro v-model="open" :header="$t('app.ignoreList')" @close="handleClose" size="small">
        <template #content>
            <el-table :data="apps">
                <el-table-column prop="name" :label="$t('app.app')" />
                <el-table-column prop="scope" :label="$t('license.trialInfo')">
                    <template #default="{ row }">
                        <el-tag v-if="row.version != ''">{{ row.version }}</el-tag>
                        <el-tag v-else>{{ $t('commons.table.all') + $t('app.version') }}</el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="scope" :label="$t('commons.table.operate')">
                    <template #default="{ row }">
                        <el-button v-permission type="primary" link @click="cancelIgnore(row.id)">
                            {{ $t('app.cancelIgnore') }}
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </template>
        <template #footer>
            <span class="dialog-footer">
                <el-button @click="handleClose" :disabled="loading">{{ $t('commons.button.cancel') }}</el-button>
            </span>
        </template>
    </DrawerPro>
</template>
<script lang="ts" setup>
import { rpc } from '@/lib/rpc';
import { ref } from 'vue';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import bus from '@/global/bus';

const open = ref(false);
const loading = ref(false);
const apps = ref();
const em = defineEmits(['close']);

const handleClose = () => {
    open.value = false;
    em('close', open.value);
};

const acceptParams = () => {
    open.value = true;
    getApps();
};

const getApps = async () => {
    try {
        const res = await rpc.app.listIgnoredApps({});
        apps.value = res.items.map((i) => ({
            id: i.id,
            name: i.name,
            detailID: i.appDetailId,
            version: i.version,
            scope: i.scope,
        }));
    } catch (error) {}
};

const cancelIgnore = async (id: number) => {
    loading.value = true;
    await rpc.app
        .cancelIgnoreAppUpgrade({ id })
        .then(() => {
            bus.emit('upgrade', true);
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
        })
        .finally(() => {
            getApps();
            loading.value = false;
        });
};

defineExpose({
    acceptParams,
});
</script>

<style scoped>
.app-margin {
    margin-top: 10px;
}
</style>
