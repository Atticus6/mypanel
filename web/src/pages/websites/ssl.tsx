import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { useSearchState } from '@/utils/search-reset';
import { downloadFile } from '@/api/modules/website';
import { rpc } from '@/lib/rpc';
import { routerToNameWithQuery } from '@/utils/router';
import Create from '@/pages/websites/_components/ssl/create/index';
import Detail from '@/pages/websites/_components/ssl/detail/index';
import { dateFormat } from '@/utils/date';
import { getProvider } from '@/utils/ssl';
import i18n from '@/lang';
import { Website } from '@/types/website';
import { MsgError, MsgSuccess } from '@/utils/message';
import SSLUpload from '@/pages/websites/_components/ssl/upload/index';
import Apply from '@/pages/websites/_components/ssl/apply/index';
import Log from '@/components/log/file-drawer/index';
import Obtain from '@/pages/websites/_components/ssl/obtain/index';
import MsgInfo from '@/components/msg-info/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { useOperateNodeContext } from '@/composables/useOperateNodeContext';
import TaskLog from '@/components/log/task/index';
import { newUUID } from '@/utils/id';
import { Rules } from '@/global/form-rules';
import permissionDirective from '@/directives/modules/permission';
import RouterButton from '@/components/router-button/index';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import FuTableColumnSelect from '@/components/table/TableColumnSelect';
import ComplexTable from '@/components/table/complex/ComplexTable';
import Status from '@/components/status/index';
import FuReadWriteSwitch from '@/components/fu/FuReadWriteSwitch';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ssl',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode, isMobile, isMaster, isXpackOrEE } = useGlobalStore();
        useOperateNodeContext(currentNode);
        const PushToNode = defineAsyncComponent(async () => {
            const modules = import.meta.glob('@/xpack/views/ssl/index.vue');
            const loader = modules['/src/xpack/views/ssl/index.vue'];
            if (loader) {
                return ((await loader()) as any).default;
            }
            return { template: '<div></div>' };
        });
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        const sslCreateRef = ref();
        const detailRef = ref();
        const data = ref();
        const loading = ref(false);
        const opRef = ref();
        const sslUploadRef = ref();
        const applyRef = ref();
        const logRef = ref();
        const taskLogRef = ref();
        const obtainRef = ref();
        const pushFormRef = ref<FormInstance>();
        const pushOpen = ref(false);
        const pushLoading = ref(false);
        let selects = ref<any>([]);
        const columns = ref([]);
        const req = reactive({
            domain: '',
            orderBy: 'updated_at',
            order: 'descending',
        });
        useSearchState(
            'website/ssl/index',
            {
                search: toRef(req, 'domain'),
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const pushForm = ref({
            id: 0,
            pushNode: true,
            pushNodes: [] as string[],
        });
        const pushRules = ref({
            pushNodes: [Rules.requiredSelect],
        });
        const routerButton = [
            {
                label: i18n.global.t('website.ssl', 2),
                path: '/websites/ssl',
            },
        ];
        const shouldRevokeSSL = (row: Website.SSLDTO) => ['dnsAccount', 'dnsManual', 'http'].includes(row.provider);
        const buttons = [
            {
                label: i18n.global.t('ssl.detail'),
                disabled: function (row: Website.SSLDTO) {
                    return row.status === 'init' || row.status === 'error';
                },
                click: function (row: Website.SSLDTO) {
                    openDetail(row.id);
                },
            },
            {
                label: i18n.global.t('ssl.apply'),
                permission: true,
                disabled: function (row: Website.SSLDTO) {
                    return row.status === 'applying' || row.provider === 'manual' || row.provider === 'fromMaster';
                },
                click: function (row: Website.SSLDTO) {
                    if (row.provider === 'dnsManual') {
                        applyRef.value.acceptParams({ ssl: row });
                    } else {
                        applySSL(row);
                    }
                },
                show: function (row: Website.SSLDTO) {
                    return row.provider != 'manual';
                },
            },
            {
                label: i18n.global.t('commons.button.update'),
                permission: true,
                click: function (row: Website.SSLDTO) {
                    sslUploadRef.value.acceptParams(row);
                },
                show: function (row: Website.SSLDTO) {
                    return row.provider == 'manual';
                },
            },
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                disabled: function (row: Website.SSLDTO) {
                    return row.provider === 'fromMaster';
                },
                click: function (row: Website.SSLDTO) {
                    onEdit(row);
                },
                show: function (row: Website.SSLDTO) {
                    return row.provider != 'manual';
                },
            },
            {
                label: i18n.global.t('commons.button.sync'),
                permission: true,
                disabled: function (row: Website.SSLDTO) {
                    return row.status !== 'ready';
                },
                click: function (row: Website.SSLDTO) {
                    openPush(row);
                },
                show: function (row: Website.SSLDTO) {
                    return isMaster.value && isXpackOrEE.value && row.provider !== 'fromMaster';
                },
            },
            {
                label: i18n.global.t('commons.button.download'),
                click: function (row: Website.SSLDTO) {
                    onDownload(row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Website.SSLDTO) {
                    deletessl(row);
                },
                show: (row: Website.SSLDTO) => !shouldRevokeSSL(row),
            },
            {
                label: i18n.global.t('ssl.deleteAndRevoke'),
                permission: true,
                click: function (row: Website.SSLDTO) {
                    deletessl(row);
                },
                show: shouldRevokeSSL,
            },
        ];
        const onDownload = (ssl: Website.SSLDTO) => {
            loading.value = true;
            downloadFile({ id: ssl.id })
                .then((res) => {
                    const downloadUrl = window.URL.createObjectURL(new Blob([res]));
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = downloadUrl;
                    a.download = ssl.primaryDomain + '.zip';
                    const event = new MouseEvent('click');
                    a.dispatchEvent(event);
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const changeSort = ({ order }) => {
            req.orderBy = order ? 'expire_date' : 'updated_at';
            req.order = order || 'descending';
            search();
        };
        const search = () => {
            const request = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                domain: req.domain,
                orderBy: req.orderBy,
                order: req.order || 'descending',
            };
            loading.value = true;
            rpc.ssl
                .search(request)
                .then((res) => {
                    data.value = res.items || [];
                    paginationConfig.total = Number(res.total);
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const searchByDomain = () => {
            paginationConfig.currentPage = 1;
            search();
        };
        const updateDesc = (row: Website.SSLDTO, bulr: Function) => {
            bulr();
            if (row.description && row.description.length > 128) {
                MsgError(i18n.global.t('commons.rule.length128Err'));
                return;
            }
            updateConfig(row);
        };
        const updateConfig = (row: Website.SSLDTO) => {
            loading.value = true;
            row.otherDomains = row.domains?.replace(/,/g, '\n');
            rpc.ssl
                .update(row as any)
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const openAcmeAccount = () => {
            routerToNameWithQuery('SSL-ACME', { uncached: 'true' });
        };
        const openDnsAccount = () => {
            routerToNameWithQuery('SSL-DNS', { uncached: 'true' });
        };
        const openSSL = () => {
            sslCreateRef.value.acceptParams('create');
        };
        const onEdit = (row: Website.SSL) => {
            sslCreateRef.value.acceptParams('edit', row);
        };
        const openUpload = () => {
            sslUploadRef.value.acceptParams();
        };
        const openDetail = (id: number) => {
            detailRef.value.acceptParams(id);
        };
        const openLog = (id: number) => {
            logRef.value.acceptParams({ id: id, type: 'ssl', tail: true });
        };
        const openSSLLog = (row: Website.SSL) => {
            logRef.value.acceptParams({ id: row.id, type: 'ssl', tail: row.status === 'applying' });
        };
        const parsePushNodes = (nodes: string) => {
            return nodes
                ? nodes
                      .split(',')
                      .map((item) => item.trim())
                      .filter((item) => item !== '')
                : [];
        };
        const openPush = (row: Website.SSLDTO) => {
            pushForm.value = {
                id: row.id,
                pushNode: true,
                pushNodes: parsePushNodes(row.nodes),
            };
            pushOpen.value = true;
        };
        const handlePushClose = () => {
            pushOpen.value = false;
            pushFormRef.value?.resetFields();
            pushForm.value = {
                id: 0,
                pushNode: true,
                pushNodes: [],
            };
        };
        const submitPush = async () => {
            if (!pushForm.value.pushNode || pushForm.value.pushNodes.length === 0) {
                MsgError(i18n.global.t('commons.rule.requiredSelect'));
                return;
            }
            await pushFormRef.value?.validate();
            const taskID = newUUID();
            pushLoading.value = true;
            rpc.ssl
                .push({
                    id: pushForm.value.id,
                    pushNode: pushForm.value.pushNode,
                    nodes: pushForm.value.pushNodes.join(','),
                    taskId: taskID,
                })
                .then(() => {
                    handlePushClose();
                    taskLogRef.value.openWithTaskID(taskID);
                    search();
                })
                .finally(() => {
                    pushLoading.value = false;
                });
        };
        const openCA = () => {
            routerToNameWithQuery('SSL-CA', { uncached: 'true' });
        };
        const applySSL = (row: Website.SSLDTO) => {
            obtainRef.value.acceptParams({ ssl: row });
        };
        const deletessl = async (row: any) => {
            const isBatch = row == null;
            const deleteLabel = i18n.global.t(
                !isBatch && shouldRevokeSSL(row) ? 'ssl.deleteAndRevoke' : 'commons.button.delete',
            );
            let names = [];
            let params = {};
            if (isBatch) {
                names = selects.value.map((item: Website.SSLDTO) => item.primaryDomain);
                params = { ids: selects.value.map((item: Website.SSLDTO) => item.id) };
            } else {
                names = [row.primaryDomain];
                params = { ids: [row.id] };
            }

            opRef.value.acceptParams({
                title: deleteLabel,
                names: names,
                msg: isBatch
                    ? i18n.global.t('ssl.deleteConfirm')
                    : i18n.global.t('commons.msg.operatorHelper', [i18n.global.t('website.ssl'), deleteLabel]),
                api: (params: { ids: number[] }) => rpc.ssl.delete({ ids: params.ids }),
                params: params,
            });
            search();
        };
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                <RouterButton buttons={routerButton} />
                <LayoutContent
                    title={$t('website.ssl', 2)}
                    v-slots={{
                        leftToolBar: () => (
                            <>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            openSSL();
                                        }}
                                    >
                                        {$t('ssl.create')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            openUpload();
                                        }}
                                    >
                                        {$t('ssl.upload')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        plain
                                        onClick={($event?: any) => {
                                            openCA();
                                        }}
                                    >
                                        {$t('ssl.selfSigned')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        plain
                                        onClick={($event?: any) => {
                                            openAcmeAccount();
                                        }}
                                    >
                                        {$t('website.acmeAccountManage')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        plain
                                        onClick={($event?: any) => {
                                            openDnsAccount();
                                        }}
                                    >
                                        {$t('website.dnsAccountManage')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                                {withDirectives(
                                    <ElButton
                                        plain
                                        onClick={($event?: any) => {
                                            deletessl(null);
                                        }}
                                        disabled={unref(selects).length === 0}
                                    >
                                        {$t('commons.button.delete')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </>
                        ),
                        rightToolBar: () => (
                            <>
                                <TableSearch
                                    onSearch={($event?: any) => {
                                        (searchByDomain as any)($event);
                                    }}
                                    searchName={req.domain}
                                    onUpdate:searchName={($v) => {
                                        req.domain = $v as any;
                                    }}
                                />
                                <TableRefresh
                                    onSearch={($event?: any) => {
                                        search();
                                    }}
                                />
                                <FuTableColumnSelect
                                    columns={unref(columns)}
                                    trigger="hover"
                                    title={$t('commons.table.selectColumn')}
                                    popper-class="popper-class"
                                    only-icon={true}
                                />
                            </>
                        ),
                        main: () => (
                            <>
                                {withDirectives(
                                    <ComplexTable
                                        data={unref(data)}
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        selects={unref(selects)}
                                        onUpdate:selects={($v) => {
                                            selects.value = $v as any;
                                        }}
                                        columns={unref(columns)}
                                        localKey="sslColumn"
                                        height-diff={260}
                                        onSortChange={($event?: any) => {
                                            (changeSort as any)($event);
                                        }}
                                    >
                                        <ElTableColumn type="selection" width="30" />
                                        <ElTableColumn label="ID" prop="id" width="50px" />
                                        <ElTableColumn
                                            label={$t('website.domain')}
                                            show-overflow-tooltip
                                            prop="primaryDomain"
                                            min-width="150px"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <span>{row.primaryDomain}</span>
                                                        {row.dnsAccount && row.dnsAccount.type === 'DnsPod' ? (
                                                            <ElTooltip
                                                                content={$t('ssl.dnsPodRemovedSSLTip')}
                                                                {...TABLE_TOOLTIP_OPTIONS}
                                                            >
                                                                <ElTag type="danger" size="small" class={'ml-2'}>
                                                                    {' DnsPod '}
                                                                    {$t('ssl.dnsPodRemoved')}
                                                                </ElTag>
                                                            </ElTooltip>
                                                        ) : null}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('website.otherDomains')}
                                            show-overflow-tooltip
                                            prop="domains"
                                            min-width="90px"
                                        />
                                        <ElTableColumn
                                            label={$t('ssl.applyType')}
                                            show-overflow-tooltip
                                            prop="provider"
                                            width="200px"
                                            v-slots={{ default: ({ row }) => <>{getProvider(row.provider)}</> }}
                                        />
                                        <ElTableColumn
                                            label={$t('ssl.acmeAccount')}
                                            show-overflow-tooltip
                                            prop="acmeAccount.email"
                                            width="150px"
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.status')}
                                            show-overflow-tooltip
                                            prop="status"
                                            width="110px"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.status === 'error' ||
                                                        row.status === 'applyError' ||
                                                        row.status === 'systemRestart' ? (
                                                            <ElPopover
                                                                placement="bottom"
                                                                width={400}
                                                                trigger="hover"
                                                                v-slots={{
                                                                    reference: () => (
                                                                        <>
                                                                            <Status
                                                                                status={row.status}
                                                                                key={row.status}
                                                                            />
                                                                        </>
                                                                    ),
                                                                }}
                                                            >
                                                                <div class={'max-h-96 overflow-auto'}>
                                                                    <span>{row.message}</span>
                                                                </div>
                                                            </ElPopover>
                                                        ) : (
                                                            <div>
                                                                <Status status={row.status} key={row.status} />
                                                            </div>
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.button.log')}
                                            prop="log"
                                            width="80px"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.provider != 'manual' && row.provider !== 'fromMaster' ? (
                                                            <ElButton
                                                                onClick={($event?: any) => {
                                                                    openSSLLog(row);
                                                                }}
                                                                link
                                                                type="primary"
                                                            >
                                                                {$t('website.check')}
                                                            </ElButton>
                                                        ) : null}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('website.brand')}
                                            show-overflow-tooltip
                                            prop="organization"
                                            width="150px"
                                        />
                                        <ElTableColumn
                                            label={$t('website.remark')}
                                            prop="description"
                                            width="100px"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {withDirectives(
                                                            <FuReadWriteSwitch
                                                                v-slots={{
                                                                    read: () => (
                                                                        <>
                                                                            <MsgInfo
                                                                                info={row.description}
                                                                                width="200"
                                                                            />
                                                                        </>
                                                                    ),
                                                                    default: ({ read }) => (
                                                                        <>
                                                                            <ElInput
                                                                                modelValue={row.description}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    row.description = $v as any;
                                                                                }}
                                                                                onBlur={($event?: any) => {
                                                                                    updateDesc(row, read);
                                                                                }}
                                                                            />
                                                                        </>
                                                                    ),
                                                                }}
                                                            />,
                                                            [[permissionDirective, true]],
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('ssl.autoRenew')}
                                            prop="autoRenew"
                                            width="200px"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {withDirectives(
                                                            <ElSwitch
                                                                disabled={
                                                                    row.provider === 'dnsManual' ||
                                                                    row.provider === 'manual' ||
                                                                    row.provider === 'fromMaster'
                                                                }
                                                                modelValue={row.autoRenew}
                                                                onUpdate:modelValue={($v) => {
                                                                    row.autoRenew = $v as any;
                                                                }}
                                                                onChange={($event?: any) => {
                                                                    updateConfig(row);
                                                                }}
                                                            />,
                                                            [[permissionDirective, true]],
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            prop="expireDate"
                                            label={$t('website.expireDate')}
                                            formatter={dateFormat}
                                            show-overflow-tooltip
                                            width="180px"
                                            sortable
                                        />
                                        <FuTableOperations
                                            ellipsis={3}
                                            buttons={buttons}
                                            label={$t('commons.table.operate')}
                                            fixed={unref(isMobile) ? false : 'right'}
                                            width="320px"
                                            fix
                                        />
                                    </ComplexTable>,
                                    [[vLoading, unref(loading)]],
                                )}
                            </>
                        ),
                    }}
                >
                    <Create
                        ref={sslCreateRef}
                        onClose={($event?: any) => {
                            search();
                        }}
                        onSubmit={($event?: any) => {
                            (openLog as any)($event);
                        }}
                    />
                    <Detail ref={detailRef} />
                    <SSLUpload
                        ref={sslUploadRef}
                        onClose={($event?: any) => {
                            search();
                        }}
                    />
                    <Apply
                        ref={applyRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        onSubmit={($event?: any) => {
                            (openLog as any)($event);
                        }}
                    />
                    <OpDialog
                        ref={opRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        onCancel={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <Log
                        ref={logRef}
                        onClose={($event?: any) => {
                            search();
                        }}
                        heightDiff={220}
                    />
                    <Obtain
                        ref={obtainRef}
                        onClose={($event?: any) => {
                            search();
                        }}
                        onSubmit={($event?: any) => {
                            (openLog as any)($event);
                        }}
                    />
                    <DrawerPro
                        modelValue={unref(pushOpen)}
                        onUpdate:modelValue={($v) => {
                            pushOpen.value = $v as any;
                        }}
                        header={$t('commons.button.sync')}
                        size="large"
                        onClose={($event?: any) => {
                            (handlePushClose as any)($event);
                        }}
                        v-slots={{
                            footer: () => (
                                <>
                                    <span class={'dialog-footer'}>
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (handlePushClose as any)($event);
                                            }}
                                            disabled={unref(pushLoading)}
                                        >
                                            {$t('commons.button.cancel')}
                                        </ElButton>
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    (submitPush as any)($event);
                                                }}
                                                disabled={unref(pushLoading)}
                                            >
                                                {$t('commons.button.confirm')}
                                            </ElButton>,
                                            [[permissionDirective, 'website_cert_manage']],
                                        )}
                                    </span>
                                </>
                            ),
                        }}
                    >
                        {withDirectives(
                            <ElForm
                                ref={pushFormRef}
                                label-position="top"
                                model={unref(pushForm)}
                                rules={unref(pushRules)}
                            >
                                {unref(isMaster) && unref(isXpackOrEE) ? (
                                    <PushToNode
                                        push-node={unref(pushForm).pushNode}
                                        nodes={unref(pushForm).pushNodes}
                                        type="ssl"
                                        onUpdate:push-node={($event?: any) => {
                                            unref(unref(pushForm)).pushNode = $event;
                                        }}
                                        onUpdate:nodes={($event?: any) => {
                                            unref(unref(pushForm)).pushNodes = $event;
                                        }}
                                    />
                                ) : null}
                            </ElForm>,
                            [[vLoading, unref(pushLoading)]],
                        )}
                    </DrawerPro>
                    <TaskLog
                        ref={taskLogRef}
                        onClose={($event?: any) => {
                            search();
                        }}
                    />
                </LayoutContent>
            </div>
        );
    },
    options,
);

definePage({
    name: 'SSL',
    meta: { icon: 'p-ssl-menu', title: 'menu.ssl', permission: 'website_cert_view' },
});
