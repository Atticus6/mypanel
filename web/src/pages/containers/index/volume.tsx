import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { useSearchState } from '@/utils/search-reset';
import CreateDialog from '@/pages/containers/_components/volume/create/index';
import CodemirrorDrawer from '@/components/codemirror-pro/drawer';
import DockerStatus from '@/pages/containers/_components/docker-status/index';
import { dateFormat } from '@/utils/date';
import { newUUID } from '@/utils/id';
import { rpc } from '@/lib/rpc';
import { Container } from '@/types/container';
import TaskLog from '@/components/log/task/index';
import i18n from '@/lang';
import { routerToFileWithPath } from '@/utils/router';
import { MsgError } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
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
    name: 'volume',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMobile } = useGlobalStore();
        const taskLogRef = ref();
        const loading = ref();
        const myDetail = ref();
        const opRef = ref();
        const data = ref();
        const selects = ref<any>([]);
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        const searchName = ref();
        useSearchState(
            'container/volume/index',
            {
                search: searchName,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const isActive = ref(false);
        const isExist = ref(false);
        const dialogCreateRef = ref<DialogExpose>();
        const onCreate = async () => {
            dialogCreateRef.value!.acceptParams();
        };
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
                .searchVolumes(params)
                .then((res) => {
                    loading.value = false;
                    data.value = res.items || [];
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onInspect = async (id: string) => {
            const res = await rpc.container.inspect({ id: id, type: 'volume' });
            let detailInfo = JSON.stringify(JSON.parse(res.content), null, 2);
            let param = {
                header: i18n.global.t('commons.button.view'),
                detailInfo: detailInfo,
                mode: 'json',
            };
            myDetail.value!.acceptParams(param);
        };
        const onClean = () => {
            ElMessageBox.confirm(i18n.global.t('container.volumePruneHelper'), i18n.global.t('container.volumePrune'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                loading.value = true;
                let params = {
                    taskID: newUUID(),
                    pruneType: 'volume',
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
        const jumpTo = async (path: any) => {
            await rpc.file.checkFile({ path, withInit: false }).then((res) => {
                if (res.exists) {
                    routerToFileWithPath(path);
                } else {
                    MsgError(i18n.global.t('file.noSuchFile'));
                }
            });
        };
        const batchDelete = async (row: Container.VolumeInfo | null) => {
            let names = [];
            if (row) {
                names.push(row.name);
            } else {
                selects.value.forEach((item: Container.VolumeInfo) => {
                    names.push(item.name);
                });
            }
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('container.volume'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { names: string[] }) => rpc.container.deleteVolumes(params),
                params: { names: names },
            });
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: (row: Container.VolumeInfo) => {
                    batchDelete(row);
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
                            title={$t('container.volume', 2)}
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
                                                {$t('container.volumePrune')}
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
                                            title="volume-refresh"
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
                                            row-key="name"
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
                                            <ElTableColumn type="selection" fix />
                                            <ElTableColumn
                                                label={$t('commons.table.name')}
                                                min-width="100"
                                                width={unref(isMobile) ? 220 : 'auto'}
                                                prop="name"
                                                fix
                                                show-overflow-tooltip
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <ElText
                                                                type="primary"
                                                                onClick={($event?: any) => {
                                                                    onInspect(row.name);
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
                                                label="Options"
                                                min-width="160"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {(row.options || []).map((item, index) => (
                                                                <div key={index}>
                                                                    {row.expand ||
                                                                    (!row.expand && Number(index) < 3) ? (
                                                                        <div>
                                                                            {item.key === 'device' ? (
                                                                                <ElButton
                                                                                    onClick={($event?: any) => {
                                                                                        jumpTo(item.value);
                                                                                    }}
                                                                                    icon="Position"
                                                                                    plain
                                                                                    size="small"
                                                                                    class={'mt-0.5'}
                                                                                >
                                                                                    {item.key + ': ' + item.value}
                                                                                </ElButton>
                                                                            ) : (
                                                                                <ElButton
                                                                                    plain
                                                                                    size="small"
                                                                                    class={'mt-0.5'}
                                                                                >
                                                                                    {item.key + ': ' + item.value}
                                                                                </ElButton>
                                                                            )}
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            ))}
                                                            {!row.expand && row.options?.length > 3 ? (
                                                                <div>
                                                                    <ElButton
                                                                        type="primary"
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
                                                            {row.expand && row.options?.length > 3 ? (
                                                                <div>
                                                                    <ElButton
                                                                        type="primary"
                                                                        link
                                                                        onClick={($event?: any) => {
                                                                            row.expand = false;
                                                                        }}
                                                                    >
                                                                        {$t('commons.button.collapse')}
                                                                    </ElButton>
                                                                </div>
                                                            ) : null}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('container.mountpoint')}
                                                show-overflow-tooltip
                                                min-width="120"
                                                prop="mountpoint"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <ElTooltip
                                                                content={row.mountpoint}
                                                                {...TABLE_TOOLTIP_OPTIONS}
                                                            >
                                                                {withDirectives(
                                                                    <ElButton
                                                                        type="primary"
                                                                        icon="FolderOpened"
                                                                        link
                                                                        onClick={($event?: any) => {
                                                                            routerToFileWithPath(row.mountpoint);
                                                                        }}
                                                                    />,
                                                                    [[permissionDirective, 'host_file_view']],
                                                                )}
                                                            </ElTooltip>
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('container.driver')}
                                                show-overflow-tooltip
                                                min-width="80"
                                                prop="driver"
                                            />
                                            <ElTableColumn
                                                prop="createdAt"
                                                min-width="90"
                                                label={$t('commons.table.date')}
                                                formatter={dateFormat}
                                            />
                                            <FuTableOperations
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
                    <CodemirrorDrawer ref={myDetail} />
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
    name: 'Volume',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.volume',
        hidden: true,
    },
});
