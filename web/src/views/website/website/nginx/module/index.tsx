import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import type { OpenrestyModule } from '@/gen/panel/agent/v1/openresty_pb';
import { MsgSuccess } from '@/utils/message';
import Operate from './operate/index';
import Build from './build/index';
import permissionDirective from '@/directives/modules/permission';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'module',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
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
        return () => (
            <div>
                {withDirectives(
                    <ComplexTable
                        data={unref(data)}
                        onSearch={($event?: any) => {
                            search();
                        }}
                        heightDiff={350}
                        v-slots={{
                            toolbar: () => (
                                <>
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                (openOperate as any)($event);
                                            }}
                                        >
                                            {$t('commons.button.create')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            plain
                                            onClick={($event?: any) => {
                                                (buildNginx as any)($event);
                                            }}
                                        >
                                            {$t('nginx.build')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                    <ElText type="warning" class={'!ml-2'}>
                                        {$t('nginx.buildHelper')}
                                    </ElText>
                                </>
                            ),
                        }}
                    >
                        <ElTableColumn prop="name" label={$t('commons.table.name')} min-width="320" />
                        <ElTableColumn
                            label={$t('nginx.buildMode')}
                            min-width="160"
                            align="center"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        <ElTag effect="plain" type={row.buildMode === 'static' ? 'warning' : 'primary'}>
                                            {$t('nginx.buildMode' + capitalize(row.buildMode))}
                                        </ElTag>
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label={$t('nginx.buildStatus')}
                            min-width="160"
                            align="center"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {row.lastError ? (
                                            <ElTooltip content={row.lastError} {...TABLE_TOOLTIP_OPTIONS}>
                                                <ElTag type={statusType(row.buildStatus)}>
                                                    {$t('nginx.' + row.buildStatus)}
                                                </ElTag>
                                            </ElTooltip>
                                        ) : (
                                            <ElTag type={statusType(row.buildStatus)}>
                                                {$t('nginx.' + row.buildStatus)}
                                            </ElTag>
                                        )}
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label={$t('commons.table.status')}
                            min-width="160"
                            align="center"
                            fix
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {withDirectives(
                                            <ElSwitch
                                                modelValue={row.enable}
                                                onUpdate:modelValue={($v) => {
                                                    row.enable = $v as any;
                                                }}
                                                onChange={($event?: any) => {
                                                    updateModule(row);
                                                }}
                                            />,
                                            [[permissionDirective, true]],
                                        )}
                                    </>
                                ),
                            }}
                        />
                        <FuTableOperations
                            ellipsis={2}
                            width="auto"
                            min-width="160"
                            buttons={buttons}
                            label={$t('commons.table.operate')}
                            fixed="right"
                            fix
                        />
                    </ComplexTable>,
                    [[vLoading, unref(loading)]],
                )}
                <Operate
                    ref={operateRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <OpDialog
                    ref={deleteRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    onCancel={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <Build ref={buildRef} />
            </div>
        );
    },
    options,
);
