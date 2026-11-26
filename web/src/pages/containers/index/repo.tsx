import { $t } from '@/utils/i18n-t';
interface RepoInfo {
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
import OperatorDialog from '@/pages/views/container/repo/operator/index';
import { dateFormat } from '@/utils/date';
import { rpc } from '@/lib/rpc';
import DockerStatus from '@/pages/views/container/docker-status/index';
import i18n from '@/lang';
import permissionDirective from '@/directives/modules/permission';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import ComplexTable from '@/components/table/complex/ComplexTable';
import Status from '@/components/status/index';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';
import ConfirmDialog from '@/components/confirm-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'repo',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
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
            {
                search: searchName,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
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
            await rpc.container
                .deleteRepo({ id: currentRepo.value })
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
            await rpc.container
                .checkRepoStatus({ id: row.id })
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
        return () =>
            withDirectives(
                <div>
                    <DockerStatus
                        isActive={unref(isActive)}
                        onUpdate:isActive={($v) => {
                            isActive.value = $v as any;
                        }}
                        isExist={unref(isExist)}
                        onUpdate:isExist={($v) => {
                            isExist.value = $v as any;
                        }}
                        loading={unref(loading)}
                        onUpdate:loading={($v) => {
                            loading.value = $v as any;
                        }}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    {unref(isExist) ? (
                        <LayoutContent
                            title={$t('container.repo', 2)}
                            class={{ mask: !unref(isActive) }}
                            v-slots={{
                                leftToolBar: () => (
                                    <>
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    onOpenDialog('add');
                                                }}
                                            >
                                                {$t('commons.button.add')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
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
                                                search();
                                            }}
                                        />
                                        <TableSetting
                                            title="repo-refresh"
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
                                            selects={unref(selects)}
                                            onUpdate:selects={($v) => {
                                                selects.value = $v as any;
                                            }}
                                            data={unref(data)}
                                            onSearch={($event?: any) => {
                                                (search as any)($event);
                                            }}
                                            heightDiff={300}
                                        >
                                            <ElTableColumn
                                                label={$t('commons.table.name')}
                                                prop="name"
                                                min-width="60"
                                            />
                                            <ElTableColumn
                                                label={$t('container.downloadUrl')}
                                                show-overflow-tooltip
                                                prop="downloadUrl"
                                                min-width="100"
                                                fix
                                            />
                                            <ElTableColumn
                                                label={$t('commons.table.protocol')}
                                                prop="protocol"
                                                min-width="60"
                                                fix
                                            />
                                            <ElTableColumn
                                                label={$t('commons.table.status')}
                                                prop="status"
                                                min-width="60"
                                                fix
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <Status status={row.status} msg={row.message} />
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                prop="createdAt"
                                                label={$t('commons.table.createdAt')}
                                                min-width="80"
                                                fix
                                                formatter={dateFormat}
                                            />
                                            <FuTableOperations
                                                width="200px"
                                                buttons={buttons}
                                                label={$t('commons.table.operate')}
                                            />
                                        </ComplexTable>
                                    </>
                                ),
                            }}
                        />
                    ) : null}
                    <OpDialog
                        ref={opRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        onSubmit={($event?: any) => {
                            (submitDelete as any)($event);
                        }}
                    />
                    <OperatorDialog
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        ref={dialogRef}
                    />
                    <ConfirmDialog
                        ref={confirmDialog}
                        onConfirm={($event?: any) => {
                            (submitDelete as any)($event);
                        }}
                    />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);

definePage({
    name: 'Repo',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.repo',
        hidden: true,
    },
});
