import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { useSearchState } from '@/utils/search-reset';
import ConfirmDialog from '@/components/confirm-dialog/index';
import { dateFormatServerTimezone } from '@/utils/date';
import { downloadFile } from '@/utils/file';
import { useGlobalStore } from '@/composables/useGlobalStore';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import ComplexTable from '@/components/table/complex/ComplexTable';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'log',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const loading = ref();
        const data = ref();
        const confirmDialogRef = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        const open = ref();
        const exportConfig = reactive({
            count: 100,
            status: 'All',
        });
        const searchInfo = ref();
        useSearchState(
            'host/ssh/log/log',
            {
                search: searchInfo,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const searchStatus = ref('All');
        const search = async () => {
            let params = {
                info: searchInfo.value,
                status: searchStatus.value,
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
            };
            loading.value = true;
            await rpc.ssh
                .searchLogs(params)
                .then((res) => {
                    loading.value = false;
                    data.value = res.items || [];
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onExport = async () => {
            open.value = true;
            exportConfig.status = 'All';
            exportConfig.count = -1;
        };
        const onClean = () => {
            confirmDialogRef.value.acceptParams({
                header: i18n.global.t('logs.deleteLogs'),
                operationInfo: i18n.global.t('commons.msg.delete'),
                submitInputInfo: i18n.global.t('logs.deleteLogs'),
            });
        };
        const onSubmitClean = async () => {
            loading.value = true;
            await rpc.ssh
                .cleanLogs({})
                .then(() => {
                    paginationConfig.currentPage = 1;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    search();
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onSubmitExport = async () => {
            let params = {
                info: '',
                status: exportConfig.status,
                page: 1,
                pageSize: exportConfig.count,
            };
            await rpc.ssh
                .exportLogs(params)
                .then((res) => {
                    if (res.path) {
                        downloadFile(res.path, currentNode.value);
                    }
                    open.value = false;
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                {withDirectives(
                    <LayoutContent
                        title={$t('ssh.loginLogs', 2)}
                        v-slots={{
                            prompt: () => (
                                <>
                                    <ElAlert type="info" title={$t('ssh.sshAlert2')} closable={false} />
                                    <div class={'mt-2'}>
                                        <ElAlert type="info" title={$t('ssh.sshAlert')} closable={false} />
                                    </div>
                                </>
                            ),
                            leftToolBar: () => (
                                <>
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            plain
                                            onClick={($event?: any) => {
                                                (onClean as any)($event);
                                            }}
                                        >
                                            {$t('logs.deleteLogs')}
                                        </ElButton>,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
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
                                </>
                            ),
                            rightToolBar: () => (
                                <>
                                    <ElSelect
                                        modelValue={unref(searchStatus)}
                                        onUpdate:modelValue={($v) => {
                                            searchStatus.value = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            search();
                                        }}
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('commons.table.status')}</> }}
                                    >
                                        <ElOption label={$t('commons.table.all')} value="All" />
                                        <ElOption label={$t('commons.status.success')} value="Success" />
                                        <ElOption label={$t('commons.status.failed')} value="Failed" />
                                    </ElSelect>
                                    <TableSearch
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        searchName={unref(searchInfo)}
                                        onUpdate:searchName={($v) => {
                                            searchInfo.value = $v as any;
                                        }}
                                    />
                                    <TableRefresh
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    />
                                    <TableSetting
                                        title="ssh-log-refresh"
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    />
                                </>
                            ),
                            main: () => (
                                <>
                                    <ComplexTable
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        data={unref(data)}
                                        onSearch={($event?: any) => {
                                            (search as any)($event);
                                        }}
                                        heightDiff={400}
                                    >
                                        <ElTableColumn min-width="80" label={$t('logs.loginIP')} prop="address" />
                                        <ElTableColumn min-width="60" label={$t('ssh.belong')} prop="area" />
                                        <ElTableColumn min-width="60" label={$t('commons.table.port')} prop="port" />
                                        <ElTableColumn
                                            min-width="60"
                                            label={$t('ssh.loginMode')}
                                            prop="authMode"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.authMode ? <span>{$t('ssh.' + row.authMode)}</span> : null}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn min-width="60" label={$t('commons.table.user')} prop="user" />
                                        <ElTableColumn
                                            min-width="60"
                                            label={$t('logs.loginStatus')}
                                            prop="status"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.status === 'Success' ? (
                                                            <div>
                                                                <ElTag type="success">
                                                                    {$t('commons.status.success')}
                                                                </ElTag>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <ElTooltip
                                                                    effect="dark"
                                                                    content={row.message}
                                                                    {...TABLE_TOOLTIP_OPTIONS}
                                                                    class={'box-item'}
                                                                >
                                                                    <ElTag type="danger">
                                                                        {$t('commons.status.failed')}
                                                                    </ElTag>
                                                                </ElTooltip>
                                                            </div>
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            prop="date"
                                            label={$t('commons.table.date')}
                                            formatter={dateFormatServerTimezone}
                                            show-overflow-tooltip
                                        />
                                    </ComplexTable>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
                <DialogPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    title={$t('commons.button.export')}
                    size="mini"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            open.value = false;
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                (onSubmitExport as any)($event);
                                            }}
                                            disabled={unref(loading)}
                                        >
                                            {$t('commons.button.confirm')}
                                        </ElButton>,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                </span>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm
                            ref="backupForm"
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                            class={'mt-5'}
                        >
                            <ElFormItem label={$t('commons.table.status')}>
                                <ElSelect
                                    modelValue={exportConfig.status}
                                    onUpdate:modelValue={($v) => {
                                        exportConfig.status = $v as any;
                                    }}
                                    class={'w-full'}
                                >
                                    <ElOption label={$t('commons.table.all')} value="All" />
                                    <ElOption label={$t('commons.status.success')} value="Success" />
                                    <ElOption label={$t('commons.status.failed')} value="Failed" />
                                </ElSelect>
                            </ElFormItem>
                            <ElFormItem label={$t('container.lines')}>
                                <ElSelect
                                    modelValue={exportConfig.count}
                                    onUpdate:modelValue={($v) => {
                                        exportConfig.count = $v === '' ? $v : Number($v);
                                    }}
                                    class={'tailClass'}
                                >
                                    <ElOption value={-1} label={$t('commons.table.all')} />
                                    <ElOption value={100} label={100} />
                                    <ElOption value={200} label={200} />
                                    <ElOption value={500} label={500} />
                                    <ElOption value={1000} label={1000} />
                                </ElSelect>
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DialogPro>
                <ConfirmDialog
                    ref={confirmDialogRef}
                    onConfirm={($event?: any) => {
                        (onSubmitClean as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
