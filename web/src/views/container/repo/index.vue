<template>
    <div v-loading="loading">
        <docker-status
            v-model:isActive="isActive"
            v-model:isExist="isExist"
            v-model:loading="loading"
            @search="search"
        />

        <LayoutContent v-if="isExist" :title="$t('container.repo', 2)" :class="{ mask: !isActive }">
            <template #leftToolBar>
                <el-button v-permission type="primary" @click="onOpenDialog('add')">
                    {{ $t('commons.button.add') }}
                </el-button>
            </template>
            <template #rightToolBar>
                <TableSearch @search="search()" v-model:searchName="searchName" />
                <TableRefresh @search="search()" />
                <TableSetting title="repo-refresh" @search="search()" />
            </template>
            <template #main>
                <ComplexTable
                    :cache-pagination="false"
                    :pagination-config="paginationConfig"
                    v-model:selects="selects"
                    :data="data"
                    @search="search"
                    :heightDiff="300"
                >
                    <el-table-column :label="$t('commons.table.name')" prop="name" min-width="60" />
                    <el-table-column
                        :label="$t('container.downloadUrl')"
                        show-overflow-tooltip
                        prop="downloadUrl"
                        min-width="100"
                        fix
                    />
                    <el-table-column :label="$t('commons.table.protocol')" prop="protocol" min-width="60" fix />
                    <el-table-column :label="$t('commons.table.status')" prop="status" min-width="60" fix>
                        <template #default="{ row }">
                            <Status :status="row.status" :msg="row.message" />
                        </template>
                    </el-table-column>
                    <el-table-column
                        prop="createdAt"
                        :label="$t('commons.table.createdAt')"
                        min-width="80"
                        fix
                        :formatter="dateFormat"
                    />
                    <fu-table-operations width="200px" :buttons="buttons" :label="$t('commons.table.operate')" />
                </ComplexTable>
            </template>
        </LayoutContent>

        <OpDialog ref="opRef" @search="search" @submit="submitDelete" />
        <OperatorDialog @search="search" ref="dialogRef" />
        <ConfirmDialog ref="confirmDialog" @confirm="submitDelete" />
    </div>
</template>

<script lang="ts" setup>
export interface RepoInfo {
    id: number;
    createdAt?: string;
    name: string;
    downloadUrl: string;
    protocol: string;
    username: string;
    password: string;
    auth: boolean;
}
import { useSearchState } from '@/utils/search-reset';
import OperatorDialog from '@/views/container/repo/operator/index.vue';
import { toRef, reactive, ref } from 'vue';
import { dateFormat } from '@/utils/date';
import { rpc } from '@/lib/rpc';
import DockerStatus from '@/views/container/docker-status/index.vue';
import i18n from '@/lang';

const loading = ref();
const data = ref();
const selects = ref<any>([]);
const paginationConfig = reactive({
    currentPage: 1,
    pageSize: 20,
    total: 0,
});
const searchName = ref();
useSearchState(
    'container/repo/index',
    { search: searchName, page: toRef(paginationConfig, 'currentPage'), pageSize: toRef(paginationConfig, 'pageSize') },
    { onRevisit: () => search() },
);

const opRef = ref();
const confirmDialog = ref();
const currentRepo = ref();

const isActive = ref();
const isExist = ref();

const search = async () => {
    if (!isActive.value || !isExist.value) {
        return;
    }
    let params = {
        info: searchName.value,
        page: paginationConfig.currentPage,
        pageSize: paginationConfig.pageSize,
    };
    loading.value = true;
    await rpc.container
        .searchImageRepos(params)
        .then((res) => {
            loading.value = false;
            data.value = res.items || [];
            paginationConfig.total = Number(res.total);
        })
        .catch(() => {
            loading.value = false;
        });
};
const dialogRef = ref();
const onOpenDialog = async (
    title: string,
    rowData: Partial<RepoInfo> = {
        auth: true,
        protocol: 'http',
    },
) => {
    let params = {
        title,
        rowData: { ...rowData },
    };
    dialogRef.value!.acceptParams(params);
};

const onDelete = async (row: RepoInfo) => {
    currentRepo.value = row.id;
    if (row.protocol === 'http') {
        let params = {
            header: i18n.global.t('container.repo'),
            operationInfo: i18n.global.t('container.httpRepoHelper'),
            submitInputInfo: i18n.global.t('database.restartNow'),
        };
        confirmDialog.value!.acceptParams(params);
        return;
    }
    opRef.value.acceptParams({
        title: i18n.global.t('commons.button.delete'),
        names: [row.name],
        msg: i18n.global.t('commons.msg.operatorHelper', [
            i18n.global.t('container.repo'),
            i18n.global.t('commons.button.delete'),
        ]),
        api: null,
        params: null,
    });
};

const submitDelete = async () => {
    loading.value = true;
    await rpc.container.deleteRepo({ id: currentRepo.value })
        .then(() => {
            loading.value = false;
            search();
        })
        .catch(() => {
            loading.value = false;
        });
};

const onCheckConn = async (row: RepoInfo) => {
    loading.value = true;
    await rpc.container.checkRepoStatus({ id: row.id })
        .then(() => {
            loading.value = false;
            search();
        })
        .catch(() => {
            loading.value = false;
        });
};

const buttons = [
    {
        label: i18n.global.t('commons.button.sync'),
        permission: true,
        disabled: (row: RepoInfo) => {
            return row.id === 1;
        },
        click: (row: RepoInfo) => {
            onCheckConn(row);
        },
    },
    {
        label: i18n.global.t('commons.button.edit'),
        permission: true,
        disabled: (row: RepoInfo) => {
            return row.id === 1;
        },
        click: (row: RepoInfo) => {
            onOpenDialog('edit', row);
        },
    },
    {
        label: i18n.global.t('commons.button.delete'),
        permission: true,
        disabled: (row: RepoInfo) => {
            return row.id === 1;
        },
        click: (row: RepoInfo) => {
            onDelete(row);
        },
    },
];
</script>
