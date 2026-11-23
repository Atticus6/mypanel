<template>
    <div>
        <ComplexTable :data="data" @search="search()" :heightDiff="350" v-loading="loading">
            <template #toolbar>
                <el-button v-permission type="primary" @click="openOperate">
                    {{ $t('commons.button.create') }}
                </el-button>
                <el-button v-permission type="primary" plain @click="buildNginx">
                    {{ $t('nginx.build') }}
                </el-button>
                <el-text type="warning" class="!ml-2">{{ $t('nginx.buildHelper') }}</el-text>
            </template>
            <el-table-column prop="name" :label="$t('commons.table.name')" min-width="320" />
            <el-table-column :label="$t('nginx.buildMode')" min-width="160" align="center">
                <template #default="{ row }">
                    <el-tag effect="plain" :type="row.buildMode === 'static' ? 'warning' : 'primary'">
                        {{ $t('nginx.buildMode' + capitalize(row.buildMode)) }}
                    </el-tag>
                </template>
            </el-table-column>
            <el-table-column :label="$t('nginx.buildStatus')" min-width="160" align="center">
                <template #default="{ row }">
                    <el-tooltip v-if="row.lastError" :content="row.lastError" v-bind="TABLE_TOOLTIP_OPTIONS">
                        <el-tag :type="statusType(row.buildStatus)">{{ $t('nginx.' + row.buildStatus) }}</el-tag>
                    </el-tooltip>
                    <el-tag v-else :type="statusType(row.buildStatus)">{{ $t('nginx.' + row.buildStatus) }}</el-tag>
                </template>
            </el-table-column>
            <el-table-column :label="$t('commons.table.status')" min-width="160" align="center" fix>
                <template #default="{ row }">
                    <el-switch v-permission v-model="row.enable" @change="updateModule(row)" />
                </template>
            </el-table-column>
            <fu-table-operations
                :ellipsis="2"
                width="auto"
                min-width="160"
                :buttons="buttons"
                :label="$t('commons.table.operate')"
                fixed="right"
                fix
            />
        </ComplexTable>
        <Operate ref="operateRef" @close="search" />
        <OpDialog ref="deleteRef" @search="search" @cancel="search" />
        <Build ref="buildRef" />
    </div>
</template>
<script lang="ts" setup>
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import type { OpenrestyModule } from '@/gen/panel/agent/v1/openresty_pb';
import { MsgSuccess } from '@/utils/message';
import Operate from './operate/index.vue';
import Build from './build/index.vue';
import { onMounted, ref } from 'vue';

const data = ref<OpenrestyModule[]>([]);
const loading = ref(false);
const buttons = [
    {
        label: i18n.global.t('commons.button.view'),
        permission: true,
        show: (row: OpenrestyModule) => !row.custom,
        click: function (row: OpenrestyModule) {
            openView(row);
        },
    },
    {
        label: i18n.global.t('commons.button.edit'),
        permission: true,
        show: (row: OpenrestyModule) => row.custom,
        click: function (row: OpenrestyModule) {
            openEdit(row);
        },
    },
    {
        label: i18n.global.t('commons.button.delete'),
        permission: true,
        show: (row: OpenrestyModule) => row.custom,
        click: function (row: OpenrestyModule) {
            deleteModule(row);
        },
    },
];
const operateRef = ref();
const deleteRef = ref();
const buildRef = ref();
const dynamicSupported = ref(true);

const buildNginx = async () => {
    buildRef.value.acceptParams();
};

const search = async () => {
    loading.value = true;
    try {
        const res = await rpc.openresty.getModules({});
        data.value = res.items;
        dynamicSupported.value = res.dynamicSupported;
    } finally {
        loading.value = false;
    }
};

const openOperate = () => {
    operateRef.value.acceptParams('create', undefined, dynamicSupported.value);
};

const openEdit = (row: OpenrestyModule) => {
    operateRef.value.acceptParams('update', row, dynamicSupported.value);
};

const openView = (row: OpenrestyModule) => {
    operateRef.value.acceptParams('view', row, dynamicSupported.value);
};

const updateModule = (row: OpenrestyModule) => {
    loading.value = true;
    rpc.openresty
        .updateModule({
            operate: 'update',
            name: row.name,
            script: row.script,
            packages: row.packages,
            enable: row.enable,
            params: row.params,
            buildMode: row.buildMode,
            provider: row.provider,
            loadOrder: row.loadOrder,
        })
        .then(() => {
            MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
        })
        .catch(() => {
            row.enable = !row.enable;
        })
        .finally(() => {
            loading.value = false;
            search();
        });
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const statusType = (status: string) => {
    if (status === 'ready') return 'success';
    if (status === 'failed') return 'danger';
    return 'info';
};

const deleteModule = async (row: OpenrestyModule) => {
    const data = {
        name: row.name,
        operate: 'delete',
    };
    deleteRef.value.acceptParams({
        title: i18n.global.t('commons.button.delete'),
        names: [row.name],
        msg: i18n.global.t('commons.msg.operatorHelper', [
            i18n.global.t('nginx.module'),
            i18n.global.t('commons.button.delete'),
        ]),
        api: rpc.openresty.updateModule,
        params: data,
    });
};

onMounted(() => {
    search();
});
</script>
