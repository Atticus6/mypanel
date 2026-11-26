import { $t } from '@/utils/i18n-t';
interface NPUInfo {
    type: 'ascend';
    index: number;
    npuIndex: number;
    chipIndex: number;
    productName: string;
    busID: string;
    health: string;
    temperature: string;
    powerDraw: string;
    aiCore: string;
    memUsed: string;
    memTotal: string;
    memoryUsed: string;
    memoryTotal: string;
    hbmUsed: string;
    hbmTotal: string;
    hugepagesUsed: string;
    hugepagesTotal: string;
}
import { Dashboard } from '@/types/dashboard';
import { computeSize } from '@/utils/size';
import i18n from '@/lang';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import GPUStatus from './gpu';
import { useMediaQuery } from '@vueuse/core';
import { routerToFileWithPath, routerToNameWithQuery } from '@/utils/router';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElCol } from 'element-plus';
import { ElPopover } from 'element-plus';
import { ElDescriptions } from 'element-plus';
import { ElDescriptionsItem } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElSpace } from 'element-plus';
import { ArrowRight } from '@element-plus/icons-vue';
import { ArrowDown } from '@element-plus/icons-vue';
import ComplexTable from '@/components/table/complex/ComplexTable';
import VCharts from '@/components/v-charts/index';
import { Bottom } from '@element-plus/icons-vue';
import { Top } from '@element-plus/icons-vue';
import ConfirmDialog from '@/components/confirm-dialog/index';

interface CodemodProps {
    [key: string]: any;
    view?: 'system' | 'gpu';
}

const emits = {};

