import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import OperateDialog from './operate/index';
import ImportDialog from './import/index';
import FireRouter from '@/pages/views/host/firewall/index';
import FireStatus from '@/pages/views/host/firewall/status/index';
import RuleReset from '@/pages/views/host/firewall/components/rule-reset';
import TaskLog from '@/components/log/task/index';
import { Firewall } from '@/types/firewall';
import { buildForwardRuleExport } from './transfer';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { getErrorMessage } from '@/utils/misc';
import { getHttpResponseMessage } from '@/api/http-core';
import { downloadWithContent } from '@/utils/file';
import { getCurrentDateFormatted } from '@/utils/date';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'forward',
    props: {},
    emits: emits,
    __scopeId: 'data-v-88083b58',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const selects = ref<any>([]);
        const searchName = ref();
        const isInit = ref(false);
        const isBind = ref(false);
        const fireName = ref();
        const fireStatusRef = ref();
        const cleanupConfirmRef = ref<InstanceType<typeof RuleReset>>();
        const taskLogRef = ref<InstanceType<typeof TaskLog>>();
        const openRuleTask = (taskID: string) => taskLogRef.value?.openWithTaskID(taskID, true);
        const refreshRules = async () => {
            await fireStatusRef.value?.acceptParams();
        };
        const cleanupBackend = () => {
            if (fireName.value !== 'iptables' && fireName.value !== 'nftables') return;
            cleanupConfirmRef.value?.acceptParams({
                message: i18n.global.t('firewall.cleanupForwardingBackendHelper', [fireName.value]),
                provider: fireName.value,
            });
        };
        const submitCleanupBackend = async (backup: boolean) => {
            if (fireName.value !== 'iptables' && fireName.value !== 'nftables') return;
            loading.value = true;
            try {
                const result = await rpc.firewall.resetRules({
                    subsystem: 'forwarding',
                    provider: fireName.value,
                    backup,
                });
                if (result.backupPath)
                    await ElMessageBox.alert(result.backupPath, i18n.global.t('commons.button.export'));
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                await fireStatusRef.value?.acceptParams();
            } finally {
                loading.value = false;
            }
        };
        const opRef = ref();
        const dialogImportRef = ref();
        const operateRules = ref();
        const data = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        useSearchState(
            'host/firewall/forward/index',
            {
                search: searchName,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const search = async () => {
            if (!isInit.value || !isBind.value || fireName.value === '-') {
                loading.value = false;
                data.value = [];
                paginationConfig.total = 0;
                return;
            }
            let params = {
                strategy: '',
                info: searchName.value,
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
            };
            loading.value = true;
            await rpc.firewall
                .searchForwardRules(params)
                .then((res) => {
                    loading.value = false;
                    data.value =
                        (res.items as any[])?.map((item: any) => {
                            return {
                                ...item,
                                interface: item.interface === '*' ? '' : item.interface,
                            };
                        }) || [];
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const dialogRef = ref();
        const onOpenDialog = async (
            title: string,
            rowData: Partial<Firewall.RuleForward> = {
                family: 'ipv4',
                protocol: 'tcp',
                port: '8080',
                targetIP: '',
                targetPort: '',
                interface: '',
            },
        ) => {
            let params = {
                title,
                rowData: { ...rowData },
            };
            dialogRef.value!.acceptParams(params);
        };
        const onDelete = async (row: Firewall.RuleForward | null) => {
            let names = [];
            let rules = [];
            if (row) {
                rules.push({
                    ...row,
                    operation: 'remove',
                });
                names = [row.port + ' (' + row.protocol + ')'];
            } else {
                for (const item of selects.value) {
                    names.push(item.port + ' (' + item.protocol + ')');
                    rules.push({
                        ...item,
                        operation: 'remove',
                    });
                }
            }
            operateRules.value = rules;
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('firewall.forwardRule'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: null,
                params: null,
            });
        };
        const onSubmitDelete = async () => {
            if (loading.value) return;
            loading.value = true;
            try {
                const result = await rpc.firewall.operateForwardRules({ rules: operateRules.value } as any);
                if (!result.taskId || !result.queued) {
                    MsgError(i18n.global.t('commons.msg.operationFailed'));
                    return;
                }
                openRuleTask(result.taskId);
            } catch (error) {
                MsgError(
                    getHttpResponseMessage(error) ||
                        (error && getErrorMessage(error)) ||
                        i18n.global.t('commons.res.commonError'),
                );
            } finally {
                loading.value = false;
            }
        };
        const onImport = () => {
            dialogImportRef.value.acceptParams(fireName.value);
        };
        const loadAllRules = async (): Promise<Firewall.RuleForward[]> => {
            const response = await rpc.firewall.searchForwardRules({
                all: true,
                strategy: '',
                info: '',
                page: 1,
                pageSize: paginationConfig.pageSize,
            });
            return ((response.items || []) as any[]).map((item) => ({
                operation: '',
                family: item.family === 'ipv6' ? 'ipv6' : 'ipv4',
                protocol: item.protocol,
                port: item.port,
                targetIP: item.targetIP,
                targetPort: item.targetPort,
                interface: item.interface || '',
            }));
        };
        const exportRules = async (rules: Firewall.RuleForward[]) => {
            if (rules.length === 0) return;
            await ElMessageBox.confirm(
                i18n.global.t('firewall.exportHelper', [rules.length]),
                i18n.global.t('commons.button.export'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                },
            );
            const exported = buildForwardRuleExport(rules);
            downloadWithContent(
                JSON.stringify(exported, null, 2),
                `1panel-firewall-forward-${getCurrentDateFormatted()}.json`,
            );
        };
        const onExport = async () => exportRules(selects.value.length > 0 ? selects.value : await loadAllRules());
        const buttons = [
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                nodeAdmin: true,
                click: (row: Firewall.RuleForward) => {
                    onOpenDialog('edit', row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                nodeAdmin: true,
                click: (row: Firewall.RuleForward) => {
                    onDelete(row);
                },
            },
        ];
        onMounted(() => {
            if (fireName.value !== '-') {
                loading.value = true;
                fireStatusRef.value.acceptParams();
            }
        });
        return () => (
            <div>
                <FireRouter />
                {withDirectives(
                    <div>
                        <FireStatus
                            ref={fireStatusRef}
                            onSearch={($event?: any) => {
                                (search as any)($event);
                            }}
                            loading={unref(loading)}
                            onUpdate:loading={($v) => {
                                loading.value = $v as any;
                            }}
                            is-init={unref(isInit)}
                            onUpdate:is-init={($v) => {
                                isInit.value = $v as any;
                            }}
                            is-bind={unref(isBind)}
                            onUpdate:is-bind={($v) => {
                                isBind.value = $v as any;
                            }}
                            name={unref(fireName)}
                            onUpdate:name={($v) => {
                                fireName.value = $v as any;
                            }}
                            current-tab="forward"
                            v-slots={{
                                actions: () => (
                                    <>
                                        <ElDivider direction="vertical" />
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                link
                                                onClick={($event?: any) => {
                                                    (cleanupBackend as any)($event);
                                                }}
                                            >
                                                {$t('commons.button.reset')}
                                            </ElButton>,
                                            [
                                                [permissionDirective, true],
                                                [nodeAdminDirective, true],
                                            ],
                                        )}
                                    </>
                                ),
                            }}
                        />
                        {unref(fireName) !== '-' ? (
                            <div>
                                {!unref(isInit) || !unref(isBind) ? (
                                    <ElCard class={'mask-prompt'}>
                                        {!unref(isInit) ? (
                                            <span>{$t('firewall.initHelper', [`${fireName}-forward`])}</span>
                                        ) : (
                                            <span>{$t('firewall.basicStatus')}</span>
                                        )}
                                    </ElCard>
                                ) : null}
                                <LayoutContent
                                    title={$t('firewall.forwardRule', 2)}
                                    class={{ mask: !unref(isInit) || !unref(isBind) }}
                                    v-slots={{
                                        leftToolBar: () => (
                                            <>
                                                {withDirectives(
                                                    <ElButton
                                                        type="primary"
                                                        onClick={($event?: any) => {
                                                            onOpenDialog('create');
                                                        }}
                                                    >
                                                        {$t('commons.button.create')}
                                                    </ElButton>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )}
                                                {withDirectives(
                                                    <ElButton
                                                        onClick={($event?: any) => {
                                                            onDelete(null);
                                                        }}
                                                        plain
                                                        disabled={unref(selects).length === 0}
                                                    >
                                                        {$t('commons.button.delete')}
                                                    </ElButton>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )}
                                                <ElButtonGroup>
                                                    {withDirectives(
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                (onImport as any)($event);
                                                            }}
                                                        >
                                                            {$t('commons.button.import')}
                                                        </ElButton>,
                                                        [
                                                            [permissionDirective, true],
                                                            [nodeAdminDirective, true],
                                                        ],
                                                    )}
                                                    {withDirectives(
                                                        <ElButton
                                                            disabled={unref(loading)}
                                                            onClick={($event?: any) => {
                                                                (onExport as any)($event);
                                                            }}
                                                        >
                                                            {$t('commons.button.export')}
                                                        </ElButton>,
                                                        [
                                                            [permissionDirective, true],
                                                            [nodeAdminDirective, true],
                                                        ],
                                                    )}
                                                </ElButtonGroup>
                                            </>
                                        ),
                                        rightToolBar: () => (
                                            <>
                                                <TableSearch
                                                    onSearch={($event?: any) => {
                                                        search();
                                                    }}
                                                    searchName={unref(searchName)}
                                                    onUpdate:searchName={($v) => {
                                                        searchName.value = $v as any;
                                                    }}
                                                />
                                                <TableRefresh
                                                    onSearch={($event?: any) => {
                                                        (refreshRules as any)($event);
                                                    }}
                                                />
                                                <TableSetting
                                                    title="firewall-forward-refresh"
                                                    onSearch={($event?: any) => {
                                                        (refreshRules as any)($event);
                                                    }}
                                                />
                                            </>
                                        ),
                                        main: () => (
                                            <>
                                                <ComplexTable
                                                    selection-context={() => [unref(searchName), unref(fireName)]}
                                                    row-key={(row) =>
                                                        JSON.stringify([
                                                            row.family,
                                                            row.protocol,
                                                            row.port,
                                                            row.targetIP,
                                                            row.targetPort,
                                                            row.interface,
                                                        ])
                                                    }
                                                    cache-pagination={false}
                                                    pagination-config={paginationConfig}
                                                    selects={unref(selects)}
                                                    onUpdate:selects={($v) => {
                                                        selects.value = $v as any;
                                                    }}
                                                    onSearch={($event?: any) => {
                                                        (search as any)($event);
                                                    }}
                                                    data={unref(data)}
                                                    heightDiff={320}
                                                >
                                                    <ElTableColumn type="selection" fix />
                                                    <ElTableColumn
                                                        label="IP"
                                                        min-width={60}
                                                        prop="family"
                                                        v-slots={{
                                                            default: ({ row }) => (
                                                                <>{row.family === 'ipv6' ? 'IPv6' : 'IPv4'}</>
                                                            ),
                                                        }}
                                                    />
                                                    <ElTableColumn
                                                        label={$t('commons.table.protocol')}
                                                        min-width={70}
                                                        prop="protocol"
                                                    />
                                                    <ElTableColumn
                                                        label={$t('firewall.sourcePort')}
                                                        min-width={70}
                                                        prop="port"
                                                    />
                                                    <ElTableColumn
                                                        min-width={80}
                                                        label={$t('firewall.targetIP')}
                                                        prop="targetIP"
                                                    />
                                                    <ElTableColumn
                                                        label={$t('firewall.targetPort')}
                                                        min-width={70}
                                                        prop="targetPort"
                                                    />
                                                    {unref(fireName) === 'iptables' ||
                                                    unref(fireName) === 'nftables' ? (
                                                        <>
                                                            <ElTableColumn
                                                                label={$t('firewall.forwardInboundInterface')}
                                                                min-width={70}
                                                                prop="interface"
                                                                v-slots={{
                                                                    default: ({ row }) => (
                                                                        <>
                                                                            <span>
                                                                                {row.interface === ''
                                                                                    ? $t('commons.table.all')
                                                                                    : row.interface}
                                                                            </span>
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                        </>
                                                    ) : null}
                                                    <FuTableOperations
                                                        width="200px"
                                                        buttons={buttons}
                                                        ellipsis={10}
                                                        label={$t('commons.table.operate')}
                                                        fix
                                                    />
                                                </ComplexTable>
                                            </>
                                        ),
                                    }}
                                />
                            </div>
                        ) : null}
                    </div>,
                    [[vLoading, unref(loading)]],
                )}
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    onSubmit={($event?: any) => {
                        onSubmitDelete();
                    }}
                />
                <OperateDialog
                    onCreated={($event?: any) => {
                        (openRuleTask as any)($event);
                    }}
                    ref={dialogRef}
                />
                <ImportDialog
                    onCreated={($event?: any) => {
                        (openRuleTask as any)($event);
                    }}
                    ref={dialogImportRef}
                />
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (refreshRules as any)($event);
                    }}
                />
                <RuleReset
                    ref={cleanupConfirmRef}
                    onConfirm={($event?: any) => {
                        (submitCleanupBackend as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
