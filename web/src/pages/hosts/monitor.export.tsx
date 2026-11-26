import { $t } from '@/utils/i18n-t';
interface GPUProcess {
    pid: string;
    type: string;
    processName: string;
    usedMemory: string;
}
interface ChartHide {
    sharedMemory?: boolean;
    deviceID?: string;
    legacy?: boolean;
    productName: string;
    type?: 'gpu' | 'npu' | 'xpu';
    process: boolean;
    gpu: boolean;
    memory: boolean;
    power: boolean;
    powerLimit: boolean;
    temperature: boolean;
    speed: boolean;
}
interface MonitorGPUData {
    memoryActivity: Array<number | null>;
    encoderUtil: Array<number | null>;
    decoderUtil: Array<number | null>;
    jpegUtil: Array<number | null>;
    ofaUtil: Array<number | null>;
    mediaUtil: Array<number | null>;
    computeUtil: Array<number | null>;
    copyUtil: Array<number | null>;
    hotspotTemperature: Array<number | null>;
    fanRPM: Array<number | null>;
    aiCPUUtil: Array<number | null>;
    ctrlCPUUtil: Array<number | null>;
    ddrUsed: Array<number | null>;
    ddrTotal: Array<number | null>;
    hbmUsed: Array<number | null>;
    hbmTotal: Array<number | null>;
    ddrBandwidth: Array<number | null>;
    hbmBandwidth: Array<number | null>;
    memoryBandwidth: Array<number | null>;
    mediaFrequency: Array<number | null>;
    hugepagesUsed: Array<number | null>;
    hugepagesTotal: Array<number | null>;