const options = {
    name: 'status',
    props: {
        view: { type: null },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-faf3edb4',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const hasFinePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
        const showMore = ref(false);
        let cpuPopoverTimer: ReturnType<typeof setTimeout> | null = null;
        let memPopoverTimer: ReturnType<typeof setTimeout> | null = null;
        let cpuLoading = false;
        let memLoading = false;
        const baseInfo = ref<Dashboard.BaseInfo>({
            hostname: '',
            os: '',
            platform: '',
            platformFamily: '',
            platformVersion: '',
            kernelArch: '',
            kernelVersion: '',
            virtualizationSystem: '',
            ipV4Addr: '',
            httpProxy: '',

            cpuCores: 0,
            cpuLogicalCores: 0,
            cpuModelName: '',
            cpuMhz: 0,
            currentInfo: null,
            prettyDistro: '',
            quickJump: [],
        });
        const currentInfo = ref<Dashboard.CurrentInfo>({
            uptime: 0,
            timeSinceUptime: '',
            runningTime: {
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0,
            },
            procs: 0,

            load1: 0,
            load5: 0,
            load15: 0,
            loadUsagePercent: 0,

            cpuPercent: [] as Array<number>,
            cpuUsedPercent: 0,
            cpuUsed: 0,
            cpuTotal: 0,
            cpuDetailedPercent: [] as Array<number>,

            memoryTotal: 0,
            memoryAvailable: 0,
            memoryCache: 0,
            memoryFree: 0,
            memoryShard: 0,
            memoryUsed: 0,
            memoryUsedPercent: 0,
            swapMemoryTotal: 0,
            swapMemoryAvailable: 0,
            swapMemoryUsed: 0,
            swapMemoryUsedPercent: 0,

            ioReadBytes: 0,
            ioWriteBytes: 0,
            ioCount: 0,
            ioReadTime: 0,
            ioWriteTime: 0,

            diskData: [],
            gpuData: [],
            npuData: [],
            xpuData: [],

            topCPUItems: [],
            topMemItems: [],

            netBytesSent: 0,
            netBytesRecv: 0,
            shotTime: new Date(),
        });
        const cpuShowAll = ref();
        const showCpuDetailedPercent = ref(false);
        const showCpuTop = ref(false);
        const showMemTop = ref(false);
        const killProcessID = ref();
        const confirmConfRef = ref();
        const chartsOption = ref({
            cpu: { title: 'CPU', data: 0 },
            memory: { title: i18n.global.t('monitor.memory'), data: 0 },
            load: { title: i18n.global.t('home.load'), data: 0 },
        });
        const acceptParams = (current: Dashboard.CurrentInfo, base: Dashboard.BaseInfo): void => {
            normalizeDashboardAccelerators(current);
            currentInfo.value = current;
            baseInfo.value = base;
            chartsOption.value['cpu'] = {
                title: 'CPU',
                data: formatNumber(currentInfo.value.cpuUsedPercent),
            };
            chartsOption.value['memory'] = {
                title: i18n.global.t('monitor.memory'),
                data: formatNumber(currentInfo.value.memoryUsedPercent),
            };
            chartsOption.value['load'] = {
                title: i18n.global.t('home.load'),
                data: formatNumber(currentInfo.value.loadUsagePercent),
            };
            currentInfo.value.diskData = currentInfo.value.diskData || [];
            nextTick(() => {
                for (let i = 0; i < currentInfo.value.diskData.length; i++) {
                    let itemPath = currentInfo.value.diskData[i].path;
                    itemPath = itemPath.length > 12 ? itemPath.substring(0, 9) + '...' : itemPath;
                    chartsOption.value['disk' + i] = {
                        title: itemPath,
                        data: formatNumber(currentInfo.value.diskData[i].usedPercent),
                    };
                }
                showMore.value = localStorage.getItem('dashboard_show') === 'more';
            });
        };
        const changeShowMore = (show: boolean) => {
            showMore.value = show;
            localStorage.setItem('dashboard_show', show ? 'more' : 'hide');
        };
        const onKill = async (row: any) => {
            let params = {
                header: i18n.global.t('process.kill'),
                operationInfo: i18n.global.t('process.killHelper'),
                submitInputInfo: i18n.global.t('process.killNow'),
            };
            killProcessID.value = row.pid;
            confirmConfRef.value!.acceptParams(params);
        };
        const submitKill = async () => {
            await rpc.process.stopProcess({ pid: killProcessID.value }).then(() => {
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            });
        };
        function loadStatus(val: number) {
            if (val < 30) {
                return i18n.global.t('home.runSmoothly');
            }
            if (val < 70) {
                return i18n.global.t('home.runNormal');
            }
            if (val < 80) {
                return i18n.global.t('home.runSlowly');
            }
            return i18n.global.t('home.runJam');
        }
        function formatNumber(val: number) {
            return Number(val.toFixed(2));
        }
        const normalizeDashboardAccelerators = (current: Dashboard.CurrentInfo) => {
            const legacyNPUs = (current.gpuData || [])
                .filter((item) => item.type === 'ascend')
                .map<NPUInfo>((item) => ({
                    type: 'ascend',
                    index: item.index,
                    npuIndex: item.npuIndex,
                    chipIndex: item.chipIndex,
                    productName: item.productName,
                    busID: item.busID || '',
                    health: item.performanceState || '',
                    temperature: item.temperature || '',
                    powerDraw: item.powerDraw || item.powerUsage || '',
                    aiCore: item.gpuUtil || '',
                    memUsed: item.memUsed || '',
                    memTotal: item.memTotal || '',
                    memoryUsed: '',
                    memoryTotal: '',
                    hbmUsed: '',
                    hbmTotal: '',
                    hugepagesUsed: '',
                    hugepagesTotal: '',
                }));
            current.gpuData = (current.gpuData || []).filter((item) => item.type !== 'ascend');
            current.npuData = current.npuData?.length ? current.npuData : legacyNPUs;
        };
        const toggleCpuTop = async () => {
            showCpuTop.value = !showCpuTop.value;
            if (showCpuTop.value) {
                await loadTopCPUData();
                if (cpuPopoverTimer) {
                    clearInterval(Number(cpuPopoverTimer));
                }
                cpuPopoverTimer = setInterval(loadTopCPUData, 5000);
            } else {
                if (cpuPopoverTimer) {
                    clearInterval(Number(cpuPopoverTimer));
                    cpuPopoverTimer = null;
                }
            }
        };
        const onCpuPopoverHide = () => {
            showCpuTop.value = false;
            if (cpuPopoverTimer) {
                clearInterval(Number(cpuPopoverTimer));
                cpuPopoverTimer = null;
            }
        };
        const toggleMemTop = async () => {
            showMemTop.value = !showMemTop.value;
            if (showMemTop.value) {
                await loadTopMemData();
                if (memPopoverTimer) {
                    clearInterval(Number(memPopoverTimer));
                }
                memPopoverTimer = setInterval(loadTopMemData, 5000);
            } else {
                if (memPopoverTimer) {
                    clearInterval(Number(memPopoverTimer));
                    memPopoverTimer = null;
                }
            }
        };
        const onMemPopoverHide = () => {
            showMemTop.value = false;
            if (memPopoverTimer) {
                clearInterval(Number(memPopoverTimer));
                memPopoverTimer = null;
            }
        };
        const loadTopCPUData = async () => {
            if (cpuLoading) return;
            cpuLoading = true;
            try {
                const res = await rpc.dashboard.getTopCPU({});
                currentInfo.value.topCPUItems = res.items.map((item) => ({ ...item, memory: Number(item.memory) }));
            } catch (_error) {
                // ignore load errors
            } finally {
                cpuLoading = false;
            }
        };
        const loadTopMemData = async () => {
            if (memLoading) return;
            memLoading = true;
            try {
                const res = await rpc.dashboard.getTopMem({});
                currentInfo.value.topMemItems = res.items.map((item) => ({ ...item, memory: Number(item.memory) }));
            } catch (_error) {
                // ignore load errors
            } finally {
                memLoading = false;
            }
        };
        watch(
            () => __panelSetupProps.view,
            () => {
                onCpuPopoverHide();
                onMemPopoverHide();
            },
        );
        onBeforeUnmount(() => {
            if (cpuPopoverTimer) {
                clearInterval(Number(cpuPopoverTimer));
                cpuPopoverTimer = null;
            }
            if (memPopoverTimer) {
                clearInterval(Number(memPopoverTimer));
                memPopoverTimer = null;
            }
        });
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div class={'custom-row'}>
                {__panelSetupProps.view === 'system' ? (
                    <ElCol xs={6} sm={6} md={3} lg={3} xl={3} align="center">
                        {unref(chartsOption)['load'] ? (
                            <ElPopover
                                hide-after={20}
                                teleported={false}
                                width={320}
                                popper-class="dashboard-status-popover"
                                trigger={unref(hasFinePointer) ? 'hover' : 'click'}
                                onHide={($event?: any) => {
                                    (onCpuPopoverHide as any)($event);
                                }}
                                v-slots={{
                                    reference: () => (
                                        <>
                                            {unref(chartsOption)['load'] ? (
                                                <VCharts
                                                    height="160px"
                                                    id="load"
                                                    type="pie"
                                                    option={unref(chartsOption)['load']}
                                                />
                                            ) : null}
                                        </>
                                    ),
                                }}
                            >
                                <ElDescriptions column={1} size="small">
                                    <ElDescriptionsItem label={$t('home.loadAverage', [1])}>
                                        {formatNumber(unref(currentInfo).load1)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('home.loadAverage', [5])}>
                                        {formatNumber(unref(currentInfo).load5)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('home.loadAverage', [15])}>
                                        {formatNumber(unref(currentInfo).load15)}
                                    </ElDescriptionsItem>
                                </ElDescriptions>
                                <ElButton
                                    link
                                    size="small"
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (toggleCpuTop as any)($event);
                                    }}
                                    class={'float-left mb-2'}
                                >
                                    {$t('home.cpuTop')}
                                    {!unref(showCpuTop) ? (
                                        <ElIcon>
                                            <ArrowRight />
                                        </ElIcon>
                                    ) : null}
                                    {unref(showCpuTop) ? (
                                        <ElIcon>
                                            <ArrowDown />
                                        </ElIcon>
                                    ) : null}
                                </ElButton>
                                {unref(showCpuTop) ? (
                                    <ComplexTable data={unref(currentInfo).topCPUItems}>
                                        <ElTableColumn
                                            min-width={120}
                                            show-overflow-tooltip
                                            label={$t('menu.process')}
                                            prop="name"
                                        />
                                        <ElTableColumn
                                            min-width={60}
                                            label={$t('monitor.percent')}
                                            prop="percent"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.percent.toFixed(2)}
                                                        {'%'}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            width={80}
                                            label={$t('commons.table.operate')}
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                onKill(row);
                                                            }}
                                                        >
                                                            {$t('process.stopProcess')}
                                                        </ElButton>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </ComplexTable>
                                ) : null}
                            </ElPopover>
                        ) : null}
                        <span class={'input-help'}>{loadStatus(unref(currentInfo).loadUsagePercent)}</span>
                    </ElCol>
                ) : null}
                {__panelSetupProps.view === 'system' ? (
                    <ElCol xs={6} sm={6} md={3} lg={3} xl={3}>
                        {unref(chartsOption)['cpu'] ? (
                            <ElPopover
                                hide-after={20}
                                teleported={false}
                                width={430}
                                popper-class="dashboard-status-popover"
                                trigger={unref(hasFinePointer) ? 'hover' : 'click'}
                                onHide={($event?: any) => {
                                    (onCpuPopoverHide as any)($event);
                                }}
                                v-slots={{
                                    reference: () => (
                                        <>
                                            {unref(chartsOption)['cpu'] ? (
                                                <VCharts
                                                    height="160px"
                                                    id="cpu"
                                                    type="pie"
                                                    option={unref(chartsOption)['cpu']}
                                                />
                                            ) : null}
                                        </>
                                    ),
                                }}
                            >
                                <ElDescriptions
                                    title={unref(baseInfo).cpuModelName}
                                    column={3}
                                    size="small"
                                    class={'ml-1'}
                                >
                                    <ElDescriptionsItem label={$t('home.core')}>
                                        {unref(baseInfo).cpuCores}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('home.logicCore')}>
                                        {unref(baseInfo).cpuLogicalCores}
                                    </ElDescriptionsItem>
                                    {unref(baseInfo).cpuMhz > 0 ? (
                                        <ElDescriptionsItem label={$t('home.cpuFrequency')}>
                                            {formatNumber(unref(baseInfo).cpuMhz)}
                                            {' MHz '}
                                        </ElDescriptionsItem>
                                    ) : null}
                                </ElDescriptions>
                                <ElButton size="small" link type="primary" class={'mb-2'}>
                                    {$t('home.corePercent')}
                                </ElButton>
                                <ElSpace wrap size={5} class={'ml-1'}>
                                    {(unref(currentInfo).cpuPercent || []).map((item, index) => (
                                        <>
                                            {unref(cpuShowAll) || (!unref(cpuShowAll) && index < 8) ? (
                                                <div class={'cpu-detail'}>
                                                    {' CPU-'}
                                                    {index}
                                                    {': '}
                                                    {formatNumber(item)}
                                                    {'% '}
                                                </div>
                                            ) : null}
                                        </>
                                    ))}
                                </ElSpace>
                                {unref(currentInfo).cpuPercent.length > 8 ? (
                                    <div>
                                        {!unref(cpuShowAll) ? (
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    cpuShowAll.value = true;
                                                }}
                                                icon="More"
                                                link
                                                size="small"
                                            />
                                        ) : null}
                                        {unref(cpuShowAll) ? (
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    cpuShowAll.value = false;
                                                }}
                                                icon="ArrowUp"
                                                link
                                                size="small"
                                            />
                                        ) : null}
                                    </div>
                                ) : null}
                                {unref(currentInfo).cpuDetailedPercent?.length >= 8 ? (
                                    <div class={'mt-2'}>
                                        <ElButton
                                            link
                                            size="small"
                                            type="primary"
                                            onClick={($event?: any) => {
                                                showCpuDetailedPercent.value = !unref(showCpuDetailedPercent);
                                            }}
                                            class={'mb-2'}
                                        >
                                            {$t('home.cpuDetailedPercent')}
                                            {!unref(showCpuDetailedPercent) ? (
                                                <ElIcon>
                                                    <ArrowRight />
                                                </ElIcon>
                                            ) : null}
                                            {unref(showCpuDetailedPercent) ? (
                                                <ElIcon>
                                                    <ArrowDown />
                                                </ElIcon>
                                            ) : null}
                                        </ElButton>
                                        {unref(showCpuDetailedPercent) ? (
                                            <ElSpace wrap size={5} class={'ml-1 mb-2'}>
                                                <div class={'cpu-detail'}>
                                                    {$t('home.cpuUser')}
                                                    {': '}
                                                    {formatNumber(unref(currentInfo).cpuDetailedPercent[0])}
                                                    {'% '}
                                                </div>
                                                <div class={'cpu-detail'}>
                                                    {$t('home.cpuSystem')}
                                                    {': '}
                                                    {formatNumber(unref(currentInfo).cpuDetailedPercent[1])}
                                                    {'% '}
                                                </div>
                                                <div class={'cpu-detail'}>
                                                    {'Nice: '}
                                                    {formatNumber(unref(currentInfo).cpuDetailedPercent[2])}
                                                    {'%'}
                                                </div>
                                                <div class={'cpu-detail'}>
                                                    {$t('home.cpuIdle')}
                                                    {': '}
                                                    {formatNumber(unref(currentInfo).cpuDetailedPercent[3])}
                                                    {'% '}
                                                </div>
                                                <div class={'cpu-detail'}>
                                                    {'I/O: '}
                                                    {formatNumber(unref(currentInfo).cpuDetailedPercent[4])}
                                                    {'%'}
                                                </div>
                                                <div class={'cpu-detail'}>
                                                    {$t('home.cpuIrq')}
                                                    {': '}
                                                    {formatNumber(unref(currentInfo).cpuDetailedPercent[5])}
                                                    {'% '}
                                                </div>
                                                <div class={'cpu-detail'}>
                                                    {$t('home.cpuSoftirq')}
                                                    {': '}
                                                    {formatNumber(unref(currentInfo).cpuDetailedPercent[6])}
                                                    {'% '}
                                                </div>
                                                <div class={'cpu-detail'}>
                                                    {$t('home.cpuSteal')}
                                                    {': '}
                                                    {formatNumber(unref(currentInfo).cpuDetailedPercent[7])}
                                                    {'% '}
                                                </div>
                                            </ElSpace>
                                        ) : null}
                                    </div>
                                ) : null}
                                <ElButton
                                    link
                                    size="small"
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (toggleCpuTop as any)($event);
                                    }}
                                    class={'mt-2 mb-2'}
                                >
                                    {$t('home.cpuTop')}
                                    {!unref(showCpuTop) ? (
                                        <ElIcon>
                                            <ArrowRight />
                                        </ElIcon>
                                    ) : null}
                                    {unref(showCpuTop) ? (
                                        <ElIcon>
                                            <ArrowDown />
                                        </ElIcon>
                                    ) : null}
                                </ElButton>
                                {unref(showCpuTop) ? (
                                    <ComplexTable data={unref(currentInfo).topCPUItems}>
                                        <ElTableColumn
                                            min-width={120}
                                            show-overflow-tooltip
                                            label={$t('menu.process')}
                                            prop="name"
                                        />
                                        <ElTableColumn
                                            min-width={60}
                                            label={$t('monitor.percent')}
                                            prop="percent"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.percent.toFixed(2)}
                                                        {'%'}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            width={80}
                                            label={$t('commons.table.operate')}
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                onKill(row);
                                                            }}
                                                        >
                                                            {$t('process.stopProcess')}
                                                        </ElButton>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </ComplexTable>
                                ) : null}
                            </ElPopover>
                        ) : null}
                        <div class={'text-center'}>
                            <span class={'input-help'}>
                                {' ( '}
                                {formatNumber(unref(currentInfo).cpuUsed)}
                                {' / '}
                                {unref(currentInfo).cpuTotal}
                                {' ) '}
                                {$t('commons.units.core', unref(currentInfo).cpuTotal)}
                            </span>
                        </div>
                    </ElCol>
                ) : null}
                {__panelSetupProps.view === 'system' ? (
                    <ElCol xs={6} sm={6} md={3} lg={3} xl={3} align="center">
                        {unref(chartsOption)['memory'] ? (
                            <ElPopover
                                hide-after={20}
                                teleported={false}
                                width={480}
                                popper-class="dashboard-status-popover"
                                trigger={unref(hasFinePointer) ? 'hover' : 'click'}
                                onHide={($event?: any) => {
                                    (onMemPopoverHide as any)($event);
                                }}
                                v-slots={{
                                    reference: () => (
                                        <>
                                            {unref(chartsOption)['memory'] ? (
                                                <VCharts
                                                    height="160px"
                                                    id="memory"
                                                    type="pie"
                                                    option={unref(chartsOption)['memory']}
                                                />
                                            ) : null}
                                        </>
                                    ),
                                }}
                            >
                                <ElDescriptions
                                    direction="vertical"
                                    title={$t('home.mem')}
                                    column={4}
                                    size="small"
                                    class={'ml-1'}
                                >
                                    <ElDescriptionsItem label-width={60} label={$t('home.total')}>
                                        {computeSize(unref(currentInfo).memoryTotal)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('home.used')}>
                                        {computeSize(unref(currentInfo).memoryUsed)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('home.free')}>
                                        {computeSize(unref(currentInfo).memoryFree)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('home.available')}>
                                        {computeSize(unref(currentInfo).memoryAvailable)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('home.shard')}>
                                        {computeSize(unref(currentInfo).memoryShard)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('home.cache')}>
                                        {computeSize(unref(currentInfo).memoryCache)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('home.percent')}>
                                        {formatNumber(unref(currentInfo).memoryUsedPercent)}
                                        {'% '}
                                    </ElDescriptionsItem>
                                </ElDescriptions>
                                {unref(currentInfo).swapMemoryTotal ? (
                                    <ElDescriptions
                                        direction="vertical"
                                        title={$t('home.swapMem')}
                                        column={4}
                                        size="small"
                                        class={'ml-1'}
                                    >
                                        <ElDescriptionsItem label-width={60} label={$t('home.total')}>
                                            {computeSize(unref(currentInfo).swapMemoryTotal)}
                                        </ElDescriptionsItem>
                                        <ElDescriptionsItem label-width={60} label={$t('home.used')}>
                                            {computeSize(unref(currentInfo).swapMemoryUsed)}
                                        </ElDescriptionsItem>
                                        <ElDescriptionsItem label-width={60} label={$t('home.free')}>
                                            {computeSize(unref(currentInfo).swapMemoryAvailable)}
                                        </ElDescriptionsItem>
                                        <ElDescriptionsItem label-width={60} label={$t('home.percent')}>
                                            {formatNumber(unref(currentInfo).swapMemoryUsedPercent)}
                                            {'% '}
                                        </ElDescriptionsItem>
                                    </ElDescriptions>
                                ) : null}
                                <ElButton
                                    link
                                    size="small"
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (toggleMemTop as any)($event);
                                    }}
                                    class={'float-left mb-2'}
                                >
                                    {$t('home.memTop')}
                                    {!unref(showMemTop) ? (
                                        <ElIcon>
                                            <ArrowRight />
                                        </ElIcon>
                                    ) : null}
                                    {unref(showMemTop) ? (
                                        <ElIcon>
                                            <ArrowDown />
                                        </ElIcon>
                                    ) : null}
                                </ElButton>
                                {unref(showMemTop) ? (
                                    <ComplexTable data={unref(currentInfo).topMemItems}>
                                        <ElTableColumn
                                            min-width={120}
                                            show-overflow-tooltip
                                            label={$t('menu.process')}
                                            prop="name"
                                        />
                                        <ElTableColumn
                                            min-width={100}
                                            label={$t('monitor.memory')}
                                            prop="memory"
                                            v-slots={{ default: ({ row }) => <>{computeSize(row.memory)}</> }}
                                        />
                                        <ElTableColumn
                                            min-width={80}
                                            label={$t('monitor.percent')}
                                            prop="percent"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.percent.toFixed(2)}
                                                        {'%'}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            width={80}
                                            label={$t('commons.table.operate')}
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                onKill(row);
                                                            }}
                                                        >
                                                            {$t('process.stopProcess')}
                                                        </ElButton>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </ComplexTable>
                                ) : null}
                            </ElPopover>
                        ) : null}
                        <span class={'input-help'}>
                            {computeSize(unref(currentInfo).memoryUsed)}
                            {' / '}
                            {computeSize(unref(currentInfo).memoryTotal)}
                        </span>
                    </ElCol>
                ) : null}
                {(unref(currentInfo).diskData || []).map((item, index) => (
                    <>
                        {__panelSetupProps.view === 'system' &&
                        (unref(showMore) || index < (unref(currentInfo).diskData.length > 5 ? 4 : 5)) ? (
                            <ElCol xs={6} sm={6} md={3} lg={3} xl={3} align="center">
                                {unref(chartsOption)[`disk${index}`] ? (
                                    <ElPopover
                                        hide-after={20}
                                        teleported={false}
                                        width={450}
                                        popper-class="dashboard-status-popover"
                                        v-slots={{
                                            reference: () => (
                                                <>
                                                    {unref(chartsOption)[`disk${index}`] ? (
                                                        <VCharts
                                                            onClick={($event?: any) => {
                                                                routerToFileWithPath(item.path);
                                                            }}
                                                            height="160px"
                                                            id={`disk${index}`}
                                                            type="pie"
                                                            option={unref(chartsOption)[`disk${index}`]}
                                                        />
                                                    ) : null}
                                                </>
                                            ),
                                        }}
                                    >
                                        <ElDescriptions column={1} size="small">
                                            <ElDescriptionsItem label={$t('home.mount')}>
                                                {item.path}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('commons.table.type')}>
                                                {item.type}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('home.fileSystem')}>
                                                {item.device}
                                            </ElDescriptionsItem>
                                        </ElDescriptions>
                                        <ElDescriptions title="Inode" direction="vertical" column={4} size="small">
                                            <ElDescriptionsItem label={$t('home.total')}>
                                                {item.inodesTotal}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('home.used')}>
                                                {item.inodesUsed}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('home.free')}>
                                                {item.inodesFree}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('home.percent')}>
                                                {formatNumber(item.inodesUsedPercent)}
                                                {'% '}
                                            </ElDescriptionsItem>
                                        </ElDescriptions>
                                        <ElDescriptions
                                            title={$t('monitor.disk')}
                                            direction="vertical"
                                            column={4}
                                            size="small"
                                        >
                                            <ElDescriptionsItem label={$t('home.total')}>
                                                {computeSize(item.total)}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('home.used')}>
                                                {computeSize(item.used)}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('home.free')}>
                                                {computeSize(item.free)}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('home.percent')}>
                                                {formatNumber(item.usedPercent)}
                                                {'% '}
                                            </ElDescriptionsItem>
                                        </ElDescriptions>
                                    </ElPopover>
                                ) : null}
                                <span class={'input-help'}>
                                    {computeSize(item.used)}
                                    {' / '}
                                    {computeSize(item.total)}
                                </span>
                            </ElCol>
                        ) : null}
                    </>
                ))}
                {__panelSetupProps.view === 'gpu' ? (
                    <GPUStatus
                        current={unref(currentInfo)}
                        onOpen={($event?: any) => {
                            routerToNameWithQuery('GPUHistory', { uncached: 'true' });
                        }}
                    />
                ) : null}
                {__panelSetupProps.view === 'system' && unref(currentInfo).diskData.length > 5 ? (
                    <ElCol xs={6} sm={6} md={3} lg={3} xl={3} align="center">
                        {!unref(showMore) ? (
                            <ElButton
                                link
                                type="primary"
                                onClick={($event?: any) => {
                                    changeShowMore(true);
                                }}
                                class={'buttonClass'}
                            >
                                {$t('tabs.more')}
                                <ElIcon>
                                    <Bottom />
                                </ElIcon>
                            </ElButton>
                        ) : null}
                        {unref(showMore) ? (
                            <ElButton
                                type="primary"
                                link
                                onClick={($event?: any) => {
                                    changeShowMore(false);
                                }}
                                class={'buttonClass'}
                            >
                                {$t('tabs.hide')}
                                <ElIcon>
                                    <Top />
                                </ElIcon>
                            </ElButton>
                        ) : null}
                    </ElCol>
                ) : null}
                <ConfirmDialog
                    ref={confirmConfRef}
                    onConfirm={($event?: any) => {
                        (submitKill as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
