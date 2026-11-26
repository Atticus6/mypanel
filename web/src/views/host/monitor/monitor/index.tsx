import { $t } from '@/utils/i18n-t';
interface MonitorData {
    param: string;
    date: Array<Date>;
    value: Array<any>;
}
interface MonitorSearch {
    param: string;
    io: string;
    network: string;
    startTime: Date;
    endTime: Date;
}
import { ref, reactive, onMounted, watch } from 'vue';
import { toMonitorChartSeries } from '@/lib/rpc/monitor';
import { computeSize, computeSizeFromKBs } from '@/utils/size';
import { dateFormatWithoutYear } from '@/utils/date';
import i18n from '@/lang';
import MonitorRouter from '@/views/host/monitor/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { shortcuts } from '@/utils/shortcuts';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElCard } from 'element-plus';
import { ElDatePicker } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElDropdown } from 'element-plus';
import { ElDropdownMenu } from 'element-plus';
import { ElDropdownItem } from 'element-plus';
import TableRefresh from '@/components/table/TableRefresh';
import VCharts from '@/components/v-charts/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'monitor',
    props: {},
    emits: emits,
    __scopeId: 'data-v-32d43d55',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { defaultIO, defaultNetwork, isMobile } = useGlobalStore();
        const monitorBase = ref();
        const timeRangeGlobal = ref<[Date, Date]>([new Date(new Date().setHours(0, 0, 0, 0)), new Date()]);
        const timeRangeLoad = ref<[Date, Date]>([new Date(new Date().setHours(0, 0, 0, 0)), new Date()]);
        const timeRangeCpu = ref<[Date, Date]>([new Date(new Date().setHours(0, 0, 0, 0)), new Date()]);
        const timeRangeMemory = ref<[Date, Date]>([new Date(new Date().setHours(0, 0, 0, 0)), new Date()]);
        const timeRangeIO = ref<[Date, Date]>([new Date(new Date().setHours(0, 0, 0, 0)), new Date()]);
        const timeRangeNetwork = ref<[Date, Date]>([new Date(new Date().setHours(0, 0, 0, 0)), new Date()]);
        const networkChoose = ref();
        const netOptions = ref();
        const ioChoose = ref();
        const ioOptions = ref();
        const chartsOption = ref<Record<string, any>>({
            loadLoadChart: null,
            loadCPUChart: null,
            loadMemoryChart: null,
            loadIOChart: null,
            loadNetworkChart: null,
        });
        const loadingMap = reactive({
            load: false,
            cpu: false,
            memory: false,
            io: false,
            network: false,
        });
        const getLoadChartGrid = () =>
            isMobile.value ? { left: 8, right: 8, top: 64, bottom: '20%', containLabel: true } : undefined;
        const getMultiSeriesChartLegend = () =>
            isMobile.value
                ? { show: true, type: 'scroll', orient: 'horizontal', left: 8, right: 8, top: 0, bottom: null }
                : { show: true, type: 'plain', orient: 'horizontal', left: 'center', top: null, bottom: 15 };
        const getTransferChartGrid = () =>
            isMobile.value
                ? { left: 8, right: 8, top: 64, bottom: 110, containLabel: true }
                : { left: getSideWidth(true), right: getSideWidth(true), bottom: '20%' };
        const getSingleSeriesChartGrid = () =>
            isMobile.value ? { left: 8, right: 8, top: 40, bottom: 110, containLabel: true } : undefined;
        const getSingleSeriesChartLegend = () =>
            isMobile.value
                ? { show: true, type: 'plain', top: 0, bottom: null, left: 'center', right: null }
                : { show: true, type: 'plain', top: null, bottom: 15, left: 'center' };
        const getMobileChartXAxis = () =>
            isMobile.value ? { axisLabel: { interval: 'auto', hideOverlap: true, fontSize: 10 } } : undefined;
        watch(isMobile, () => {
            const loadOption = chartsOption.value.loadLoadChart;
            if (loadOption) {
                chartsOption.value.loadLoadChart = {
                    ...loadOption,
                    grid: getLoadChartGrid(),
                    legend: getMultiSeriesChartLegend(),
                };
            }

            for (const chartKey of ['loadCPUChart', 'loadMemoryChart']) {
                const chartOption = chartsOption.value[chartKey];
                if (!chartOption) {
                    continue;
                }
                chartsOption.value[chartKey] = {
                    ...chartOption,
                    grid: getSingleSeriesChartGrid(),
                    legend: getSingleSeriesChartLegend(),
                    xAxis: getMobileChartXAxis(),
                };
            }

            for (const chartKey of ['loadIOChart', 'loadNetworkChart']) {
                const chartOption = chartsOption.value[chartKey];
                if (!chartOption) {
                    continue;
                }
                chartsOption.value[chartKey] = {
                    ...chartOption,
                    grid: getTransferChartGrid(),
                    legend: getMultiSeriesChartLegend(),
                    xAxis: getMobileChartXAxis(),
                };
            }
        });
        const searchTime = ref();
        const searchInfo = reactive<MonitorSearch>({
            param: '',
            io: '',
            network: '',
            startTime: new Date(new Date().setHours(0, 0, 0, 0)),
            endTime: new Date(),
        });
        const searchGlobal = () => {
            timeRangeLoad.value = timeRangeGlobal.value;
            timeRangeCpu.value = timeRangeGlobal.value;
            timeRangeMemory.value = timeRangeGlobal.value;
            timeRangeIO.value = timeRangeGlobal.value;
            timeRangeNetwork.value = timeRangeGlobal.value;
            search('all');
        };
        const search = async (param: string) => {
            searchInfo.param = param;
            switch (param) {
                case 'load':
                    searchTime.value = timeRangeLoad.value;
                    break;
                case 'cpu':
                    searchTime.value = timeRangeCpu.value;
                    break;
                case 'memory':
                    searchTime.value = timeRangeMemory.value;
                    break;
                case 'io':
                    searchTime.value = timeRangeIO.value;
                    searchInfo.io = ioChoose.value || 'all';
                    break;
                case 'network':
                    searchTime.value = timeRangeNetwork.value;
                    searchInfo.network = networkChoose.value || 'all';
                    break;
                case 'all':
                    searchTime.value = timeRangeGlobal.value;
                    searchInfo.io = ioChoose.value || 'all';
                    searchInfo.network = networkChoose.value || 'all';
                    break;
            }
            if (searchTime.value && searchTime.value.length === 2) {
                searchInfo.startTime = searchTime.value[0];
                searchInfo.endTime = searchTime.value[1];
            }
            setChartLoading(param, true);
            try {
                const res = await rpc.monitor.search({
                    param: searchInfo.param as any,
                    io: searchInfo.io,
                    network: searchInfo.network,
                    startTime: new Date(searchInfo.startTime).toISOString(),
                    endTime: new Date(searchInfo.endTime).toISOString(),
                });
                monitorBase.value = res.items.map(toMonitorChartSeries) as any;
                for (const item of monitorBase.value) {
                    if (!item.value) {
                        item.value = [];
                        item.date = [];
                    }
                    switch (item.param) {
                        case 'base':
                            let baseDate = item.date.length === 0 ? loadEmptyDate(timeRangeCpu.value) : item.date;
                            baseDate = baseDate.map(function (item: any) {
                                return dateFormatWithoutYear(item);
                            });
                            if (param === 'cpu' || param === 'all') {
                                initCPUCharts(baseDate, item);
                            }
                            if (param === 'memory' || param === 'all') {
                                initMemCharts(baseDate, item);
                            }
                            if (param === 'load' || param === 'all') {
                                initLoadCharts(item);
                            }
                            break;
                        case 'io':
                            initIOCharts(item);
                            break;
                        case 'network':
                            initNetCharts(item);
                            break;
                    }
                }
            } finally {
                setChartLoading(param, false);
            }
        };
        const changeNetwork = (item: string) => {
            networkChoose.value = item;
            search('network');
        };
        const changeIO = (item: string) => {
            ioChoose.value = item;
            search('io');
        };
        const loadOptions = async () => {
            const res = await rpc.monitor.listNetworkOptions({});
            netOptions.value = res.items;
            searchInfo.network = defaultNetwork.value || (netOptions.value && netOptions.value[0]);
            networkChoose.value = searchInfo.network;

            const res1 = await rpc.monitor.listIOOptions({});
            ioOptions.value = res1.items;
            searchInfo.io = defaultIO.value || (ioOptions.value && ioOptions.value[0]);
            ioChoose.value = searchInfo.io;

            search('all');
        };
        const setChartLoading = (param: string, value: boolean) => {
            if (param === 'all') {
                loadingMap.load = value;
                loadingMap.cpu = value;
                loadingMap.memory = value;
                loadingMap.io = value;
                loadingMap.network = value;
                return;
            }
            switch (param) {
                case 'load':
                    loadingMap.load = value;
                    break;
                case 'cpu':
                    loadingMap.cpu = value;
                    break;
                case 'memory':
                    loadingMap.memory = value;
                    break;
                case 'io':
                    loadingMap.io = value;
                    break;
                case 'network':
                    loadingMap.network = value;
                    break;
            }
        };
        function initLoadCharts(item: MonitorData) {
            let itemLoadDate = item.date.length === 0 ? loadEmptyDate(timeRangeLoad.value) : item.date;
            let loadDate = itemLoadDate.map(function (item: any) {
                return dateFormatWithoutYear(item);
            });
            let load1Data = item.value.map(function (item: any) {
                return item.cpuLoad1.toFixed(2);
            });
            load1Data = load1Data.length === 0 ? loadEmptyData() : load1Data;
            let load5Data = item.value.map(function (item: any) {
                return item.cpuLoad5.toFixed(2);
            });
            load5Data = load5Data.length === 0 ? loadEmptyData() : load5Data;
            let load15Data = item.value.map(function (item: any) {
                return item.cpuLoad15.toFixed(2);
            });
            load15Data = load15Data.length === 0 ? loadEmptyData() : load15Data;
            let loadUsage = item.value.map(function (item: any) {
                return { value: item.loadUsage.toFixed(2), top: item.topCPUItems, unit: '%' };
            });
            loadUsage = loadUsage.length === 0 ? loadTopEmptyData() : loadUsage;
            chartsOption.value['loadLoadChart'] = {
                xData: loadDate,
                yData: [
                    {
                        name: '1 ' + i18n.global.t('commons.units.minute', 1),
                        data: load1Data,
                    },
                    {
                        name: '5 ' + i18n.global.t('commons.units.minute', 5),
                        data: load5Data,
                    },
                    {
                        name: '15 ' + i18n.global.t('commons.units.minute', 15),
                        data: load15Data,
                    },
                    {
                        name: i18n.global.t('monitor.resourceUsage'),
                        data: loadUsage,
                        yAxisIndex: 1,
                    },
                ],
                yAxis: [
                    { type: 'value', name: i18n.global.t('monitor.loadDetail') },
                    {
                        type: 'value',
                        name: i18n.global.t('monitor.resourceUsage') + ' ( % )',
                        position: 'right',
                        alignTicks: true,
                    },
                ],
                grid: getLoadChartGrid(),
                legend: getMultiSeriesChartLegend(),
                tooltip: {
                    trigger: 'axis',
                    formatter: function (datas: any) {
                        return withCPUProcess(datas);
                    },
                },
            };
        }
        function initCPUCharts(baseDate: any, items: MonitorData) {
            let data = items.value.map(function (item: any) {
                return { value: item.cpu.toFixed(2), top: item.topCPUItems, unit: '%' };
            });
            data = data.length === 0 ? loadTopEmptyData() : data;
            chartsOption.value['loadCPUChart'] = {
                xData: baseDate,
                yData: [
                    {
                        name: 'CPU',
                        data: data,
                    },
                ],
                tooltip: {
                    trigger: 'axis',
                    formatter: function (datas: any) {
                        return withCPUProcess(datas);
                    },
                },
                grid: getSingleSeriesChartGrid(),
                legend: getSingleSeriesChartLegend(),
                xAxis: getMobileChartXAxis(),
                formatStr: '%',
            };
        }
        function initMemCharts(baseDate: any, items: MonitorData) {
            let data = items.value.map(function (item: any) {
                return { value: item.memory.toFixed(2), top: item.topMemItems };
            });
            data = data.length === 0 ? loadTopEmptyData() : data;
            chartsOption.value['loadMemoryChart'] = {
                xData: baseDate,
                yData: [
                    {
                        name: i18n.global.t('monitor.memory'),
                        data: data,
                    },
                ],
                tooltip: {
                    trigger: 'axis',
                    formatter: function (datas: any) {
                        return withMemProcess(datas);
                    },
                },
                grid: getSingleSeriesChartGrid(),
                legend: getSingleSeriesChartLegend(),
                xAxis: getMobileChartXAxis(),
                formatStr: '%',
            };
        }
        function initNetCharts(item: MonitorData) {
            let networkDate = item.date.length === 0 ? loadEmptyDate(timeRangeNetwork.value) : item.date;
            let date = networkDate.map(function (item: any) {
                return dateFormatWithoutYear(item);
            });
            let networkUp = item.value.map(function (item: any) {
                return item.up.toFixed(2);
            });
            networkUp = networkUp.length === 0 ? loadEmptyData() : networkUp;
            let networkOut = item.value.map(function (item: any) {
                return item.down.toFixed(2);
            });
            networkOut = networkOut.length === 0 ? loadEmptyData() : networkOut;

            chartsOption.value['loadNetworkChart'] = {
                xData: date,
                yData: [
                    {
                        name: i18n.global.t('monitor.up'),
                        data: networkUp,
                    },
                    {
                        name: i18n.global.t('monitor.down'),
                        data: networkOut,
                    },
                ],
                tooltip: {
                    trigger: 'axis',
                    formatter: function (datas: any) {
                        let res = loadDate(datas[0].name);
                        for (const item of datas) {
                            res += loadSeries(item, computeSizeFromKBs(item.data), '');
                        }
                        return res;
                    },
                },
                grid: getTransferChartGrid(),
                legend: getMultiSeriesChartLegend(),
                xAxis: getMobileChartXAxis(),
                formatStr: 'KB/s',
            };
        }
        function initIOCharts(item: MonitorData) {
            let itemIODate = item.date?.length === 0 ? loadEmptyDate(timeRangeIO.value) : item.date;
            let ioDate = itemIODate.map(function (item: any) {
                return dateFormatWithoutYear(item);
            });
            let ioRead = item.value.map(function (item: any) {
                return Number((item.read / 1024).toFixed(2));
            });
            ioRead = ioRead.length === 0 ? loadEmptyData() : ioRead;
            let ioWrite = item.value.map(function (item: any) {
                return Number((item.write / 1024).toFixed(2));
            });
            ioWrite = ioWrite.length === 0 ? loadEmptyData() : ioWrite;
            let ioCount = item.value.map(function (item: any) {
                return item.count;
            });
            ioCount = ioCount.length === 0 ? loadEmptyData() : ioCount;
            let ioTime = item.value.map(function (item: any) {
                return item.time;
            });
            ioTime = ioTime.length === 0 ? loadEmptyData() : ioTime;
            chartsOption.value['loadIOChart'] = {
                xData: ioDate,
                yData: [
                    {
                        name: i18n.global.t('monitor.read'),
                        data: ioRead,
                    },
                    {
                        name: i18n.global.t('monitor.write'),
                        data: ioWrite,
                    },
                    {
                        name: i18n.global.t('monitor.readWriteCount'),
                        data: ioCount,
                        yAxisIndex: 1,
                    },
                    {
                        name: i18n.global.t('monitor.readWriteTime'),
                        data: ioTime,
                        yAxisIndex: 1,
                    },
                ],
                tooltip: {
                    trigger: 'axis',
                    formatter: function (datas: any) {
                        let res = loadDate(datas[0].name);
                        for (const item of datas) {
                            if (
                                item.seriesName === i18n.global.t('monitor.read') ||
                                item.seriesName === i18n.global.t('monitor.write')
                            ) {
                                res += loadSeries(item, computeSizeFromKBs(item.data), '');
                            }
                            if (item.seriesName === i18n.global.t('monitor.readWriteCount')) {
                                res += loadSeries(item, item.data, i18n.global.t('commons.units.time') + '/s');
                            }
                            if (item.seriesName === i18n.global.t('monitor.readWriteTime')) {
                                res += loadSeries(item, item.data, ' ms');
                            }
                        }
                        return res;
                    },
                },
                grid: getTransferChartGrid(),
                legend: getMultiSeriesChartLegend(),
                xAxis: getMobileChartXAxis(),
                yAxis: [
                    { type: 'value', name: '( KB/s )', axisLabel: { fontSize: 10 } },
                    {
                        type: 'value',
                        position: 'right',
                        alignTicks: true,
                        axisLabel: {
                            fontSize: 10,
                        },
                    },
                ],
            };
        }
        function loadEmptyDate(timeRange: any) {
            if (timeRange.length != 2) {
                return;
            }
            let date1 = new Date(timeRange[0]);
            let date2 = new Date(timeRange[1]);
            return [date1, date2];
        }
        function loadEmptyData() {
            return [0, 0];
        }
        function loadTopEmptyData() {
            return [{ value: 0, top: 0, unit: '' }];
        }
        function withCPUProcess(datas: any) {
            let tops;
            let res = loadDate(datas[0].name);
            for (const item of datas) {
                if (item.data?.top) {
                    tops = item.data?.top;
                }
                res += loadSeries(item, item.data.value ? item.data.value : item.data, item.data.unit || '');
            }
            if (!tops) {
                return res;
            }
            res += `
                <div style="margin-top: 10px; border-bottom: 1px dashed black;"></div>
                <table style="border-collapse: collapse; margin-top: 20px; font-size: 12px;">
                <thead>
                    <tr>
                    <th style="padding: 6px 8px;">PID</th>
                    <th style="padding: 6px 8px;">${i18n.global.t('commons.table.user')}</th>
                    <th style="padding: 6px 8px;">${i18n.global.t('menu.process')}</th>
                    <th style="padding: 6px 8px;">${i18n.global.t('monitor.percent')}</th>
                    </tr>
                </thead>
                <tbody>
            `;
            for (const row of tops) {
                res += `
                    <tr>
                        <td style="padding: 6px 8px; text-align: center;">
                            ${row.pid}
                        </td>
                        <td style="padding: 6px 8px; text-align: center;">
                            ${row.user}
                        </td>
                        <td style="padding: 6px 8px; text-align: center;">
                            ${row.name}
                        </td>
                        <td style="padding: 6px 8px; text-align: center;">
                            ${row.percent.toFixed(2)}%
                        </td>
                    </tr>
                `;
            }
            return res;
        }
        function withMemProcess(datas: any) {
            let res = loadDate(datas[0].name);
            for (const item of datas) {
                res += loadSeries(item, item.data.value ? item.data.value : item.data, ' %');
            }
            if (!datas[0].data.top) {
                return res;
            }
            res += `
                <div style="margin-top: 10px; border-bottom: 1px dashed black;"></div>
                <table style="border-collapse: collapse; margin-top: 20px; font-size: 12px;">
                <thead>
                    <tr>
                        <th style="padding: 6px 8px;">PID</th>
                        <th style="padding: 6px 8px;">${i18n.global.t('commons.table.user')}</th>
                        <th style="padding: 6px 8px;">${i18n.global.t('menu.process')}</th>
                        <th style="padding: 6px 8px;">${i18n.global.t('monitor.memory')}</th>
                        <th style="padding: 6px 8px;">${i18n.global.t('monitor.percent')}</th>
                    </tr>
                </thead>
                <tbody>
            `;
            for (const item of datas) {
                for (const row of item.data.top) {
                    res += `
                          <tr>
                            <td style="padding: 6px 8px; text-align: center;">
                              <span style="display: inline-block;"></span>
                              ${row.pid}
                            </td>
                            <td style="padding: 6px 8px; text-align: center;">
                              ${row.user}
                            </td>
                            <td style="padding: 6px 8px; text-align: center;">
                              ${row.name}
                            </td>
                            <td style="padding: 6px 8px; text-align: center;">
                              ${computeSize(row.memory)}
                            </td>
                            <td style="padding: 6px 8px; text-align: center;">
                              ${row.percent.toFixed(2)}%
                            </td>
                          </tr>
                        `;
                }
            }
            return res;
        }
        function loadDate(name: any) {
            return ` <div style="display: inline-block; width: 100%; padding-bottom: 10px;">
                        ${i18n.global.t('commons.search.date')}: ${name.replaceAll('\n', ' ')}
                    </div>`;
        }
        function loadSeries(item: any, data: any, unit: any) {
            return `<div style="width: 100%;">
                        ${item.marker} ${item.seriesName}: ${data} ${unit}
                    </div>`;
        }
        function getSideWidth(b: boolean) {
            return !b || document.body.clientWidth > 1600 ? '7%' : '10%';
        }
        onMounted(() => {
            loadOptions();
        });
        return () => (
            <div>
                <MonitorRouter />
                <div class={'content-container__search'}>
                    <ElCard>
                        <div class={'monitor-toolbar monitor-toolbar--global'}>
                            <ElDatePicker
                                onChange={($event?: any) => {
                                    searchGlobal();
                                }}
                                modelValue={unref(timeRangeGlobal)}
                                onUpdate:modelValue={($v) => {
                                    timeRangeGlobal.value = $v as any;
                                }}
                                type="datetimerange"
                                range-separator="-"
                                start-placeholder={$t('commons.search.timeStart')}
                                end-placeholder={$t('commons.search.timeEnd')}
                                shortcuts={shortcuts}
                                size={unref(isMobile) ? 'small' : 'default'}
                                class={'monitor-time-range'}
                            />
                            <TableRefresh
                                onSearch={($event?: any) => {
                                    searchGlobal();
                                }}
                                class={'monitor-refresh float-right'}
                            />
                        </div>
                    </ElCard>
                </div>
                <ElRow gutter={7} class={'card-interval'}>
                    <ElCol span={24}>
                        <ElCard
                            style={'overflow: inherit'}
                            v-slots={{
                                header: () => (
                                    <>
                                        <div class={'monitor-toolbar monitor-toolbar--card'}>
                                            <span class={'title'}>{$t('monitor.avgLoad')}</span>
                                            <ElDatePicker
                                                onChange={($event?: any) => {
                                                    search('load');
                                                }}
                                                modelValue={unref(timeRangeLoad)}
                                                onUpdate:modelValue={($v) => {
                                                    timeRangeLoad.value = $v as any;
                                                }}
                                                type="datetimerange"
                                                range-separator="-"
                                                start-placeholder={$t('commons.search.timeStart')}
                                                end-placeholder={$t('commons.search.timeEnd')}
                                                shortcuts={shortcuts}
                                                size={unref(isMobile) ? 'small' : 'default'}
                                                class={'monitor-time-range'}
                                            />
                                        </div>
                                    </>
                                ),
                            }}
                        >
                            {withDirectives(
                                <div class={'chart'}>
                                    {unref(chartsOption)['loadLoadChart'] ? (
                                        <VCharts
                                            height="400px"
                                            id="loadLoadChart"
                                            type="line"
                                            option={unref(chartsOption)['loadLoadChart']}
                                            dataZoom={true}
                                        />
                                    ) : null}
                                </div>,
                                [[vLoading, loadingMap.load]],
                            )}
                        </ElCard>
                    </ElCol>
                </ElRow>
                <ElRow gutter={7} class={'card-interval'}>
                    <ElCol xs={24} sm={24} md={12} lg={12} xl={12}>
                        <ElCard
                            style={'overflow: inherit'}
                            v-slots={{
                                header: () => (
                                    <>
                                        <div class={'monitor-toolbar monitor-toolbar--card'}>
                                            <span class={'title'}>{'CPU'}</span>
                                            <ElDatePicker
                                                onChange={($event?: any) => {
                                                    search('cpu');
                                                }}
                                                modelValue={unref(timeRangeCpu)}
                                                onUpdate:modelValue={($v) => {
                                                    timeRangeCpu.value = $v as any;
                                                }}
                                                type="datetimerange"
                                                range-separator="-"
                                                start-placeholder={$t('commons.search.timeStart')}
                                                end-placeholder={$t('commons.search.timeEnd')}
                                                shortcuts={shortcuts}
                                                size={unref(isMobile) ? 'small' : 'default'}
                                                class={'monitor-time-range'}
                                            />
                                        </div>
                                    </>
                                ),
                            }}
                        >
                            {withDirectives(
                                <div class={'chart'}>
                                    {unref(chartsOption)['loadCPUChart'] ? (
                                        <VCharts
                                            height="400px"
                                            id="loadCPUChart"
                                            type="line"
                                            option={unref(chartsOption)['loadCPUChart']}
                                            dataZoom={true}
                                        />
                                    ) : null}
                                </div>,
                                [[vLoading, loadingMap.cpu]],
                            )}
                        </ElCard>
                    </ElCol>
                    <ElCol xs={24} sm={24} md={12} lg={12} xl={12}>
                        <ElCard
                            style={'overflow: inherit'}
                            v-slots={{
                                header: () => (
                                    <>
                                        <div class={'monitor-toolbar monitor-toolbar--card'}>
                                            <span class={'title'}>{$t('monitor.memory')}</span>
                                            <ElDatePicker
                                                onChange={($event?: any) => {
                                                    search('memory');
                                                }}
                                                modelValue={unref(timeRangeMemory)}
                                                onUpdate:modelValue={($v) => {
                                                    timeRangeMemory.value = $v as any;
                                                }}
                                                type="datetimerange"
                                                range-separator="-"
                                                start-placeholder={$t('commons.search.timeStart')}
                                                end-placeholder={$t('commons.search.timeEnd')}
                                                shortcuts={shortcuts}
                                                size={unref(isMobile) ? 'small' : 'default'}
                                                class={'monitor-time-range'}
                                            />
                                        </div>
                                    </>
                                ),
                            }}
                        >
                            {withDirectives(
                                <div class={'chart'}>
                                    {unref(chartsOption)['loadMemoryChart'] ? (
                                        <VCharts
                                            height="400px"
                                            id="loadMemoryChart"
                                            type="line"
                                            option={unref(chartsOption)['loadMemoryChart']}
                                            dataZoom={true}
                                        />
                                    ) : null}
                                </div>,
                                [[vLoading, loadingMap.memory]],
                            )}
                        </ElCard>
                    </ElCol>
                </ElRow>
                <ElRow gutter={7} class={'card-interval'}>
                    <ElCol xs={24} sm={24} md={12} lg={12} xl={12}>
                        <ElCard
                            style={'overflow: inherit'}
                            v-slots={{
                                header: () => (
                                    <>
                                        <div class={'monitor-toolbar monitor-toolbar--card'}>
                                            <div>
                                                <span class={'title'}>
                                                    {$t('monitor.disk')}
                                                    {' I/O'}
                                                    {$t('commons.colon')}
                                                </span>
                                                <ElDropdown
                                                    max-height="300px"
                                                    v-slots={{
                                                        dropdown: () => (
                                                            <>
                                                                <ElDropdownMenu>
                                                                    {(unref(ioOptions) || []).map((item) => (
                                                                        <div key={item}>
                                                                            {item === 'all' ? (
                                                                                <ElDropdownItem
                                                                                    onClick={($event?: any) => {
                                                                                        changeIO('all');
                                                                                    }}
                                                                                >
                                                                                    {$t('commons.table.all')}
                                                                                </ElDropdownItem>
                                                                            ) : (
                                                                                <ElDropdownItem
                                                                                    onClick={($event?: any) => {
                                                                                        changeIO(item);
                                                                                    }}
                                                                                >
                                                                                    {item}
                                                                                </ElDropdownItem>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </ElDropdownMenu>
                                                            </>
                                                        ),
                                                    }}
                                                >
                                                    <span class={'networkOption'}>
                                                        {unref(ioChoose) === 'all'
                                                            ? $t('commons.table.all')
                                                            : unref(ioChoose)}
                                                    </span>
                                                </ElDropdown>
                                            </div>
                                            <ElDatePicker
                                                onChange={($event?: any) => {
                                                    search('io');
                                                }}
                                                modelValue={unref(timeRangeIO)}
                                                onUpdate:modelValue={($v) => {
                                                    timeRangeIO.value = $v as any;
                                                }}
                                                type="datetimerange"
                                                range-separator="-"
                                                start-placeholder={$t('commons.search.timeStart')}
                                                end-placeholder={$t('commons.search.timeEnd')}
                                                shortcuts={shortcuts}
                                                size={unref(isMobile) ? 'small' : 'default'}
                                                class={'monitor-time-range'}
                                            />
                                        </div>
                                    </>
                                ),
                            }}
                        >
                            {withDirectives(
                                <div class={'chart'}>
                                    {unref(chartsOption)['loadIOChart'] ? (
                                        <VCharts
                                            height="400px"
                                            id="loadIOChart"
                                            type="line"
                                            option={unref(chartsOption)['loadIOChart']}
                                            dataZoom={true}
                                        />
                                    ) : null}
                                </div>,
                                [[vLoading, loadingMap.io]],
                            )}
                        </ElCard>
                    </ElCol>
                    <ElCol xs={24} sm={24} md={12} lg={12} xl={12}>
                        <ElCard
                            style={'overflow: inherit'}
                            v-slots={{
                                header: () => (
                                    <>
                                        <div class={'monitor-toolbar monitor-toolbar--card'}>
                                            <div>
                                                <span class={'title'}>
                                                    {$t('monitor.network')}
                                                    {$t('commons.colon')}
                                                </span>
                                                <ElDropdown
                                                    max-height="300px"
                                                    v-slots={{
                                                        dropdown: () => (
                                                            <>
                                                                <ElDropdownMenu>
                                                                    {(unref(netOptions) || []).map((item) => (
                                                                        <div key={item}>
                                                                            {item === 'all' ? (
                                                                                <ElDropdownItem
                                                                                    onClick={($event?: any) => {
                                                                                        changeNetwork('all');
                                                                                    }}
                                                                                >
                                                                                    {$t('commons.table.all')}
                                                                                </ElDropdownItem>
                                                                            ) : (
                                                                                <ElDropdownItem
                                                                                    onClick={($event?: any) => {
                                                                                        changeNetwork(item);
                                                                                    }}
                                                                                >
                                                                                    {item}
                                                                                </ElDropdownItem>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </ElDropdownMenu>
                                                            </>
                                                        ),
                                                    }}
                                                >
                                                    <span class={'networkOption'}>
                                                        {unref(networkChoose) === 'all'
                                                            ? $t('commons.table.all')
                                                            : unref(networkChoose)}
                                                    </span>
                                                </ElDropdown>
                                            </div>
                                            <ElDatePicker
                                                onChange={($event?: any) => {
                                                    search('network');
                                                }}
                                                modelValue={unref(timeRangeNetwork)}
                                                onUpdate:modelValue={($v) => {
                                                    timeRangeNetwork.value = $v as any;
                                                }}
                                                type="datetimerange"
                                                range-separator="-"
                                                start-placeholder={$t('commons.search.timeStart')}
                                                end-placeholder={$t('commons.search.timeEnd')}
                                                shortcuts={shortcuts}
                                                size={unref(isMobile) ? 'small' : 'default'}
                                                class={'monitor-time-range'}
                                            />
                                        </div>
                                    </>
                                ),
                            }}
                        >
                            {withDirectives(
                                <div class={'chart'}>
                                    {unref(chartsOption)['loadNetworkChart'] ? (
                                        <VCharts
                                            height="400px"
                                            id="loadNetworkChart"
                                            type="line"
                                            option={unref(chartsOption)['loadNetworkChart']}
                                            dataZoom={true}
                                        />
                                    ) : null}
                                </div>,
                                [[vLoading, loadingMap.network]],
                            )}
                        </ElCard>
                    </ElCol>
                </ElRow>
            </div>
        );
    },
    options,
);
