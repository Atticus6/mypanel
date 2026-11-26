import { $t } from '@/utils/i18n-t';
import FireRouter from '@/pages/hosts/_components/process/index';
import ProcessDetail from '@/pages/hosts/_components/process/process/detail/index';
import i18n from '@/lang';
import { ProcessStore } from '@/store';
import { TableV2SortOrder } from 'element-plus';
import { useGlobalStore } from '@/composables/useGlobalStore';
import RuntimeDiagnostics from '@/pages/hosts/_components/process/process/diagnostics/index';
import { useMediaQuery } from '@/composables/useMediaQuery';
import { rpc } from '@/lib/rpc';
import '@/pages/hosts/_components/process/process/index.styles.css';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'process.process',
    props: {},
    emits: emits,
    __scopeId: 'data-v-2bdab146',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const isCompactTable = useMediaQuery('(max-width: 1024px)');
        const processStore = ProcessStore();
        processStore.restoreSearchState();
        onActivated(() => processStore.restoreSearchState());
        const permissionDirective = resolveDirective('permission');
        const statusOptions = computed(() => [
            { text: i18n.global.t('process.running'), value: 'running' },
            { text: i18n.global.t('process.sleep'), value: 'sleep' },
            { text: i18n.global.t('process.stop'), value: 'stop' },
            { text: i18n.global.t('process.idle'), value: 'idle' },
            { text: i18n.global.t('process.wait'), value: 'wait' },
            { text: i18n.global.t('process.lock'), value: 'lock' },
            { text: i18n.global.t('process.zombie'), value: 'zombie' },
        ]);
        const opRef = ref();
        const sortState = ref<SortBy>({
            key: 'PID',
            order: TableV2SortOrder.ASC,
        });
        const data = ref<any[]>([]);
        const detailRef = ref();
        const runtimeDiagnosticsRef = ref<InstanceType<typeof RuntimeDiagnostics>>();
        const filters = ref<string[]>([]);
        const sortByNum = (a: any, b: any, prop: string): number => {
            const aVal = parseFloat(a[prop]) || 0;
            const bVal = parseFloat(b[prop]) || 0;
            return aVal - bVal;
        };
        const columns = ref([
            {
                key: 'PID',
                title: 'PID',
                dataKey: 'PID',
                width: 120,
                sortable: true,
                sortMethod: sortByNum,
            },
            {
                key: 'name',
                title: i18n.global.t('commons.table.name'),
                dataKey: 'name',
                width: 400,
            },
            {
                key: 'ppid',
                title: i18n.global.t('process.ppid'),
                dataKey: 'PPID',
                width: 120,
            },
            {
                key: 'numThreads',
                title: i18n.global.t('process.numThreads'),
                dataKey: 'numThreads',
                width: 120,
            },
            {
                key: 'username',
                title: i18n.global.t('commons.table.user'),
                dataKey: 'username',
                width: 200,
            },
            {
                key: 'cpuValue',
                title: 'CPU',
                dataKey: 'cpuValue',
                width: 200,
                sortable: true,
                sortMethod: sortByNum,
                cellRenderer: ({ rowData }) => {
                    return rowData.cpuPercent;
                },
            },
            {
                key: 'rssValue',
                title: i18n.global.t('process.memory'),
                dataKey: 'rssValue',
                width: 200,
                sortable: true,
                sortMethod: sortByNum,
                cellRenderer: ({ rowData }) => {
                    return rowData.rss;
                },
            },
            {
                key: 'numConnections',
                title: i18n.global.t('process.numConnections'),
                dataKey: 'numConnections',
                width: 100,
                sortable: true,
            },
            {
                key: 'status',
                title: i18n.global.t('commons.table.status'),
                dataKey: 'status',
                width: 100,
                cellRenderer: ({ rowData }) => {
                    if (rowData.status) {
                        return i18n.global.t('process.' + rowData.status);
                    }
                    return '';
                },
            },
            {
                key: 'startTime',
                title: i18n.global.t('process.startTime'),
                dataKey: 'startTime',
                width: 300,
            },
            {
                key: 'actions',
                title: i18n.global.t('commons.table.operate'),
                dataKey: 'actions',
                width: 420,
                cellRenderer: ({ rowData }) => {
                    const stopButton = h(
                        ElButton,
                        {
                            type: 'text',
                            onClick: () => stop(rowData),
                        },
                        () => i18n.global.t('process.stopProcess'),
                    );

                    const buttons = [
                        h(
                            ElButton,
                            {
                                type: 'text',
                                onClick: () => openDetail(rowData),
                            },
                            () => i18n.global.t('process.viewDetails'),
                        ),
                    ];

                    if (
                        rowData.name === '1panel-agent' ||
                        (rowData.name === '1panel-core' && (!currentNode.value || currentNode.value === 'local'))
                    ) {
                        buttons.push(
                            h(
                                ElButton,
                                {
                                    type: 'text',
                                    onClick: () => openRuntimeDiagnostics(rowData.name),
                                },
                                () => i18n.global.t('monitor.runtimeDiagnostics'),
                            ),
                        );
                    }

                    buttons.push(
                        permissionDirective ? withDirectives(stopButton, [[permissionDirective]]) : stopButton,
                    );
                    return h('div', { class: 'action-buttons' }, buttons);
                },
            },
        ]);
        watch(
            [sortState, () => processStore.psData, filters],
            ([newState, newData, newFilters]) => {
                if (!newData?.length) {
                    data.value = [];
                    return;
                }

                let filtered = newData;
                if (newFilters.length > 0) {
                    filtered = filtered.filter((re: any) => newFilters.includes(re.status));
                }

                const { key, order } = newState ?? {};
                if (!key || !order) {
                    data.value = filtered;
                    return;
                }

                const currCol = columns.value.find((c) => c.key === key);
                if (!currCol) {
                    data.value = filtered;
                    return;
                }

                const currSortMethod = currCol.sortMethod ?? sortByNum;
                data.value = filtered.slice(0).sort((a, b) => {
                    const res = (currSortMethod as any)(a, b, currCol.dataKey);
                    return order === TableV2SortOrder.ASC ? res : 0 - res;
                });
            },
            { immediate: true },
        );
        const openDetail = (row: any) => {
            detailRef.value.acceptParams(row.PID);
        };
        const openRuntimeDiagnostics = (name: string) => {
            runtimeDiagnosticsRef.value?.acceptParams(name === '1panel-core' ? 'core' : 'agent');
        };
        const changeSort = ({ key, order }) => {
            if (!order) order = TableV2SortOrder.ASC;
            sortState.value = { key, order };
        };
        const search = () => {
            processStore.sendPsMessage();
        };
        const stop = async (row: any) => {
            opRef.value.acceptParams({
                title: i18n.global.t('process.stopProcess'),
                names: [row.name],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('menu.process'),
                    i18n.global.t('process.stopProcess'),
                ]),
                api: (params: { pid: number }) => rpc.process.stopProcess(params),
                params: { pid: row.PID },
                successMsg: i18n.global.t('commons.msg.operationSuccess'),
            });
        };
        onMounted(() => {
            processStore.connect(currentNode.value);
            const initialDelay = processStore.psData.length > 0 ? 500 : 0;
            processStore.startPolling('ps', 3000, initialDelay);
        });
        onUnmounted(() => {
            processStore.stopPolling();
            processStore.disconnect();
        });
        return () => (
            <div>
                <FireRouter />
                {withDirectives(
                    <LayoutContent
                        title={$t('menu.process', 2)}
                        v-slots={{
                            rightToolBar: () => (
                                <>
                                    <div class={'process-toolbar flex w-full items-center justify-end gap-5'}>
                                        <ElSelect
                                            modelValue={unref(filters)}
                                            onUpdate:modelValue={($v) => {
                                                filters.value = $v as any;
                                            }}
                                            placeholder={$t('commons.table.status')}
                                            clearable
                                            onChange={($event?: any) => {
                                                search();
                                            }}
                                            multiple
                                            collapse-tags
                                            collapse-tags-tooltip
                                            max-collapse-tags={4}
                                            class={'process-toolbar__filter'}
                                        >
                                            {(unref(statusOptions) || []).map((item) => (
                                                <ElOption label={item.text} value={item.value} key={item.value} />
                                            ))}
                                        </ElSelect>
                                        <TableSearch
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                            placeholder={$t('process.pid')}
                                            searchName={processStore.psSearch.pid}
                                            onUpdate:searchName={($v) => {
                                                processStore.psSearch.pid = $v as any;
                                            }}
                                            class={'process-toolbar__field'}
                                        />
                                        <TableSearch
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                            placeholder={$t('commons.table.name')}
                                            searchName={processStore.psSearch.name}
                                            onUpdate:searchName={($v) => {
                                                processStore.psSearch.name = $v as any;
                                            }}
                                            class={'process-toolbar__field'}
                                        />
                                        <TableSearch
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                            placeholder={$t('commons.table.user')}
                                            searchName={processStore.psSearch.username}
                                            onUpdate:searchName={($v) => {
                                                processStore.psSearch.username = $v as any;
                                            }}
                                            class={'process-toolbar__field'}
                                        />
                                    </div>
                                </>
                            ),
                            main: () => (
                                <>
                                    <div class={'process-table'}>
                                        <ElAutoResizer
                                            v-slots={{
                                                default: ({ height, width }) => (
                                                    <>
                                                        <ElTableV2
                                                            fixed={unref(isCompactTable)}
                                                            onColumnSort={($event?: any) => {
                                                                (changeSort as any)($event);
                                                            }}
                                                            columns={unref(columns)}
                                                            data={unref(data)}
                                                            width={width}
                                                            height={height}
                                                            scrollbar-always-on={unref(isCompactTable)}
                                                            sort-by={unref(sortState)}
                                                        />
                                                    </>
                                                ),
                                            }}
                                        />
                                    </div>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, processStore.psLoading]],
                )}
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <ProcessDetail ref={detailRef} />
                <RuntimeDiagnostics ref={runtimeDiagnosticsRef} />
            </div>
        );
    },
    options,
);

definePage({
    name: 'Process',
    meta: {
        icon: 'p-process-menu',
        title: 'menu.processManage',
        detail: 'menu.process',
        activeMenu: '/hosts/process/process',
        permission: 'host_process_view',
    },
});
