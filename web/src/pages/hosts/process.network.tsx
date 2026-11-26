import { $t } from '@/utils/i18n-t';
import FireRouter from '@/pages/hosts/_components/process/index';
import { ProcessStore } from '@/store';
import { TableV2SortOrder } from 'element-plus';
import { Filter } from '@element-plus/icons-vue';
import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { useMediaQuery } from '@/composables/useMediaQuery';
import '@/pages/hosts/_components/process/network/index.styles.css';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'process.network',
    props: {},
    emits: emits,
    __scopeId: 'data-v-972ea607',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const statusOptions = [
            { text: 'LISTEN', value: 'LISTEN' },
            { text: 'ESTABLISHED', value: 'ESTABLISHED' },
            { text: 'TIME_WAIT', value: 'TIME_WAIT' },
            { text: 'CLOSE_WAIT', value: 'CLOSE_WAIT' },
            { text: 'NONE', value: 'NONE' },
        ];
        const { currentNode } = useGlobalStore();
        const isCompactTable = useMediaQuery('(max-width: 1024px)');
        const processStore = ProcessStore();
        processStore.restoreSearchState();
        onActivated(() => processStore.restoreSearchState());
        const quickSearchName = (name: string) => {
            processStore.netSearch.processID = undefined;
            processStore.netSearch.processName = name;
            processStore.netSearch.port = undefined;
            search();
        };
        const quickSearchPort = (port: number) => {
            processStore.netSearch.processID = undefined;
            processStore.netSearch.processName = '';
            processStore.netSearch.port = port;
            search();
        };
        const data = ref<any[]>([]);
        const sortState = ref<SortBy>({
            key: 'PID',
            order: TableV2SortOrder.ASC,
        });
        const filters = ref<string[]>(['LISTEN', 'ESTABLISHED']);
        const sortByNum = (a: any, b: any, prop: string): number => {
            const aVal = parseFloat(a[prop]) || 0;
            const bVal = parseFloat(b[prop]) || 0;
            return aVal - bVal;
        };
        const columns = ref([
            {
                key: 'type',
                title: i18n.global.t('commons.table.type'),
                dataKey: 'type',
                width: 220,
            },
            {
                key: 'PID',
                title: 'PID',
                dataKey: 'PID',
                width: 220,
                sortable: true,
                sortMethod: sortByNum,
            },
            {
                key: 'name',
                title: i18n.global.t('process.processName'),
                dataKey: 'name',
                width: 300,
                cellRenderer: ({ rowData }) => {
                    return h('div', { class: 'flex items-center gap-1' }, [
                        h('span', { class: 'truncate', title: rowData.name }, rowData.name),
                        h(
                            ElIcon,
                            {
                                class: 'cursor-pointer hover:text-primary ml-1 flex-shrink-0',
                                size: 14,
                                onClick: (e: Event) => {
                                    e.stopPropagation();
                                    quickSearchName(rowData.name);
                                },
                            },
                            () => h(Filter),
                        ),
                    ]);
                },
            },
            {
                key: 'localaddr',
                title: i18n.global.t('process.laddr'),
                dataKey: 'localaddr',
                width: 350,
                cellRenderer: ({ rowData }) => {
                    const addr = rowData.localaddr;
                    const addrStr = addr?.ip ? `${addr.ip}${addr.port > 0 ? ':' + addr.port : ''}` : '';
                    const hasPort = addr?.port > 0;
                    return h('div', { class: 'flex items-center gap-1 min-w-0' }, [
                        h('span', { class: 'truncate', title: addrStr }, addrStr),
                        hasPort
                            ? h(
                                  ElIcon,
                                  {
                                      class: 'cursor-pointer hover:text-primary ml-1',
                                      size: 12,
                                      onClick: (e: Event) => {
                                          e.stopPropagation();
                                          quickSearchPort(addr.port);
                                      },
                                  },
                                  () => h(Filter),
                              )
                            : null,
                    ]);
                },
            },
            {
                key: 'remoteaddr',
                title: i18n.global.t('process.raddr'),
                dataKey: 'remoteaddr',
                width: 350,
                cellRenderer: ({ rowData }) => {
                    const addr = rowData.remoteaddr;
                    const addrStr = addr?.ip ? `${addr.ip}${addr.port > 0 ? ':' + addr.port : ''}` : '';
                    return h('span', { class: 'truncate', title: addrStr }, addrStr);
                },
            },
            {
                key: 'status',
                title: i18n.global.t('commons.table.status'),
                dataKey: 'status',
                width: 380,
                cellRenderer: ({ rowData }) => rowData.status,
            },
        ]);
        watch(
            [sortState, () => processStore.netData, filters],
            ([newState, newData, newFilters]) => {
                if (!newData?.length) {
                    data.value = [];
                    return;
                }

                let filtered = newData;
                if (newFilters.length > 0) {
                    filtered = filtered.filter((row) => newFilters.includes(row.status));
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

                const sortMethod = currCol.sortMethod ?? sortByNum;
                data.value = filtered.slice().sort((a, b) => {
                    const res = (sortMethod as any)(a, b, currCol.dataKey);
                    return order === TableV2SortOrder.ASC ? res : -res;
                });
            },
            { immediate: true },
        );
        const changeSort = ({ key, order }) => {
            if (!order) order = TableV2SortOrder.ASC;
            sortState.value = { key, order };
        };
        const search = () => {
            processStore.sendNetMessage();
        };
        onMounted(() => {
            processStore.connect(currentNode.value);
            const initialDelay = processStore.netData.length > 0 ? 500 : 0;
            processStore.startPolling('net', 3000, initialDelay);
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
                        title={$t('menu.network', 2)}
                        v-slots={{
                            rightToolBar: () => (
                                <>
                                    <div class={'network-toolbar flex w-full items-center justify-end gap-5'}>
                                        <ElSelect
                                            modelValue={unref(filters)}
                                            onUpdate:modelValue={($v) => {
                                                filters.value = $v as any;
                                            }}
                                            placeholder={$t('commons.table.status')}
                                            clearable
                                            multiple
                                            collapse-tags
                                            collapse-tags-tooltip
                                            max-collapse-tags={2}
                                            onChange={($event?: any) => {
                                                search();
                                            }}
                                            class={'network-toolbar__filter'}
                                        >
                                            {(statusOptions || []).map((item) => (
                                                <ElOption label={item.text} value={item.value} key={item.value} />
                                            ))}
                                        </ElSelect>
                                        <TableSearch
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                            placeholder={$t('process.pid')}
                                            searchName={processStore.netSearch.processID}
                                            onUpdate:searchName={($v) => {
                                                processStore.netSearch.processID = $v as any;
                                            }}
                                            class={'network-toolbar__field'}
                                        />
                                        <TableSearch
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                            placeholder={$t('process.processName')}
                                            searchName={processStore.netSearch.processName}
                                            onUpdate:searchName={($v) => {
                                                processStore.netSearch.processName = $v as any;
                                            }}
                                            class={'network-toolbar__field'}
                                        />
                                        <TableSearch
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                            placeholder={$t('commons.table.port')}
                                            searchName={processStore.netSearch.port}
                                            onUpdate:searchName={($v) => {
                                                processStore.netSearch.port = $v as any;
                                            }}
                                            class={'network-toolbar__field'}
                                        />
                                    </div>
                                </>
                            ),
                            main: () => (
                                <>
                                    <div class={'network-table'}>
                                        <ElAutoResizer
                                            v-slots={{
                                                default: ({ height, width }) => (
                                                    <>
                                                        <ElTableV2
                                                            fixed={unref(isCompactTable)}
                                                            columns={unref(columns)}
                                                            data={unref(data)}
                                                            width={width}
                                                            height={height}
                                                            scrollbar-always-on={unref(isCompactTable)}
                                                            sort-by={unref(sortState)}
                                                            onColumnSort={($event?: any) => {
                                                                (changeSort as any)($event);
                                                            }}
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
                    [[vLoading, processStore.netLoading]],
                )}
            </div>
        );
    },
    options,
);

definePage({
    name: 'ProcessNetwork',
    meta: {
        parent: 'menu.processManage',
        title: 'menu.network',
        activeMenu: '/hosts/process/process',
        permission: 'host_process_view',
        hidden: true,
    },
});
