<template>
    <DrawerPro
        v-model="backupVisible"
        :header="$t('commons.button.backup')"
        :resource="cronjob"
        @close="handleClose"
        size="large"
    >
        <template #content>
            <ComplexTable
                v-loading="loading"
                :pagination-config="paginationConfig"
                v-model:selects="selects"
                @search="search"
                :data="data"
            >
                <el-table-column :label="$t('commons.table.name')" prop="fileName" show-overflow-tooltip />
                <el-table-column :label="$t('file.size')" prop="size" show-overflow-tooltip>
                    <template #default="{ row }">
                        <div v-if="row.hasLoad">
                            <span v-if="row.size">
                                {{ computeSize(row.size) }}
                            </span>
                            <span v-else>-</span>
                        </div>
                        <div v-if="!row.hasLoad">
                            <el-button link loading></el-button>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column :label="$t('app.source')" prop="accountType" show-overflow-tooltip>
                    <template #default="{ row }">
                        <span v-if="row.accountType === 'LOCAL'">
                            {{ $t('setting.LOCAL') }}
                        </span>
                        <span v-if="row.accountType && row.accountType !== 'LOCAL'">
                            {{ $t('setting.' + row.accountType) + ' - ' + row.accountName }}
                        </span>
                        <span v-if="!row.accountType">-</span>
                    </template>
                </el-table-column>
                <el-table-column
                    prop="createdAt"
                    :label="$t('commons.table.date')"
                    :formatter="dateFormat"
                    show-overflow-tooltip
                />

                <fu-table-operations width="130px" :buttons="buttons" :label="$t('commons.table.operate')" fix />
            </ComplexTable>
        </template>
    </DrawerPro>
</template>

<script lang="ts" setup>
import { reactive, ref } from 'vue';
import { computeSize } from '@/utils/size';
import { dateFormat } from '@/utils/date';
import { downloadFile } from '@/utils/file';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgError } from '@/utils/message';

const selects = ref<any>([]);
const loading = ref();

const data = ref();
const paginationConfig = reactive({
    currentPage: 1,
    pageSize: 10,
    total: 0,
});

const backupVisible = ref(false);
const cronjob = ref();
const cronjobID = ref();

interface DialogProps {
    cronjob: string;
    cronjobID: number;
}
const acceptParams = (params: DialogProps): void => {
    cronjob.value = params.cronjob;
    cronjobID.value = params.cronjobID;
    backupVisible.value = true;
    search();
};
const handleClose = () => {
    backupVisible.value = false;
};

const search = async () => {
    let params = {
        page: paginationConfig.currentPage,
        pageSize: paginationConfig.pageSize,
        cronjobId: cronjobID.value,
    };
    loading.value = true;
    await rpc.backup
        .searchBackupRecordsByCronjob(params)
        .then((res) => {
            loading.value = false;
            loadSize(params);
            data.value = res.items || [];
            paginationConfig.total = Number(res.total);
        })
        .catch(() => {
            loading.value = false;
        });
};

const loadSize = async (params: any) => {
    params.type = 'cronjob';
    await rpc.backup
        .loadRecordSize(params)
        .then((res) => {
            let stats = res.items || [];
            if (stats.length === 0) {
                return;
            }
            for (const backup of data.value) {
                for (const item of stats) {
                    if (backup.id === item.id) {
                        backup.hasLoad = true;
                        backup.size = Number(item.size);
                        break;
                    }
                }
            }
        })
        .catch(() => {
            loading.value = false;
        });
};

const onDownload = async (row: any) => {
    if (row.accountType === 'ALIYUN' && row.size < 100 * 1024 * 1024) {
        MsgError(i18n.global.t('setting.ALIYUNHelper'));
        return;
    }
    let params = {
        downloadAccountId: row.downloadAccountId,
        fileDir: row.fileDir,
        fileName: row.fileName,
    };
    loading.value = true;
    await rpc.backup
        .downloadBackupRecord(params)
        .then(async (res) => {
            loading.value = false;
            downloadFile(res.path, 'local');
        })
        .catch(() => {
            loading.value = false;
        });
};

const buttons = [
    {
        label: i18n.global.t('commons.button.download'),
        disabled: (row: any) => {
            return row.size === 0;
        },
        click: (row: any) => {
            onDownload(row);
        },
    },
];

defineExpose({
    acceptParams,
});
</script>
