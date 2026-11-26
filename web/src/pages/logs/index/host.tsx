import { $t } from '@/utils/i18n-t';
import { panelCacheKey, writePanelCache, readCachedPageSize } from '@/utils/panel-cache';
import { useSearchState } from '@/utils/search-reset';
import { Log } from '@/types/log';
import { useGlobalStore } from '@/composables/useGlobalStore';
import i18n from '@/lang';
import { shortcuts } from '@/utils/shortcuts';
import { rpc } from '@/lib/rpc';
import '@/pages/logs/_components/host-system/index.styles.css';
import LayoutContent from '@/components/layout-content/index';
import TableRefresh from '@/components/table/TableRefresh';
import ComplexTable from '@/components/table/complex/ComplexTable';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'host',
    props: {},
    emits: emits,
    __scopeId: 'data-v-17709ec9',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const logs = ref<Log.SystemLogItem[]>([]);
        const loading = ref(false);
        const watching = ref(false);
        const keyword = ref('');
        useSearchState('log/host-system/index', { keyword }, { onRevisit: () => scheduleFilterSearch() });
        const priority = ref('');
        const service = ref('');
        const services = ref<string[]>([]);
        const systemLogStatus = ref<Log.SystemLogStatus>();
        const systemLogStatusLoading = ref(true);
        const detailOpen = ref(false);
        const selectedLog = ref<Log.SystemLogItem>();
        const timeRange = ref<[Date, Date]>([new Date(new Date().setHours(0, 0, 0, 0)), new Date()]);
        const paginationConfig = reactive({
            pageSize: 100,
            cacheSizeKey: 'host-system-logs-page-size',
        });
        const pageSizes = [5, 10, 20, 50, 100, 200, 500];
        const cursorHistory = ref<string[]>(['']);
        const cursorIndex = ref(0);
        const hasMore = ref(false);
        let timer: ReturnType<typeof setTimeout> | undefined;
        let filterTimer: ReturnType<typeof setTimeout> | undefined;
        let requestID = 0;
        const priorities = [
            { value: '0', labelKey: 'logs.priorityEmergency' },
            { value: '1', labelKey: 'logs.priorityAlert' },
            { value: '2', labelKey: 'logs.priorityCritical' },
            { value: '3', labelKey: 'logs.priorityError' },
            { value: '4', labelKey: 'logs.priorityWarning' },
            { value: '5', labelKey: 'logs.priorityNotice' },
            { value: '6', labelKey: 'logs.priorityInfo' },
            { value: '7', labelKey: 'logs.priorityDebug' },
        ];
        const loadLogs = async (cursor = cursorHistory.value[cursorIndex.value]) => {
            const currentRequestID = ++requestID;
            loading.value = true;
            try {
                const res = await rpc.log.readSystemLogs({
                    pageSize: paginationConfig.pageSize,
                    cursor,
                    startTime: timeRange.value?.[0] ? new Date(timeRange.value[0]).toISOString() : '',
                    endTime: timeRange.value?.[1] ? new Date(timeRange.value[1]).toISOString() : '',
                    keyword: keyword.value,
                    priority: priority.value,
                    service: service.value,
                });
                if (currentRequestID !== requestID) return;
                logs.value = res.items || [];
                hasMore.value = res.hasMore;
                if (res.nextCursor) {
                    cursorHistory.value[cursorIndex.value + 1] = res.nextCursor;
                }
            } finally {
                if (currentRequestID === requestID) loading.value = false;
            }
        };
        const resetAndLoadLogs = () => {
            requestID++;
            cursorHistory.value = [''];
            cursorIndex.value = 0;
            hasMore.value = false;
            return loadLogs('');
        };
        const loadNextPage = () => {
            if (!hasMore.value) return;
            cursorIndex.value++;
            loadLogs();
        };
        const loadPreviousPage = () => {
            if (cursorIndex.value === 0) return;
            cursorIndex.value--;
            loadLogs();
        };
        const changePageSize = () => {
            writePanelCache(
                'pagination',
                panelCacheKey(`size:${paginationConfig.cacheSizeKey}`),
                paginationConfig.pageSize,
            );
            resetAndLoadLogs();
        };
        const loadServices = async () => {
            try {
                const res = await rpc.log.listRunningServices({});
                services.value = res.services || [];
            } catch {
                services.value = [];
            }
        };
        const loadSystemLogStatus = async () => {
            try {
                const res = await rpc.log.systemStatus({});
                systemLogStatus.value = {
                    source: res.source as 'file' | 'journalctl',
                    version: res.version,
                    keywordFilterSupported: res.keywordFilterSupported,
                    message: res.message,
                };
            } catch {
                systemLogStatus.value = undefined;
            } finally {
                systemLogStatusLoading.value = false;
            }
        };
        const scheduleWatch = () => {
            timer = setTimeout(async () => {
                if (!watching.value) return;
                try {
                    if (!loading.value) {
                        await resetAndLoadLogs();
                    }
                } finally {
                    if (watching.value) {
                        scheduleWatch();
                    }
                }
            }, 3000);
        };
        const changeWatch = () => {
            if (timer) {
                clearTimeout(timer);
                timer = undefined;
            }
            if (watching.value) {
                scheduleWatch();
            }
        };
        const changeTimeRange = () => {
            resetAndLoadLogs();
        };
        const openDetail = (row: Log.SystemLogItem) => {
            selectedLog.value = row;
            detailOpen.value = true;
        };
        const priorityLabel = (value: string) => {
            const priority = priorities.find((item) => item.value === value);
            return priority ? i18n.global.t(priority.labelKey) : value || '-';
        };
        const priorityType = (value: string) => {
            if (['0', '1', '2', '3'].includes(value)) return 'danger';
            if (value === '4') return 'warning';
            return 'info';
        };
        onMounted(async () => {
            const cachedPageSize = readCachedPageSize(paginationConfig.cacheSizeKey);
            if (pageSizes.includes(cachedPageSize)) {
                paginationConfig.pageSize = cachedPageSize;
            }
            await Promise.allSettled([loadSystemLogStatus(), resetAndLoadLogs(), loadServices()]);
        });
        onUnmounted(() => {
            if (timer) clearTimeout(timer);
            if (filterTimer) clearTimeout(filterTimer);
        });
        const scheduleFilterSearch = () => {
            requestID++;
            if (filterTimer) clearTimeout(filterTimer);
            filterTimer = setTimeout(resetAndLoadLogs, 300);
        };
        watch([keyword, priority, service], scheduleFilterSearch);
        return () => (
            <>
                {unref(systemLogStatus) ? (
                    <div class={'app-status card-interval'}>
                        <ElCard>
                            <div class={'flex w-full flex-col gap-4 md:flex-row'}>
                                <div class={'ml-3 flex flex-wrap gap-4'}>
                                    <ElTag effect="dark" type="success">
                                        {unref(systemLogStatus).source}
                                    </ElTag>
                                    {unref(systemLogStatus).version ? (
                                        <ElTag>
                                            {$t('app.version')}
                                            {': '}
                                            {unref(systemLogStatus).version}
                                        </ElTag>
                                    ) : null}
                                </div>
                            </div>
                        </ElCard>
                    </div>
                ) : null}
                {withDirectives(
                    <LayoutContent
                        title={$t('logs.hostSystem')}
                        v-slots={{
                            prompt: () => (
                                <>
                                    {unref(systemLogStatus) && !unref(systemLogStatus).keywordFilterSupported ? (
                                        <ElAlert type="info" title={unref(systemLogStatus).message} closable={false} />
                                    ) : null}
                                </>
                            ),
                            rightToolBar: () => (
                                <>
                                    <ElInput
                                        modelValue={unref(keyword)}
                                        onUpdate:modelValue={($v) => {
                                            keyword.value = $v as any;
                                        }}
                                        clearable
                                        disabled={
                                            unref(systemLogStatusLoading) ||
                                            !unref(systemLogStatus)?.keywordFilterSupported
                                        }
                                        placeholder={$t('logs.filter')}
                                        class={'p-w-200'}
                                    />
                                    <ElDatePicker
                                        modelValue={unref(timeRange)}
                                        onUpdate:modelValue={($v) => {
                                            timeRange.value = $v as any;
                                        }}
                                        type="datetimerange"
                                        range-separator="-"
                                        start-placeholder={$t('commons.search.timeStart')}
                                        end-placeholder={$t('commons.search.timeEnd')}
                                        shortcuts={shortcuts}
                                        onChange={($event?: any) => {
                                            (changeTimeRange as any)($event);
                                        }}
                                        class={'host-log-time-range'}
                                    />
                                    <ElSelect
                                        modelValue={unref(priority)}
                                        onUpdate:modelValue={($v) => {
                                            priority.value = $v as any;
                                        }}
                                        clearable
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('logs.priority')}</> }}
                                    >
                                        {(priorities || []).map((item) => (
                                            <ElOption
                                                label={priorityLabel(item.value)}
                                                value={item.value}
                                                key={item.value}
                                            />
                                        ))}
                                    </ElSelect>
                                    <ElSelect
                                        modelValue={unref(service)}
                                        onUpdate:modelValue={($v) => {
                                            service.value = $v as any;
                                        }}
                                        clearable
                                        filterable
                                        allow-create
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('logs.service')}</> }}
                                    >
                                        {(unref(services) || []).map((item) => (
                                            <ElOption label={item} value={item} key={item} />
                                        ))}
                                    </ElSelect>
                                    <ElCheckbox
                                        border
                                        modelValue={unref(watching)}
                                        onUpdate:modelValue={($v) => {
                                            watching.value = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            (changeWatch as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.watch')}
                                    </ElCheckbox>
                                    <TableRefresh
                                        onSearch={($event?: any) => {
                                            (resetAndLoadLogs as any)($event);
                                        }}
                                    />
                                </>
                            ),
                            main: () => (
                                <>
                                    <ComplexTable
                                        data={unref(logs)}
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        onRowClick={($event?: any) => {
                                            (openDetail as any)($event);
                                        }}
                                        heightDiff={320}
                                        v-slots={{
                                            pagination: () => (
                                                <>
                                                    <div class={'flex items-center gap-2'}>
                                                        <ElSelect
                                                            modelValue={paginationConfig.pageSize}
                                                            onUpdate:modelValue={($v) => {
                                                                paginationConfig.pageSize = $v as any;
                                                            }}
                                                            onChange={($event?: any) => {
                                                                (changePageSize as any)($event);
                                                            }}
                                                            class={'p-w-100'}
                                                        >
                                                            {(pageSizes || []).map((size) => (
                                                                <ElOption
                                                                    label={String(size)}
                                                                    value={size}
                                                                    key={size}
                                                                />
                                                            ))}
                                                        </ElSelect>
                                                        <ElButton
                                                            disabled={unref(cursorIndex) === 0 || unref(loading)}
                                                            onClick={($event?: any) => {
                                                                (loadPreviousPage as any)($event);
                                                            }}
                                                        >
                                                            {$t('logs.previousPage')}
                                                        </ElButton>
                                                        <ElButton
                                                            disabled={!unref(hasMore) || unref(loading)}
                                                            onClick={($event?: any) => {
                                                                (loadNextPage as any)($event);
                                                            }}
                                                        >
                                                            {$t('logs.nextPage')}
                                                        </ElButton>
                                                    </div>
                                                </>
                                            ),
                                        }}
                                    >
                                        <ElTableColumn
                                            prop="time"
                                            label={$t('commons.table.date')}
                                            width="220"
                                            show-overflow-tooltip
                                        />
                                        <ElTableColumn
                                            label={$t('logs.priority')}
                                            width="120"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElTag size="small" type={priorityType(row.priority)}>
                                                            {priorityLabel(row.priority)}
                                                        </ElTag>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            prop="service"
                                            label={$t('logs.service')}
                                            width="220"
                                            show-overflow-tooltip
                                            v-slots={{ default: ({ row }) => <>{row.service || '-'}</> }}
                                        />
                                        <ElTableColumn
                                            prop="message"
                                            label={$t('logs.message')}
                                            min-width="360"
                                            show-overflow-tooltip
                                        />
                                    </ComplexTable>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
                <ElDrawer
                    modelValue={unref(detailOpen)}
                    onUpdate:modelValue={($v) => {
                        detailOpen.value = $v as any;
                    }}
                    title={$t('logs.hostSystem')}
                    size="50%"
                >
                    {unref(selectedLog) ? (
                        <ElDescriptions column={1} border>
                            <ElDescriptionsItem label={$t('commons.table.date')}>
                                {unref(selectedLog).time || '-'}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('logs.priority')}>
                                {priorityLabel(unref(selectedLog).priority)}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('logs.service')}>
                                {unref(selectedLog).service || '-'}
                            </ElDescriptionsItem>
                            <ElDescriptionsItem label={$t('logs.message')}>
                                {unref(selectedLog).message}
                            </ElDescriptionsItem>
                        </ElDescriptions>
                    ) : null}
                    {unref(selectedLog) ? <pre class={'log-raw'}>{unref(selectedLog).raw}</pre> : null}
                </ElDrawer>
            </>
        );
    },
    options,
);

definePage({
    name: 'HostSystemLog',
    meta: { parent: 'menu.logs', title: 'logs.hostSystem', activeMenu: '/logs', permission: 'log_view', hidden: true },
});
