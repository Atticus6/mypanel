import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import CreateDialog from '@/pages/containers/_components/network/create/index';
import DetailDrawer from '@/pages/containers/_components/network/detail/index';
import { dateFormat } from '@/utils/date';
import { newUUID } from '@/utils/id';
import { rpc } from '@/lib/rpc';
import { Container } from '@/types/container';
import TaskLog from '@/components/log/task/index';
import i18n from '@/lang';
import DockerStatus from '@/pages/containers/_components/docker-status/index';
interface DialogExpose {
    acceptParams: () => void;
}
import permissionDirective from '@/directives/modules/permission';
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
    name: 'network',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const detailDrawerRef = ref();
        const taskLogRef = ref();
        const data = ref();
        const selects = ref<any>([]);
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        const searchName = ref();
        useSearchState(
            'container/network/index',
            {
                search: searchName,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const opRef = ref();
        const isActive = ref(false);
        const isExist = ref(false);
        const dialogCreateRef = ref<DialogExpose>();
        const onCreate = async () => {
            dialogCreateRef.value!.acceptParams();
        };
        const onClean = () => {
            ElMessageBox.confirm(
                i18n.global.t('container.networkPruneHelper'),
                i18n.global.t('container.networkPrune'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            ).then(async () => {
                loading.value = true;
                let params = {
                    taskID: newUUID(),
                    pruneType: 'network',
                    withTagAll: false,
                };
                await rpc.container
                    .prune(params)
                    .then(() => {
                        loading.value = false;
                        openTaskLog(params.taskID);
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        function selectable(row) {
            return !row.isSystem;
        }
        const search = async () => {
            if (!isActive.value || !isExist.value) {
                return;
            }
            const params = {
                info: searchName.value,
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
            };
            loading.value = true;
            await rpc.container
                .searchNetworks(params)
                .then((res) => {
                    loading.value = false;
                    data.value = res.items || [];
                    for (const item of data.value) {
                        item.isSystem = isSystem(item.name);
                    }
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const batchDelete = async (row: Container.NetworkInfo | null) => {
            let names: Array<string> = [];
            let hasPanelNetwork;
            if (row === null) {
                selects.value.forEach((item: Container.NetworkInfo) => {
                    if (item.name === '1panel-network') {
                        hasPanelNetwork = true;
                    }
                    names.push(item.name);
                });
            } else {
                if (row.name === '1panel-network') {
                    hasPanelNetwork = true;
                }
                names.push(row.name);
            }
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: hasPanelNetwork
                    ? i18n.global.t('container.networkHelper')
                    : i18n.global.t('commons.msg.operatorHelper', [
                          i18n.global.t('container.network'),
                          i18n.global.t('commons.button.delete'),
                      ]),
                api: (params: { names: string[] }) => rpc.container.deleteNetworks(params),
                params: { names: names },
            });
        };
        const onInspect = async (id: string) => {
            const res = await rpc.container.inspect({ id: id, type: 'network' });
            let networkData = JSON.parse(res.content);
            detailDrawerRef.value!.acceptParams({ data: networkData });
        };
        function isSystem(val: string) {
            return val === 'bridge' || val === 'none' || val === 'host';
        }
        const buttons = [
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: (row: Container.NetworkInfo) => {
                    batchDelete(row);
                },
                disabled: (row: any) => {
                    return row.isSystem;
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
                            title={$t('container.network', 2)}
                            class={{ mask: !unref(isActive) }}
                            v-slots={{
                                leftToolBar: () => (
                                    <>
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    onCreate();
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
                                                    onClean();
                                                }}
                                            >
                                                {$t('container.networkPrune')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                        {withDirectives(
                                            <ElButton
                                                disabled={unref(selects).length === 0}
                                                onClick={($event?: any) => {
                                                    batchDelete(null);
                                                }}
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
                                            title="network-refresh"
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                        />
                                    </>
                                ),
                                main: () => (
                                    <>
                                        <ComplexTable
                                            selection-context={() => [unref(searchName)]}
                                            row-key="id"
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
                                            <ElTableColumn type="selection" selectable={selectable} fix />
                                            <ElTableColumn
                                                label={$t('commons.table.name')}
                                                width="130"
                                                prop="name"
                                                fix
                                                show-overflow-tooltip
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <ElText
                                                                type="primary"
                                                                onClick={($event?: any) => {
                                                                    onInspect(row.id);
                                                                }}
                                                                class={'cursor-pointer'}
                                                            >
                                                                {row.name}
                                                            </ElText>
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                width="90"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {row.isSystem || row.name === '1panel-network' ? (
                                                                <ElTag round>{'system'}</ElTag>
                                                            ) : null}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('container.driver')}
                                                show-overflow-tooltip
                                                min-width="60"
                                                prop="driver"
                                            />
                                            <ElTableColumn
                                                label={$t('container.subnet')}
                                                min-width="80"
                                                prop="subnet"
                                                fix
                                            />
                                            <ElTableColumn
                                                label={$t('container.gateway')}
                                                min-width="80"
                                                prop="gateway"
                                                fix
                                            />
                                            <ElTableColumn
                                                label={$t('container.tag')}
                                                min-width="140"
                                                fix
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {(row.labels || []).map((item, index) => (
                                                                <div key={index}>
                                                                    {row.expand ||
                                                                    (!row.expand && Number(index) < 3) ? (
                                                                        <div>
                                                                            <ElButton
                                                                                plain
                                                                                size="small"
                                                                                class={'mt-0.5'}
                                                                            >
                                                                                {item}
                                                                            </ElButton>
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            ))}
                                                            {!row.expand && row.labels.length > 3 ? (
                                                                <div>
                                                                    <ElButton
                                                                        link
                                                                        onClick={($event?: any) => {
                                                                            row.expand = true;
                                                                        }}
                                                                    >
                                                                        {$t('commons.button.expand')}
                                                                        {'... '}
                                                                    </ElButton>
                                                                </div>
                                                            ) : null}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                prop="createdAt"
                                                show-overflow-tooltip
                                                min-width="90"
                                                label={$t('commons.table.date')}
                                                formatter={dateFormat}
                                            />
                                            <FuTableOperations
                                                width="100"
                                                buttons={buttons}
                                                label={$t('commons.table.operate')}
                                                fix
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
                    />
                    <DetailDrawer ref={detailDrawerRef} />
                    <CreateDialog
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        ref={dialogCreateRef}
                    />
                    <TaskLog
                        ref={taskLogRef}
                        width="70%"
                        onClose={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);

definePage({
    name: 'Network',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.network',
        hidden: true,
    },
});