    bucketSeconds: number;
    sampleCount: number;
    memoryTemperatureValue: Array<number | null>;
    frequencyValue: Array<number | null>;
    memoryFrequencyValue: Array<number | null>;
    date: Array<Date>;
    gpuValue: Array<number | null>;
    temperatureValue: Array<number | null>;
    powerTotal: Array<number | null>;
    powerUsed: Array<number | null>;
    powerPercent: Array<number | null>;
    memoryTotal: Array<number | null>;
    memoryUsed: Array<number | null>;
    memoryPercent: Array<number | null>;
    speedValue: Array<number | null>;
    processCount: Array<number | null>;
    gpuProcesses: Array<Array<GPUProcess>>;
}
interface MonitorData {
    param: string;
    date: Array<Date>;
    value: Array<any>;
}
import { toMonitorChartSeries } from '@/lib/rpc/monitor';
import { getGPUOptions, loadGPUMonitor } from '@/api/modules/ai';
import { rpc } from '@/lib/rpc';
import { shortcuts } from '@/utils/shortcuts';
import { dateFormatForName } from '@/utils/date';
import { exportMonitorTables, MonitorExportTable } from '@/utils/monitor-export';
import { useGlobalStore } from '@/composables/useGlobalStore';
import MonitorRouter from '@/pages/views/host/monitor/index';
import i18n from '@/lang';
import { MsgWarning } from '@/utils/message';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'monitor.export',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode, isMobile } = useGlobalStore();
        const loading = ref(false);
        const timeRange = ref<[Date, Date]>([new Date(new Date().setHours(0, 0, 0, 0)), new Date()]);
        const ioOptions = ref<Array<string>>([]);
        const netOptions = ref<Array<string>>([]);
        const gpuOptions = ref<(ChartHide & { value: string; label: string })[]>([]);
        const ioOptionsFailed = ref(false);
        const netOptionsFailed = ref(false);
        const gpuOptionsFailed = ref(false);
        const ALL_DEVICES = '*';
        const form = reactive({
            params: ['cpu', 'memory', 'load'] as Array<string>,
            io: ALL_DEVICES,
            network: ALL_DEVICES,
            gpuDevice: ALL_DEVICES,
            format: 'csv',
        });
        const formatHelper = computed(() => {
            switch (form.format) {
                case 'json':
                    return i18n.global.t('monitor.exportJsonHelper');
                case 'xlsx':
                    return i18n.global.t('monitor.exportXlsxHelper');
                default:
                    return i18n.global.t('monitor.exportCsvHelper');
            }
        });
        const t = (key: string, args?: any) => i18n.global.t(key, args);
        const tableLabel = (name: string): string => {
            switch (name) {
                case 'base':
                    return [
                        ['cpu', 'CPU'],
                        ['memory', t('monitor.memory')],
                        ['load', t('monitor.avgLoad')],
                    ]
                        .filter(([param]) => form.params.includes(param as string))
                        .map(([, label]) => label)
                        .join(' / ');
                case 'io':
                    return `${t('monitor.disk')} I/O`;
                case 'network':
                    return t('monitor.network');
                case 'gpu':
                    return 'GPU';
                default:
                    return name;
            }
        };
        const buildBaseTable = (datasets: Array<MonitorData>): MonitorExportTable => {
            const base = datasets.find((item) => item.param === 'base');
            const fields = ['time'];
            const headers = [t('commons.table.date')];
            const pickers: Array<(row: any) => any> = [(row) => new Date(row.createdAt)];
            if (form.params.includes('cpu')) {
                fields.push('cpu');
                headers.push('CPU (%)');
                pickers.push((row) => row.cpu);
            }
            if (form.params.includes('memory')) {
                fields.push('memory');
                headers.push(`${t('monitor.memory')} (%)`);
                pickers.push((row) => row.memory);
            }
            if (form.params.includes('load')) {
                fields.push('loadUsage', 'load1', 'load5', 'load15');
                headers.push(`${t('monitor.avgLoad')} (%)`, 'Load 1m', 'Load 5m', 'Load 15m');
                pickers.push(
                    (row) => row.loadUsage,
                    (row) => row.cpuLoad1,
                    (row) => row.cpuLoad5,
                    (row) => row.cpuLoad15,
                );
            }
            const rows = (base?.value || []).map((row) => pickers.map((pick) => pick(row)));
            return { name: 'base', fields, headers, rows };
        };
        const buildIOTable = (datasets: Array<MonitorData>): MonitorExportTable => {
            const rows = datasets
                .flatMap((item) => (item.param === 'io' ? item.value || [] : []))
                .filter((row) => form.io !== ALL_DEVICES || row.name !== 'all')
                .map((row) => [new Date(row.createdAt), row.name, row.read, row.write, row.count, row.time])
                .sort((a, b) => a[0].getTime() - b[0].getTime());
            return {
                name: 'io',
                fields: ['time', 'device', 'read', 'write', 'count', 'ioTime'],
                headers: [
                    t('commons.table.date'),
                    t('monitor.disk'),
                    `${t('monitor.read')} (B/s)`,
                    `${t('monitor.write')} (B/s)`,
                    t('monitor.readWriteCount'),
                    `${t('monitor.readWriteTime')} (ms)`,
                ],
                rows,
            };
        };
        const buildNetworkTable = (datasets: Array<MonitorData>): MonitorExportTable => {
            const rows = datasets
                .flatMap((item) => (item.param === 'network' ? item.value || [] : []))
                .filter((row) => form.network !== ALL_DEVICES || row.name !== 'all')
                .map((row) => [new Date(row.createdAt), row.name, row.up, row.down])
                .sort((a, b) => a[0].getTime() - b[0].getTime());
            return {
                name: 'network',
                fields: ['time', 'interface', 'up', 'down'],
                headers: [
                    t('commons.table.date'),
                    t('monitor.networkCard'),
                    `${t('monitor.up')} (KB/s)`,
                    `${t('monitor.down')} (KB/s)`,
                ],
                rows,
            };
        };
        const buildGPUTable = (datasets: Array<{ device: ChartHide; data: MonitorGPUData }>): MonitorExportTable => {
            const rows = datasets
                .flatMap(({ device, data }) =>
                    (data.date || []).map((date, i) => [
                        new Date(date),
                        device.productName,
                        device.deviceID || '',
                        !!device.legacy,
                        data.gpuValue?.[i],
                        data.temperatureValue?.[i],
                        data.powerUsed?.[i],
                        data.powerTotal?.[i],
                        data.memoryUsed?.[i],
                        data.memoryTotal?.[i],
                        data.speedValue?.[i],
                    ]),
                )
                .sort((a, b) => (a[0] as Date).getTime() - (b[0] as Date).getTime());
            return {
                name: 'gpu',
                fields: [
                    'time',
                    'productName',
                    'deviceID',
                    'legacy',
                    'gpuUtil',
                    'temperature',
                    'powerDraw',
                    'powerLimit',
                    'memUsed',
                    'memTotal',
                    'fanSpeed',
                ],
                headers: [
                    t('commons.table.date'),
                    'GPU',
                    'GPU ID',
                    t('aiTools.gpu.legacyDevice'),
                    `${t('aiTools.gpu.gpuUtil')} (%)`,
                    `${t('aiTools.gpu.temperature')} (°C)`,
                    `${t('aiTools.gpu.powerUsage')} (W)`,
                    `${t('aiTools.gpu.powerLimit')} (W)`,
                    `${t('aiTools.gpu.memoryUsed')} (MiB)`,
                    `${t('aiTools.gpu.memoryTotal')} (MiB)`,
                    t('aiTools.gpu.fanSpeed'),
                ],
                rows,
            };
        };
        const collectTables = async (): Promise<MonitorExportTable[]> => {
            const [startTime, endTime] = timeRange.value;
            const jobs: Promise<void>[] = [];
            const datasets: Array<MonitorData> = [];
            const gpuDatasets: Array<{ device: ChartHide; data: MonitorGPUData }> = [];

            const search = (param: string, io = 'all', network = 'all') =>
                rpc.monitor
                    .search({
                        param: param as any,
                        io,
                        network,
                        startTime: new Date(startTime).toISOString(),
                        endTime: new Date(endTime).toISOString(),
                    })
                    .then((res) => {
                        datasets.push(...(res.items.map(toMonitorChartSeries) as any));
                    });

            if (form.params.some((item) => ['cpu', 'memory', 'load'].includes(item))) {
                jobs.push(search('load'));
            }
            if (form.params.includes('io')) {
                // empty io queries every device in one request; 'all' selects the stored aggregate rows only
                jobs.push(search('io', form.io === ALL_DEVICES ? '' : form.io));
            }
            if (form.params.includes('network')) {
                jobs.push(search('network', 'all', form.network === ALL_DEVICES ? '' : form.network));
            }
            if (form.params.includes('gpu')) {
                const devices = gpuOptions.value.filter(
                    (device) => form.gpuDevice === ALL_DEVICES || device.value === form.gpuDevice,
                );
                for (const device of devices) {
                    jobs.push(
                        loadGPUMonitor(
                            {
                                deviceID: device.deviceID,
                                productName: device.productName,
                                legacy: device.legacy,
                                startTime,
                                endTime,
                            },
                            currentNode.value,
                        ).then((res) => {
                            gpuDatasets.push({ device, data: res.data });
                        }),
                    );
                }
            }
            await Promise.all(jobs);

            const tables: MonitorExportTable[] = [];
            if (form.params.some((item) => ['cpu', 'memory', 'load'].includes(item))) {
                tables.push(buildBaseTable(datasets));
            }
            if (form.params.includes('io')) {
                tables.push(buildIOTable(datasets));
            }
            if (form.params.includes('network')) {
                tables.push(buildNetworkTable(datasets));
            }
            if (form.params.includes('gpu')) {
                tables.push(buildGPUTable(gpuDatasets));
            }
            return tables;
        };
        const onExport = async () => {
            if (form.params.length === 0) {
                MsgWarning(t('monitor.selectMetrics'));
                return;
            }
            if (!timeRange.value || timeRange.value.length !== 2) {
                MsgWarning(t('monitor.selectTimeRange'));
                return;
            }
            loading.value = true;
            try {
                await optionsReady.value;
                // retry only the lists that failed on mount; a stale but non-empty gpu list is still usable
                await loadOptions(true);
                if (
                    form.params.includes('gpu') &&
                    form.gpuDevice === ALL_DEVICES &&
                    gpuOptionsFailed.value &&
                    gpuOptions.value.length === 0
                ) {
                    MsgWarning(t('monitor.exportOptionsFailed', ['GPU']));
                    return;
                }
                const tables = await collectTables();
                if (tables.every((table) => table.rows.length === 0)) {
                    MsgWarning(t('commons.msg.noneData'));
                    return;
                }
                const emptyTables = tables
                    .filter((table) => table.rows.length === 0)
                    .map((table) => tableLabel(table.name));
                const truncated = await exportMonitorTables(
                    tables,
                    form.format,
                    `1panel-monitor-${dateFormatForName(new Date())}`,
                );
                if (emptyTables.length > 0) {
                    MsgWarning(t('monitor.exportEmptyTables', [emptyTables.join(', ')]));
                }
                if (truncated.length > 0) {
                    MsgWarning(t('monitor.exportTruncated', [truncated.map(tableLabel).join(', ')]));
                }
            } finally {
                loading.value = false;
            }
        };
        const optionsReady = ref<Promise<void>>(Promise.resolve());
        const loadIOOptions = async () => {
            try {
                const res = await rpc.monitor.listIOOptions({});
                ioOptions.value = res.items || [];
                ioOptionsFailed.value = false;
            } catch {
                ioOptionsFailed.value = true;
            }
        };
        const loadNetOptions = async () => {
            try {
                const res = await rpc.monitor.listNetworkOptions({});
                netOptions.value = res.items || [];
                netOptionsFailed.value = false;
            } catch {
                netOptionsFailed.value = true;
            }
        };
        const loadGPUOptions = async () => {
            try {
                const res = await getGPUOptions(currentNode.value);
                gpuOptions.value = (res.data?.supported ? res.data.chartHide || [] : []).map((device) => ({
                    ...device,
                    value: device.deviceID || `legacy:${device.productName}`,
                    label: `${device.productName} · ${device.deviceID || t('aiTools.gpu.legacyDevice')}`,
                }));
                gpuOptionsFailed.value = false;
            } catch {
                gpuOptionsFailed.value = true;
            }
        };
        const loadOptions = async (onlyFailed = false) => {
            const jobs: Promise<void>[] = [];
            if (!onlyFailed || ioOptionsFailed.value) {
                jobs.push(loadIOOptions());
            }
            if (!onlyFailed || netOptionsFailed.value) {
                jobs.push(loadNetOptions());
            }
            if (!onlyFailed || gpuOptionsFailed.value) {
                jobs.push(loadGPUOptions());
            }
            await Promise.all(jobs);
        };
        onMounted(() => {
            optionsReady.value = loadOptions();
        });
        return () => (
            <div>
                <MonitorRouter />
                {withDirectives(
                    <LayoutContent
                        title={$t('commons.button.export')}
                        divider={true}
                        v-slots={{
                            main: () => (
                                <>
                                    <ElForm
                                        onSubmit={($event?: any) => {
                                            $event.preventDefault();
                                        }}
                                        label-position="left"
                                        label-width="160px"
                                    >
                                        <ElRow>
                                            <ElCol span={1}>
                                                <br />
                                            </ElCol>
                                            <ElCol xs={24} sm={20} md={16} lg={12} xl={10}>
                                                <ElFormItem label={$t('monitor.exportRange')}>
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
                                                        size={unref(isMobile) ? 'small' : 'default'}
                                                        class={'w-full'}
                                                    />
                                                </ElFormItem>
                                                <ElFormItem label={$t('monitor.exportMetrics')}>
                                                    <div>
                                                        <ElCheckboxGroup
                                                            modelValue={form.params}
                                                            onUpdate:modelValue={($v) => {
                                                                form.params = $v as any;
                                                            }}
                                                        >
                                                            <ElCheckbox label="CPU" value="cpu" />
                                                            <ElCheckbox label={$t('monitor.memory')} value="memory" />
                                                            <ElCheckbox label={$t('monitor.avgLoad')} value="load" />
                                                            <ElCheckbox
                                                                label={$t('monitor.disk') + ' I/O'}
                                                                value="io"
                                                            />
                                                            <ElCheckbox label={$t('monitor.network')} value="network" />
                                                            {unref(gpuOptions).length > 0 || unref(gpuOptionsFailed) ? (
                                                                <ElCheckbox label="GPU" value="gpu" />
                                                            ) : null}
                                                        </ElCheckboxGroup>
                                                        <span class={'input-help'}>
                                                            {$t('monitor.exportMetricsHelper')}
                                                        </span>
                                                    </div>
                                                </ElFormItem>
                                                {form.params.includes('io') ? (
                                                    <ElFormItem label={$t('monitor.disk')}>
                                                        <ElSelect
                                                            modelValue={form.io}
                                                            onUpdate:modelValue={($v) => {
                                                                form.io = $v as any;
                                                            }}
                                                            class={'w-full'}
                                                        >
                                                            <ElOption
                                                                label={$t('monitor.exportAllDevices')}
                                                                value="*"
                                                            />
                                                            {(unref(ioOptions) || []).map((item) => (
                                                                <ElOption
                                                                    label={
                                                                        item === 'all'
                                                                            ? $t('monitor.exportAggregate')
                                                                            : item
                                                                    }
                                                                    value={item}
                                                                    key={item}
                                                                />
                                                            ))}
                                                        </ElSelect>
                                                    </ElFormItem>
                                                ) : null}
                                                {form.params.includes('network') ? (
                                                    <ElFormItem label={$t('monitor.networkCard')}>
                                                        <ElSelect
                                                            modelValue={form.network}
                                                            onUpdate:modelValue={($v) => {
                                                                form.network = $v as any;
                                                            }}
                                                            class={'w-full'}
                                                        >
                                                            <ElOption
                                                                label={$t('monitor.exportAllInterfaces')}
                                                                value="*"
                                                            />
                                                            {(unref(netOptions) || []).map((item) => (
                                                                <ElOption
                                                                    label={
                                                                        item === 'all'
                                                                            ? $t('monitor.exportAggregate')
                                                                            : item
                                                                    }
                                                                    value={item}
                                                                    key={item}
                                                                />
                                                            ))}
                                                        </ElSelect>
                                                    </ElFormItem>
                                                ) : null}
                                                {form.params.includes('gpu') ? (
                                                    <ElFormItem label="GPU">
                                                        <ElSelect
                                                            modelValue={form.gpuDevice}
                                                            onUpdate:modelValue={($v) => {
                                                                form.gpuDevice = $v as any;
                                                            }}
                                                            class={'w-full'}
                                                        >
                                                            <ElOption
                                                                label={$t('monitor.exportAllDevices')}
                                                                value="*"
                                                            />
                                                            {(unref(gpuOptions) || []).map((item) => (
                                                                <ElOption
                                                                    label={item.label}
                                                                    value={item.value}
                                                                    key={item.value}
                                                                />
                                                            ))}
                                                        </ElSelect>
                                                    </ElFormItem>
                                                ) : null}
                                                <ElFormItem label={$t('monitor.exportFormat')}>
                                                    <div>
                                                        <ElRadioGroup
                                                            modelValue={form.format}
                                                            onUpdate:modelValue={($v) => {
                                                                form.format = $v as any;
                                                            }}
                                                        >
                                                            <ElRadio value="csv">{'CSV'}</ElRadio>
                                                            <ElRadio value="json">{'JSON'}</ElRadio>
                                                            <ElRadio value="xlsx">{'Excel (xlsx)'}</ElRadio>
                                                        </ElRadioGroup>
                                                        <span class={'input-help'}>{unref(formatHelper)}</span>
                                                    </div>
                                                </ElFormItem>
                                                <ElFormItem>
                                                    {withDirectives(
                                                        <ElButton
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                (onExport as any)($event);
                                                            }}
                                                            disabled={unref(loading)}
                                                        >
                                                            {$t('commons.button.export')}
                                                        </ElButton>,
                                                        [
                                                            [permissionDirective, true],
                                                            [nodeAdminDirective, true],
                                                        ],
                                                    )}
                                                </ElFormItem>
                                            </ElCol>
                                        </ElRow>
                                    </ElForm>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
            </div>
        );
    },
    options,
);

definePage({
    name: 'HostMonitorExport',
    meta: {
        activeMenu: '/hosts/monitor/monitor',
        title: 'menu.monitor',
        detail: 'commons.button.export',
        permission: 'host_monitor_view',
        hidden: true,
    },
});
