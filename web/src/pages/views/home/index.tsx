import { $t } from '@/utils/i18n-t';
import SystemStatus from '@/pages/views/home/status/index';
import AppLauncher from '@/pages/views/home/app/index';
import VCharts from '@/components/v-charts/index';
import QuickJump from '@/pages/views/home/quick/index';
import QuickDirectories from '@/pages/views/home/quick/directories';
import CardWithHeader from '@/components/card-with-header/index';
import MarkDownEditor from '@/components/mkdown-editor/index';
import i18n from '@/lang';
import { Dashboard } from '@/types/dashboard';
import { dateFormatForSecond, formatUptime } from '@/utils/date';
import { computeSize, computeSizeFromKBs } from '@/utils/size';
import { jumpToPath } from '@/utils/router';
import { copyText } from '@/utils/clipboard';
import { rpc } from '@/lib/rpc';
import { toHomeBaseInfo, toHomeCurrentInfo } from '@/lib/rpc/dashboard';
import { routerToExtensionName, routerToNameWithQuery, routerToPath } from '@/utils/router';
import {
    clearDashboardCache,
    clearDashboardCacheByPrefix,
    getDashboardCache,
    setDashboardCache,
} from '@/utils/dashboardCache';
import { MsgSuccess } from '@/utils/message';
import { useCan } from '@/composables/useMenuManagePermission';
import { readPages } from '@/utils/pagination';
import { loadExtensionComponent } from '@/extensions/optional';
import type { ReqPage, ResPage, ResultData } from '@/types';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface VllmDeployment {
    id: number;
    alias: string;
    source?: 'local' | 'external';
    name: string;
    servedModelName: string;
    status: string;
}
interface VllmSnapshot {
    appInstallID: number;
    isExternal: boolean;
    vllmID: number;
    createdAt: string;
    status: string;
    intervalSeconds: number;
    promptThroughput: number | null;
    generationThroughput: number | null;
    running: number | null;
    waiting: number | null;
    metrics?: Record<string, Record<string, number>>;
}
import './index.styles.css';
import { cn } from '@/utils/cn';
import RouterButton from '@/components/router-button/index';
import Status from '@/components/status/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'home',
    props: {},
    emits: emits,
    __scopeId: 'data-v-0ac78091',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const __vueRoute = useRoute();
        const router = useRouter();
        const {
            showEntranceWarn,
            defaultNetwork,
            defaultIO,
            isAdmin,
            isOnRestart,
            hasNewVersion,
            isAdminOrNodeAdmin,
            isXpackOrEE,
            isProductPro,
            isEnterprise,
            currentNode,
        } = useGlobalStore();
        const vllmModules = import.meta.glob<{
            pageVllm: (req: ReqPage & { info: string }) => Promise<ResultData<ResPage<VllmDeployment>>>;
            loadVllmCurrent: (id: number, signal: AbortSignal) => Promise<ResultData<VllmSnapshot>>;
        }>('@/xpack/api/modules/vllm.ts', { eager: true });
        const vllmMetricsModules = import.meta.glob<{
            calculateCurrentMetrics: (snapshot: VllmSnapshot, previous?: VllmSnapshot) => VllmSnapshot;
        }>('@/xpack/views/vllm/monitor/current.ts', { eager: true });
        const vllmAPI = Object.values(vllmModules)[0];
        const vllmMetrics = Object.values(vllmMetricsModules)[0];
        const VllmMonitor = defineAsyncComponent(() => loadExtensionComponent('/vllm/monitor/index'));
        const vllmMonitorRef = ref();
        const canViewVllm = useCan('ai_model_view');
        const vllmOptions = ref<VllmDeployment[]>([]);
        const vllmID = ref<number>();
        const vllmCurrent = ref<VllmSnapshot>();
        const vllmLoadFailed = ref(false);
        const vllmPoints = ref<Array<{ time: string; prompt: number | null; generation: number | null }>>([]);
        let vllmTimer: ReturnType<typeof setTimeout>;
        let vllmController: AbortController;
        let vllmOptionsVersion = 0;
        const hasVllm = computed(() => isProductPro.value && canViewVllm.value && vllmOptions.value.length > 0);
        const selectedVllm = computed(() => vllmOptions.value.find((item) => item.id === vllmID.value));
        const formatVllmMetric = (value?: number | null) =>
            value == null || !Number.isFinite(value) ? '--' : Number(value.toFixed(2)).toString();
        const vllmMonitorMessage = computed(() => {
            if (!selectedVllm.value) return i18n.global.t('aiTools.model.readinessNotRunning');
            if (vllmLoadFailed.value) return i18n.global.t('aiTools.vllmMonitor.loadFailed');
            if (vllmCurrent.value?.status === 'unavailable') return i18n.global.t('aiTools.vllmMonitor.unavailable');
            if (vllmCurrent.value?.status === 'no_data') return i18n.global.t('aiTools.vllmMonitor.noMetrics');
            if (!vllmCurrent.value?.intervalSeconds) return i18n.global.t('commons.table.statusWaiting');
            return `${i18n.global.t('aiTools.vllmMonitor.sampleWindow')}: ${formatVllmMetric(vllmCurrent.value.intervalSeconds)} s`;
        });
        const vllmChartOption = computed(() => ({
            xData: loadMonitorChartTime(vllmPoints.value.map((point) => point.time)),
            yData: [
                {
                    name: i18n.global.t('aiTools.vllmMonitor.promptThroughput'),
                    data: loadMonitorChartData(vllmPoints.value.map((point) => point.prompt)),
                },
                {
                    name: i18n.global.t('aiTools.vllmMonitor.generationThroughput'),
                    data: loadMonitorChartData(vllmPoints.value.map((point) => point.generation)),
                },
            ],
            grid: monitorChartGrid,
            legend: monitorChartLegend,
            formatStr: 'tokens/s',
            yAxis: [
                {
                    type: 'value',
                    name: '( tokens/s )',
                    min: 0,
                    max: ({ max }: { max: number }) => (max > 0 ? undefined : 1),
                },
            ],
            tooltip: {
                trigger: 'axis',
                valueFormatter: (value: number | null) => `${formatVllmMetric(value)} tokens/s`,
            },
        }));
        const loadVllmOptions = async () => {
            if (!isProductPro.value || !canViewVllm.value || !vllmAPI || !vllmMetrics) return;
            const version = ++vllmOptionsVersion;
            const node = currentNode.value;
            try {
                const items = await readPages((page) => {
                    if (version !== vllmOptionsVersion || node !== currentNode.value) throw new Error('node changed');
                    return vllmAPI.pageVllm({ ...page, info: '' });
                });
                if (version !== vllmOptionsVersion || node !== currentNode.value) return;
                vllmOptions.value = items;
                if (
                    !items.some(
                        (item) => item.id === vllmID.value && (item.source === 'external' || item.status === 'Running'),
                    )
                ) {
                    vllmID.value = items.find((item) => item.source === 'external' || item.status === 'Running')?.id;
                }
                if (!items.length && chartOption.value === 'vllm') chartOption.value = 'network';
            } catch {
                if (version === vllmOptionsVersion) vllmLoadFailed.value = true;
            }
        };
        const stopVllmMonitor = (resetData = true) => {
            clearTimeout(vllmTimer);
            vllmController?.abort();
            if (resetData) {
                vllmCurrent.value = undefined;
                vllmPoints.value = [];
                vllmLoadFailed.value = false;
            }
        };
        const refreshVllmMonitor = async () => {
            const controller = new AbortController();
            vllmController = controller;
            try {
                const { data } = await vllmAPI.loadVllmCurrent(vllmID.value, controller.signal);
                if (controller.signal.aborted) return;
                const wasUnavailable = vllmCurrent.value?.status === 'unavailable';
                vllmCurrent.value = vllmMetrics.calculateCurrentMetrics(data, vllmCurrent.value);
                vllmLoadFailed.value = false;
                vllmPoints.value.push({
                    time: dateFormatForSecond(new Date(data.createdAt)),
                    prompt: vllmCurrent.value.promptThroughput,
                    generation: vllmCurrent.value.generationThroughput,
                });
                if (data.status === 'unavailable' && !wasUnavailable) void loadVllmOptions();
            } catch {
                if (controller.signal.aborted) return;
                vllmCurrent.value = undefined;
                vllmLoadFailed.value = true;
                vllmPoints.value.push({ time: dateFormatForSecond(new Date()), prompt: null, generation: null });
            } finally {
                if (!controller.signal.aborted) {
                    vllmPoints.value = vllmPoints.value.slice(-20);
                    vllmTimer = setTimeout(refreshVllmMonitor, 3000);
                }
            }
        };
        const DASHBOARD_CACHE_TTL = {
            safeStatus: 10 * 60 * 1000,
            netOptions: 60 * 60 * 1000,
            ioOptions: 60 * 60 * 1000,
        };
        const monitorChartGrid = { left: 65, right: 65, bottom: '20%' };
        const monitorChartLegend = { top: 0, bottom: 'auto' };
        const monitorTagsStyle = {
            left: `${monitorChartGrid.left}px`,
            right: `${monitorChartGrid.right}px`,
        };
        const monitorChartEmptyLength = 20;
        const loadMonitorEmptyData = () => Array.from({ length: monitorChartEmptyLength }, () => null);
        const loadMonitorEmptyTime = () => Array.from({ length: monitorChartEmptyLength }, () => '');
        const loadMonitorChartData = (data: Array<number | null>) =>
            data.length === 0 ? loadMonitorEmptyData() : data;
        const loadMonitorChartTime = (data: Array<string>) => (data.length === 0 ? loadMonitorEmptyTime() : data);
        const loadIOChartOption = () => ({
            xData: loadMonitorChartTime(timeIODatas.value),
            yData: [
                {
                    name: i18n.global.t('monitor.read'),
                    data: loadMonitorChartData(ioReadBytes.value),
                },
                {
                    name: i18n.global.t('monitor.write'),
                    data: loadMonitorChartData(ioWriteBytes.value),
                },
            ],
            grid: monitorChartGrid,
            legend: monitorChartLegend,
            formatStr: 'MB',
        });
        const loadNetworkChartOption = () => ({
            xData: loadMonitorChartTime(timeNetDatas.value),
            yData: [
                {
                    name: i18n.global.t('monitor.up'),
                    data: loadMonitorChartData(netBytesSents.value),
                },
                {
                    name: i18n.global.t('monitor.down'),
                    data: loadMonitorChartData(netBytesRecvs.value),
                },
            ],
            grid: monitorChartGrid,
            legend: monitorChartLegend,
            formatStr: 'KB/s',
        });
        const statusRef = ref();
        const appRef = ref();
        const isSafety = ref();
        const chartOption = ref('network');
        const statusOption = ref(localStorage.getItem('dashboard_status_view') === 'gpu' ? 'gpu' : 'system');
        let timer: ReturnType<typeof setInterval> | null = null;
        let initialSampleTimer: ReturnType<typeof setTimeout> | null = null;
        let isInit = ref<boolean>(true);
        let isStatusInit = ref<boolean>(true);
        let isActive = ref(true);
        let isCurrentActive = ref(true);
        const showSensitiveInfo = ref(true);
        const ioReadBytes = ref<Array<number>>([]);
        const ioWriteBytes = ref<Array<number>>([]);
        const netBytesSents = ref<Array<number>>([]);
        const netBytesRecvs = ref<Array<number>>([]);
        const timeIODatas = ref<Array<string>>([]);
        const timeNetDatas = ref<Array<string>>([]);
        const simpleNodes = ref([]);
        const ioOptions = ref();
        const netOptions = ref();
        const netOptionsFromCache = ref(false);
        const ioOptionsFromCache = ref(false);
        const hasRefreshedOptionsOnHover = ref(false);
        const quickJumpRef = ref();
        const quickJumpPermissionMap = Object.fromEntries(
            [
                ['Agent', 'ai_agent_view'],
                ['Website', 'website_view'],
                ['Database', 'database_view'],
                ['Cronjob', 'cronjob_view'],
                ['AppInstalled', 'app_view'],
                ['File', 'host_file_view'],
                ['ModelServices', 'ai_model_view'],
            ].map(([name, permission]) => [name, useCan(permission)]),
        ) as Record<string, ReturnType<typeof useCan>>;
        const checkPermission = (item: string) => {
            return quickJumpPermissionMap[item]?.value ?? true;
        };
        const searchInfo = reactive({
            ioOption: 'all',
            netOption: 'all',
        });
        const memoContent = ref('');
        const memoEditContent = ref('');
        const memoEditing = ref(false);
        const memoSaving = ref(false);
        const memoCarouselSetting = ref();
        const simpleNodeCarouselSetting = ref();
        const carouselSettingReady = ref(false);
        const showMemoCarousel = computed(() => memoCarouselSetting.value === 'Enable');
        const carouselItemCount = computed(() => {
            let count = 1;
            if (showMemoCarousel.value) count += 1;
            if (showSimpleNode()) count += 1;
            return count;
        });
        const baseInfo = ref<Dashboard.BaseInfo>({
            hostname: '',
            os: '',
            platform: '',
            platformFamily: '',
            platformVersion: '',
            prettyDistro: '',
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
            memoryUsed: 0,
            memoryFree: 0,
            memoryShard: 0,
            memoryCache: 0,
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

            netBytesSent: 0,
            netBytesRecv: 0,

            topCPUItems: [],
            topMemItems: [],

            shotTime: new Date(),
        });
        const hasGPU = computed(() =>
            [currentInfo.value.gpuData, currentInfo.value.npuData, currentInfo.value.xpuData].some(
                (items) => items?.length,
            ),
        );
        const statusView = computed({
            get: () => (hasGPU.value && statusOption.value === 'gpu' ? 'gpu' : 'system'),
            set: (value: 'system' | 'gpu') => {
                statusOption.value = value;
                localStorage.setItem('dashboard_status_view', value);
            },
        });
        const currentChartInfo = reactive({
            ioReadBytes: 0,
            ioWriteBytes: 0,
            ioCount: 0,
            ioTime: 0,

            netBytesSent: 0,
            netBytesRecv: 0,
        });
        const skipNextCurrentInfoDelta = ref(false);
        const chartsOption = ref({
            ioChart: loadIOChartOption(),
            networkChart: loadNetworkChartOption(),
        });
        const updateCurrentInfo = (data: Dashboard.CurrentInfo) => {
            currentInfo.value = {
                ...data,
                topCPUItems: currentInfo.value.topCPUItems || [],
                topMemItems: currentInfo.value.topMemItems || [],
            };
        };
        const changeOption = async () => {
            isInit.value = true;
            if (chartOption.value === 'vllm') void loadVllmOptions();
            loadData();
        };
        const applyDefaultNetOption = () => {
            if (!netOptions.value || netOptions.value.length === 0) return;
            const defaultNet = defaultNetwork.value || netOptions.value[0];
            if (defaultNet && searchInfo.netOption !== defaultNet) {
                searchInfo.netOption = defaultNet;
            }
        };
        const onLoadAgentSettingInfo = async () => {
            await rpc.agentSetting.getInfo({}).then((res) => {
                defaultIO.value = res.defaultIo;
                defaultNetwork.value = res.defaultNetwork;
            });
        };
        const onLoadNetworkOptions = async (force?: boolean) => {
            const cache = force ? null : getDashboardCache('netOptions');
            if (cache !== null) {
                netOptions.value = cache;
                netOptionsFromCache.value = true;
                applyDefaultNetOption();
                return;
            }
            const res = await rpc.monitor.listNetworkOptions({});
            netOptions.value = res.items;
            netOptionsFromCache.value = false;
            setDashboardCache('netOptions', res.items, DASHBOARD_CACHE_TTL.netOptions);
            applyDefaultNetOption();
        };
        const onLoadSimpleNode = async () => {
            if (!isAdmin.value) {
                simpleNodes.value = [];
                return;
            }
            // 多节点是 xpack 能力，单进程下没有远端节点可展示。
            simpleNodes.value = [];
        };
        const applyDefaultIOOption = async () => {
            if (!ioOptions.value || ioOptions.value.length === 0) return;
            const defaultIOOption = defaultIO.value || ioOptions.value[0];
            if (defaultIOOption && searchInfo.ioOption !== defaultIOOption) {
                searchInfo.ioOption = defaultIOOption;
            }
        };
        const onLoadIOOptions = async (force?: boolean) => {
            const cache = force ? null : getDashboardCache('ioOptions');
            if (cache !== null) {
                ioOptions.value = cache;
                ioOptionsFromCache.value = true;
                applyDefaultIOOption();
                return;
            }
            const res = await rpc.monitor.listIOOptions({});
            ioOptions.value = res.items;
            ioOptionsFromCache.value = false;
            setDashboardCache('ioOptions', ioOptions.value, DASHBOARD_CACHE_TTL.ioOptions);
            applyDefaultIOOption();
        };
        const onLoadBaseInfo = async (isInit: boolean, range: string) => {
            let resetChartData = false;
            if (range === 'all' || range === 'io') {
                ioReadBytes.value = [];
                ioWriteBytes.value = [];
                timeIODatas.value = [];
                resetChartData = true;
            }
            if (range === 'all' || range === 'network') {
                netBytesSents.value = [];
                netBytesRecvs.value = [];
                timeNetDatas.value = [];
                resetChartData = true;
            }
            if (resetChartData) {
                loadData();
            }
            const res = await rpc.dashboard.baseInfo({
                ioOption: searchInfo.ioOption,
                netOption: searchInfo.netOption,
            });
            baseInfo.value = toHomeBaseInfo(res);
            updateCurrentInfo(baseInfo.value.currentInfo);
            skipNextCurrentInfoDelta.value = !isInit;
            if (!isInit) {
                onLoadCurrentInfo();
            }
            isStatusInit.value = false;
            statusRef.value?.acceptParams(currentInfo.value, baseInfo.value);
            appRef.value?.acceptParams();
            if (isInit && isCurrentActive.value) {
                clearTimer();
                const refreshCurrentInfo = async () => {
                    try {
                        if (!isCurrentActive.value) {
                            throw new Error('jump out');
                        }
                        if (isActive.value && !isOnRestart.value) {
                            await onLoadCurrentInfo();
                            await onLoadSimpleNode();
                        }
                    } catch {
                        clearTimer();
                    }
                };
                initialSampleTimer = setTimeout(refreshCurrentInfo, 500);
                timer = setInterval(refreshCurrentInfo, 3000);
            }
        };
        const updateQuickDirectoryCount = (count: number) => {
            const item = baseInfo.value.quickJump.find((item) => item.name === 'File');
            if (item) item.detail = String(count);
        };
        const quickJump = (item: any) => {
            return routerToPath(item.router);
        };
        const showSimpleNode = () => {
            return simpleNodeCarouselSetting.value === 'Enable' && isXpackOrEE.value && simpleNodes.value?.length !== 0;
        };
        const toggleSensitiveInfo = () => {
            showSensitiveInfo.value = !showSensitiveInfo.value;
        };
        const refreshDashboard = async () => {
            clearDashboardCache();
            onLoadBaseInfo(false, '');
            hasRefreshedOptionsOnHover.value = false;
            await Promise.allSettled([
                onLoadNetworkOptions(true),
                onLoadIOOptions(true),
                loadSettingInfo(),
                loadVllmOptions(),
            ]);
            MsgSuccess(i18n.global.t('commons.msg.refreshSuccess'));
        };
        const jumpPanel = (row: any) => {
            let entrance = row.securityEntrance.startsWith('/') ? row.securityEntrance.slice(1) : row.securityEntrance;
            entrance = entrance ? '/' + entrance : '';
            let addr = row.addr.endsWith('/') ? row.addr.slice(0, -1) : row.addr;
            window.open(addr + entrance, '_blank', 'noopener,noreferrer');
        };
        const onLoadCurrentInfo = async () => {
            const res = toHomeCurrentInfo(
                await rpc.dashboard.currentInfo({
                    ioOption: searchInfo.ioOption,
                    netOption: searchInfo.netOption,
                }),
            );
            const timeInterval =
                (new Date(res.shotTime).getTime() - new Date(currentInfo.value.shotTime).getTime()) / 1000;
            if (skipNextCurrentInfoDelta.value || !Number.isFinite(timeInterval) || timeInterval <= 0) {
                skipNextCurrentInfoDelta.value = false;
                currentChartInfo.netBytesSent = 0;
                currentChartInfo.netBytesRecv = 0;
                currentChartInfo.ioReadBytes = 0;
                currentChartInfo.ioWriteBytes = 0;
                currentChartInfo.ioCount = 0;
                currentChartInfo.ioTime = 0;
                updateCurrentInfo(res);
                statusRef.value?.acceptParams(currentInfo.value, baseInfo.value);
                return;
            }

            currentInfo.value.timeSinceUptime = res.timeSinceUptime;
            currentInfo.value.runningTime = res.runningTime;

            currentChartInfo.netBytesSent =
                res.netBytesSent - currentInfo.value.netBytesSent > 0
                    ? Number(((res.netBytesSent - currentInfo.value.netBytesSent) / 1024 / timeInterval).toFixed(2))
                    : 0;
            netBytesSents.value.push(currentChartInfo.netBytesSent);
            if (netBytesSents.value.length > 20) {
                netBytesSents.value.splice(0, 1);
            }

            currentChartInfo.netBytesRecv =
                res.netBytesRecv - currentInfo.value.netBytesRecv > 0
                    ? Number(((res.netBytesRecv - currentInfo.value.netBytesRecv) / 1024 / timeInterval).toFixed(2))
                    : 0;
            netBytesRecvs.value.push(currentChartInfo.netBytesRecv);
            if (netBytesRecvs.value.length > 20) {
                netBytesRecvs.value.splice(0, 1);
            }

            currentChartInfo.ioReadBytes =
                res.ioReadBytes - currentInfo.value.ioReadBytes > 0
                    ? Number(
                          ((res.ioReadBytes - currentInfo.value.ioReadBytes) / 1024 / 1024 / timeInterval).toFixed(2),
                      )
                    : 0;
            ioReadBytes.value.push(currentChartInfo.ioReadBytes);
            if (ioReadBytes.value.length > 20) {
                ioReadBytes.value.splice(0, 1);
            }

            currentChartInfo.ioWriteBytes =
                res.ioWriteBytes - currentInfo.value.ioWriteBytes > 0
                    ? Number(
                          ((res.ioWriteBytes - currentInfo.value.ioWriteBytes) / 1024 / 1024 / timeInterval).toFixed(2),
                      )
                    : 0;
            ioWriteBytes.value.push(currentChartInfo.ioWriteBytes);
            if (ioWriteBytes.value.length > 20) {
                ioWriteBytes.value.splice(0, 1);
            }
            currentChartInfo.ioCount = Math.round(Number((res.ioCount - currentInfo.value.ioCount) / timeInterval));
            let ioReadTime = res.ioReadTime - currentInfo.value.ioReadTime;
            let ioWriteTime = res.ioWriteTime - currentInfo.value.ioWriteTime;
            let ioChoose = ioReadTime > ioWriteTime ? ioReadTime : ioWriteTime;
            currentChartInfo.ioTime = Math.round(Number(ioChoose / timeInterval));

            timeIODatas.value.push(dateFormatForSecond(res.shotTime));
            if (timeIODatas.value.length > 20) {
                timeIODatas.value.splice(0, 1);
            }
            timeNetDatas.value.push(dateFormatForSecond(res.shotTime));
            if (timeNetDatas.value.length > 20) {
                timeNetDatas.value.splice(0, 1);
            }
            loadData();
            updateCurrentInfo(res);
            statusRef.value?.acceptParams(currentInfo.value, baseInfo.value);
        };
        const handleCopy = () => {
            let content =
                i18n.global.t('home.hostname') +
                ': ' +
                baseInfo.value.hostname +
                '\n' +
                i18n.global.t('home.platformVersion') +
                ': ' +
                (baseInfo.value.prettyDistro
                    ? baseInfo.value.prettyDistro
                    : baseInfo.value.platformVersion
                      ? baseInfo.value.platform + '-' + baseInfo.value.platformVersion
                      : baseInfo.value.platform) +
                '\n' +
                i18n.global.t('home.kernelVersion') +
                ': ' +
                baseInfo.value.kernelVersion +
                '\n' +
                i18n.global.t('home.kernelArch') +
                ': ' +
                baseInfo.value.kernelArch +
                '\n' +
                i18n.global.t('home.ip') +
                ': ' +
                baseInfo.value.ipV4Addr +
                '\n' +
                i18n.global.t('home.uptime') +
                ': ' +
                currentInfo.value.timeSinceUptime +
                '\n' +
                i18n.global.t('home.runningTime') +
                ': ' +
                formatUptime(currentInfo.value.runningTime) +
                '\n';
            copyText(content);
        };
        const loadMemo = async () => {
            try {
                const res = await rpc.core.setting.getMemo({});
                memoContent.value = res.content || '';
            } catch (error) {
                memoContent.value = '';
            }
        };
        const updateDashboardCarouselSetting = async (key: string, value: 'Enable' | 'Disable') => {
            if (!carouselSettingReady.value) {
                return;
            }
            let target;
            if (key === 'DashboardMemoVisible') {
                target = memoCarouselSetting.value;
                clearDashboardCacheByPrefix(['memoCarouselSetting']);
            } else {
                target = simpleNodeCarouselSetting.value;
                clearDashboardCacheByPrefix(['simpleNodeCarouselSetting']);
            }
            const previous = value === 'Enable' ? 'Disable' : 'Enable';
            try {
                await rpc.core.setting.updateSetting({ key, value });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } catch (error) {
                target.value = previous;
            }
        };
        const startMemoEdit = () => {
            memoEditContent.value = memoContent.value;
            memoEditing.value = true;
        };
        const cancelMemoEdit = () => {
            memoEditing.value = false;
            memoEditContent.value = '';
        };
        const saveMemo = async () => {
            memoSaving.value = true;
            try {
                await rpc.core.setting.updateMemo({ content: memoEditContent.value });
                memoContent.value = memoEditContent.value;
                memoEditing.value = false;
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } finally {
                memoSaving.value = false;
            }
        };
        const loadData = async () => {
            if (chartOption.value === 'io') {
                chartsOption.value['ioChart'] = loadIOChartOption();
            } else if (chartOption.value === 'network') {
                chartsOption.value['networkChart'] = loadNetworkChartOption();
            }
        };
        const hideEntrance = () => {
            showEntranceWarn.value = false;
        };
        const loadUpgradeStatus = async () => {
            if (!isAdmin.value || isEnterprise.value) {
                return;
            }
            const res = await rpc.core.setting.getUpgradeInfo({});
            if (res && (res.testVersion || res.newVersion || res.latestVersion)) {
                hasNewVersion.value = true;
            } else {
                hasNewVersion.value = false;
            }
        };
        const loadSettingInfo = async () => {
            const safeCache = getDashboardCache('safeStatus');
            const memoCache = getDashboardCache('memoCarouselSetting');
            const simpleNodeCache = getDashboardCache('simpleNodeCarouselSetting');
            if (safeCache === null || memoCache === null || simpleNodeCache === null) {
                const res = await rpc.core.setting.getBaseInfo({});
                isSafety.value = res.securityEntrance;
                memoCarouselSetting.value = res.dashboardMemoVisible;
                simpleNodeCarouselSetting.value = res.dashboardSimpleNodeVisible;
                setDashboardCache('safeStatus', isSafety.value, DASHBOARD_CACHE_TTL.safeStatus);
                setDashboardCache('memoCarouselSetting', memoCarouselSetting.value, DASHBOARD_CACHE_TTL.safeStatus);
                setDashboardCache(
                    'simpleNodeCarouselSetting',
                    simpleNodeCarouselSetting.value,
                    DASHBOARD_CACHE_TTL.safeStatus,
                );
                if (!carouselSettingReady.value) {
                    await nextTick();
                    carouselSettingReady.value = true;
                }
                return;
            }
            isSafety.value = safeCache;
            memoCarouselSetting.value = memoCache;
            simpleNodeCarouselSetting.value = simpleNodeCache;
            if (!carouselSettingReady.value) {
                await nextTick();
                carouselSettingReady.value = true;
            }
        };
        const loadSource = (row: any) => {
            if (row.status !== 'Healthy') {
                return `- ${i18n.global.t('commons.units.core')} (-%) / - GB (-%)`;
            }
            return (
                row.cpuTotal +
                ' ' +
                i18n.global.t('commons.units.core') +
                ' (' +
                row.cpuUsedPercent?.toFixed(2) +
                '%) / ' +
                computeSize(row.memoryTotal) +
                ' (' +
                row.memoryUsedPercent?.toFixed(2) +
                '%)'
            );
        };
        const onFocus = () => {
            isActive.value = true;
            skipNextCurrentInfoDelta.value = true;
            void loadVllmOptions();
        };
        const onBlur = () => {
            isActive.value = false;
        };
        const refreshOptionsOnHover = async () => {
            void loadVllmOptions();
            if (hasRefreshedOptionsOnHover.value) return;
            if (!netOptionsFromCache.value && !ioOptionsFromCache.value) return;
            hasRefreshedOptionsOnHover.value = true;
            if (netOptionsFromCache.value) {
                await onLoadNetworkOptions(true);
            }
            if (ioOptionsFromCache.value) {
                await onLoadIOOptions(true);
            }
        };
        const scheduleDeferredFetch = () => {
            setTimeout(() => {
                onLoadSimpleNode();
                onLoadNetworkOptions();
                onLoadIOOptions();
            }, 600);
        };
        const fetchData = async () => {
            window.addEventListener('focus', onFocus);
            window.addEventListener('blur', onBlur);
            hasRefreshedOptionsOnHover.value = false;
            loadSettingInfo();
            onLoadAgentSettingInfo();
            onLoadBaseInfo(true, 'all');
            scheduleDeferredFetch();
            setTimeout(() => {
                loadUpgradeStatus();
            }, 2000);
        };
        onBeforeRouteUpdate((to, from, next) => {
            if (to.name === 'home') {
                clearTimer();
                fetchData();
            }
            next();
        });
        const clearTimer = () => {
            clearInterval(Number(timer));
            timer = null;
            clearTimeout(Number(initialSampleTimer));
            initialSampleTimer = null;
        };
        onMounted(() => {
            fetchData();
            loadMemo();
        });
        watch(
            [currentNode, isProductPro, canViewVllm],
            () => {
                vllmOptionsVersion++;
                stopVllmMonitor();
                vllmOptions.value = [];
                vllmID.value = undefined;
                if (chartOption.value === 'vllm') chartOption.value = 'network';
                void loadVllmOptions();
            },
            { immediate: true, flush: 'sync' },
        );
        watch([chartOption, vllmID, isActive], ([, instanceID], [, previousInstanceID]) => {
            stopVllmMonitor(instanceID !== previousInstanceID);
            if (chartOption.value === 'vllm' && hasVllm.value && vllmID.value && isActive.value) {
                void refreshVllmMonitor();
            }
        });
        onBeforeUnmount(() => {
            vllmOptionsVersion++;
            stopVllmMonitor();
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
            isCurrentActive.value = false;
            clearTimer();
        });
        return () => (
            <div id="dashboard" key={__vueRoute.fullPath}>
                <RouterButton
                    show-expires-at
                    buttons={[
                        {
                            label: i18n.global.t('menu.home'),
                            path: '/',
                        },
                    ]}
                />
                {!unref(isSafety) && unref(showEntranceWarn) ? (
                    <ElAlert
                        type="warning"
                        onClose={($event?: any) => {
                            (hideEntrance as any)($event);
                        }}
                        class={'card-interval dashboard-entrance-alert'}
                        v-slots={{
                            title: () => (
                                <>
                                    <span class={'flx-align-center dashboard-entrance-alert-title'}>
                                        <span>{$t('home.entranceHelper')}</span>
                                        {unref(isAdmin) ? (
                                            <ElLink
                                                icon="Position"
                                                onClick={($event?: any) => {
                                                    jumpToPath(unref(router), '/settings/safe');
                                                }}
                                                type="primary"
                                                class={'dashboard-entrance-alert-link'}
                                            >
                                                {$t('firewall.quickJump')}
                                            </ElLink>
                                        ) : null}
                                    </span>
                                </>
                            ),
                        }}
                    />
                ) : null}
                <ElRow gutter={7} class={'card-interval'}>
                    <ElCol xs={24} sm={24} md={16} lg={16} xl={16}>
                        <CardWithHeader
                            header={$t('menu.home')}
                            height="166px"
                            v-slots={{
                                'header-r': () => (
                                    <>
                                        <ElButton
                                            disabled={!unref(isAdminOrNodeAdmin)}
                                            onClick={($event?: any) => {
                                                unref(quickJumpRef).acceptParams();
                                            }}
                                            link
                                            icon="Setting"
                                            class={'h-button-setting'}
                                        />
                                    </>
                                ),
                                body: () => (
                                    <>
                                        <div class={'h-overview'}>
                                            <ElRow>
                                                {(unref(baseInfo).quickJump || []).map((item) => (
                                                    <ElCol class={'overview-item'} key={item.name}>
                                                        <span>{$t(item.title, 2)}</span>
                                                        <div class={'count'}>
                                                            {item.name === 'File' ? (
                                                                <QuickDirectories
                                                                    count={item.detail}
                                                                    disabled={!checkPermission('File')}
                                                                    onChange={($event?: any) => {
                                                                        (updateQuickDirectoryCount as any)($event);
                                                                    }}
                                                                />
                                                            ) : (
                                                                <ElButton
                                                                    link
                                                                    disabled={!checkPermission(item.name)}
                                                                    type="primary"
                                                                    onClick={($event?: any) => {
                                                                        quickJump(item);
                                                                    }}
                                                                >
                                                                    {item.detail}
                                                                </ElButton>
                                                            )}
                                                        </div>
                                                    </ElCol>
                                                ))}
                                            </ElRow>
                                        </div>
                                    </>
                                ),
                            }}
                        />
                        <CardWithHeader
                            header={$t('commons.table.status')}
                            class={'card-interval'}
                            v-slots={{
                                'header-r': () => (
                                    <>
                                        {unref(hasGPU) ? (
                                            <ElRadioGroup
                                                modelValue={unref(statusView)}
                                                onUpdate:modelValue={($v) => {
                                                    statusView.value = $v as any;
                                                }}
                                            >
                                                <ElRadioButton value="system">{$t('menu.system')}</ElRadioButton>
                                                <ElRadioButton value="gpu">{'GPU'}</ElRadioButton>
                                            </ElRadioGroup>
                                        ) : null}
                                    </>
                                ),
                                body: () => (
                                    <>
                                        <SystemStatus
                                            ref={statusRef}
                                            view={unref(statusView)}
                                            style={{ marginBottom: unref(statusView) === 'gpu' ? '0' : '33px' }}
                                        />
                                    </>
                                ),
                            }}
                        />
                        <CardWithHeader
                            header={$t('menu.monitor')}
                            onMouseenter={($event?: any) => {
                                (refreshOptionsOnHover as any)($event);
                            }}
                            class={'card-interval chart-card'}
                            v-slots={{
                                'header-r': () => (
                                    <>
                                        <ElRadioGroup
                                            modelValue={unref(chartOption)}
                                            onUpdate:modelValue={($v) => {
                                                chartOption.value = $v as any;
                                            }}
                                            onChange={($event?: any) => {
                                                (changeOption as any)($event);
                                            }}
                                            style={'float: right; margin-left: 5px'}
                                        >
                                            <ElRadioButton value="network">{$t('home.network')}</ElRadioButton>
                                            <ElRadioButton value="io">{$t('home.io')}</ElRadioButton>
                                            {unref(hasVllm) ? (
                                                <ElRadioButton value="vllm">
                                                    {$t('aiTools.vllmMonitor.tokenThroughput')}
                                                </ElRadioButton>
                                            ) : null}
                                        </ElRadioGroup>
                                        {unref(chartOption) === 'network' ? (
                                            <ElSelect
                                                onChange={($event?: any) => {
                                                    onLoadBaseInfo(false, 'network');
                                                }}
                                                modelValue={searchInfo.netOption}
                                                onUpdate:modelValue={($v) => {
                                                    searchInfo.netOption = $v as any;
                                                }}
                                                class={'p-w-200 float-right'}
                                                v-slots={{ prefix: () => <>{$t('home.networkCard')}</> }}
                                            >
                                                {(unref(netOptions) || []).map((item) => (
                                                    <ElOption
                                                        label={item == 'all' ? $t('commons.table.all') : item}
                                                        value={item}
                                                        key={item}
                                                    />
                                                ))}
                                            </ElSelect>
                                        ) : null}
                                        {unref(chartOption) === 'io' ? (
                                            <ElSelect
                                                modelValue={searchInfo.ioOption}
                                                onUpdate:modelValue={($v) => {
                                                    searchInfo.ioOption = $v as any;
                                                }}
                                                onChange={($event?: any) => {
                                                    onLoadBaseInfo(false, 'io');
                                                }}
                                                class={'p-w-200 float-right'}
                                                v-slots={{ prefix: () => <>{$t('home.disk')}</> }}
                                            >
                                                {(unref(ioOptions) || []).map((item) => (
                                                    <ElOption
                                                        label={item == 'all' ? $t('commons.table.all') : item}
                                                        value={item}
                                                        key={item}
                                                    />
                                                ))}
                                            </ElSelect>
                                        ) : null}
                                        {unref(chartOption) === 'vllm' ? (
                                            <ElSelect
                                                modelValue={unref(vllmID)}
                                                onUpdate:modelValue={($v) => {
                                                    vllmID.value = $v as any;
                                                }}
                                                placeholder={$t('aiTools.model.deployments')}
                                                onVisibleChange={($event?: any) => {
                                                    (visible) => visible && loadVllmOptions();
                                                }}
                                                class={'p-w-200 float-right'}
                                            >
                                                {(unref(vllmOptions) || []).map((item) => (
                                                    <ElOption
                                                        label={
                                                            (item.alias || item.name) +
                                                            (item.servedModelName ? ' · ' + item.servedModelName : '')
                                                        }
                                                        value={item.id}
                                                        disabled={
                                                            item.source !== 'external' && item.status !== 'Running'
                                                        }
                                                        key={item.id}
                                                    >
                                                        <span>
                                                            {item.alias || item.name}
                                                            {item.servedModelName ? ' · ' + item.servedModelName : ''}
                                                        </span>
                                                        <Status status={item.status} class={'ml-2'} />
                                                    </ElOption>
                                                ))}
                                            </ElSelect>
                                        ) : null}
                                    </>
                                ),
                                body: () => (
                                    <>
                                        <div class={'monitor-chart-content'}>
                                            {unref(chartOption) === 'network' ? (
                                                <div class={'monitor-tags'} style={monitorTagsStyle}>
                                                    <ElTag>
                                                        {$t('monitor.up')}
                                                        {': '}
                                                        {computeSizeFromKBs(currentChartInfo.netBytesSent)}
                                                    </ElTag>
                                                    <ElTag>
                                                        {$t('monitor.down')}
                                                        {': '}
                                                        {computeSizeFromKBs(currentChartInfo.netBytesRecv)}
                                                    </ElTag>
                                                    <ElTag>
                                                        {$t('home.totalSend')}
                                                        {': '}
                                                        {computeSize(unref(currentInfo).netBytesSent)}
                                                    </ElTag>
                                                    <ElTag>
                                                        {$t('home.totalRecv')}
                                                        {': '}
                                                        {computeSize(unref(currentInfo).netBytesRecv)}
                                                    </ElTag>
                                                </div>
                                            ) : null}
                                            {unref(chartOption) === 'io' ? (
                                                <div class={'monitor-tags'} style={monitorTagsStyle}>
                                                    <ElTag>
                                                        {$t('monitor.read')}
                                                        {': '}
                                                        {currentChartInfo.ioReadBytes}
                                                        {' MB'}
                                                    </ElTag>
                                                    <ElTag>
                                                        {$t('monitor.write')}
                                                        {': '}
                                                        {currentChartInfo.ioWriteBytes}
                                                        {' MB'}
                                                    </ElTag>
                                                    <ElTag>
                                                        {$t('home.rwPerSecond')}
                                                        {': '}
                                                        {currentChartInfo.ioCount}
                                                        {$t('commons.units.time')}
                                                        {'/s '}
                                                    </ElTag>
                                                    <ElTag>
                                                        {$t('home.ioDelay')}
                                                        {': '}
                                                        {currentChartInfo.ioTime}
                                                        {' ms'}
                                                    </ElTag>
                                                </div>
                                            ) : null}
                                            {unref(chartOption) === 'io' ? (
                                                <div class={'mobile-monitor-chart'}>
                                                    <VCharts
                                                        height="383px"
                                                        id="ioChart"
                                                        type="line"
                                                        option={unref(chartsOption)['ioChart']}
                                                        dataZoom={true}
                                                    />
                                                </div>
                                            ) : null}
                                            {unref(chartOption) === 'network' ? (
                                                <div class={'mobile-monitor-chart'}>
                                                    <VCharts
                                                        height="383px"
                                                        id="networkChart"
                                                        type="line"
                                                        option={unref(chartsOption)['networkChart']}
                                                        dataZoom={true}
                                                    />
                                                </div>
                                            ) : null}
                                            {unref(chartOption) === 'vllm' ? (
                                                <>
                                                    <div class={'monitor-tags'} style={monitorTagsStyle}>
                                                        <ElTag>
                                                            {$t('aiTools.vllmMonitor.promptThroughput')}
                                                            {': '}
                                                            {formatVllmMetric(unref(vllmCurrent)?.promptThroughput)}
                                                            {' tokens/s '}
                                                        </ElTag>
                                                        <ElTag>
                                                            {$t('aiTools.vllmMonitor.generationThroughput')}
                                                            {': '}
                                                            {formatVllmMetric(unref(vllmCurrent)?.generationThroughput)}
                                                            {' tokens/s '}
                                                        </ElTag>
                                                        <ElTag>
                                                            {$t('aiTools.vllmMonitor.processing')}
                                                            {': '}
                                                            {formatVllmMetric(unref(vllmCurrent)?.running)}
                                                        </ElTag>
                                                        <ElTag>
                                                            {$t('aiTools.vllmMonitor.queued')}
                                                            {': '}
                                                            {formatVllmMetric(unref(vllmCurrent)?.waiting)}
                                                        </ElTag>
                                                    </div>
                                                    <div class={'mobile-monitor-chart'}>
                                                        <VCharts
                                                            height="383px"
                                                            id="vllmChart"
                                                            type="line"
                                                            option={unref(vllmChartOption)}
                                                            dataZoom={true}
                                                        />
                                                    </div>
                                                    <div class={'vllm-monitor-footer'}>
                                                        <span>{unref(vllmMonitorMessage)}</span>
                                                        {unref(selectedVllm) ? (
                                                            <ElButton
                                                                link
                                                                type="primary"
                                                                onClick={($event?: any) => {
                                                                    unref(vllmMonitorRef)?.acceptParams(
                                                                        unref(selectedVllm),
                                                                    );
                                                                }}
                                                            >
                                                                {$t('commons.button.view')}
                                                            </ElButton>
                                                        ) : null}
                                                    </div>
                                                    {unref(selectedVllm)
                                                        ? h(VllmMonitor, { ref: vllmMonitorRef })
                                                        : null}
                                                </>
                                            ) : null}
                                        </div>
                                    </>
                                ),
                            }}
                        />
                    </ElCol>
                    <ElCol xs={24} sm={24} md={8} lg={8} xl={8} class={'dashboard-right'}>
                        <ElCarousel
                            height="368px"
                            indicator-position
                            arrow="never"
                            autoplay={!unref(showMemoCarousel) || !unref(memoEditing)}
                            class={cn('my-carousel', { 'no-indicator': unref(carouselItemCount) <= 1 })}
                            key={unref(simpleNodes).length + unref(carouselItemCount)}
                        >
                            <ElCarouselItem>
                                <CardWithHeader
                                    header={$t('home.systemInfo')}
                                    v-slots={{
                                        'header-r': () => (
                                            <>
                                                <ElPopover
                                                    popper-class="dashboard-carousel-popover"
                                                    placement="bottom"
                                                    title={$t('home.carouselSetting')}
                                                    width="220"
                                                    trigger="click"
                                                    v-slots={{
                                                        reference: () => (
                                                            <>
                                                                <ElButton
                                                                    disabled={!unref(isAdminOrNodeAdmin)}
                                                                    link
                                                                    icon="Setting"
                                                                    class={'h-button-setting'}
                                                                />
                                                            </>
                                                        ),
                                                    }}
                                                >
                                                    <div class={'dashboard-carousel-setting'}>
                                                        <div class={'setting-item mt-2'}>
                                                            <span>{$t('home.systemInfo')}</span>
                                                            <div class={'mr-4'}>{'-'}</div>
                                                        </div>
                                                        <div class={'setting-item mt-2'}>
                                                            <span>{$t('home.memo')}</span>
                                                            <ElSwitch
                                                                modelValue={unref(memoCarouselSetting)}
                                                                onUpdate:modelValue={($v) => {
                                                                    memoCarouselSetting.value = $v as any;
                                                                }}
                                                                active-value="Enable"
                                                                inactive-value="Disable"
                                                                onChange={($event?: any) => {
                                                                    (val) =>
                                                                        updateDashboardCarouselSetting(
                                                                            'DashboardMemoVisible',
                                                                            val,
                                                                        );
                                                                }}
                                                            />
                                                        </div>
                                                        <div class={'setting-item'}>
                                                            <span>{$t('setting.panel')}</span>
                                                            <ElSwitch
                                                                modelValue={unref(simpleNodeCarouselSetting)}
                                                                onUpdate:modelValue={($v) => {
                                                                    simpleNodeCarouselSetting.value = $v as any;
                                                                }}
                                                                active-value="Enable"
                                                                inactive-value="Disable"
                                                                onChange={($event?: any) => {
                                                                    (val) =>
                                                                        updateDashboardCarouselSetting(
                                                                            'DashboardSimpleNodeVisible',
                                                                            val,
                                                                        );
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </ElPopover>
                                                <ElTooltip content={$t('commons.button.refresh')} placement="top">
                                                    <ElButton
                                                        onClick={($event?: any) => {
                                                            (refreshDashboard as any)($event);
                                                        }}
                                                        link
                                                        icon="Refresh"
                                                        class={'h-button-setting'}
                                                    />
                                                </ElTooltip>
                                                <ElTooltip content={$t('home.tooltipSensitiveInfo')} placement="top">
                                                    <ElButton
                                                        onClick={($event?: any) => {
                                                            (toggleSensitiveInfo as any)($event);
                                                        }}
                                                        link
                                                        icon={unref(showSensitiveInfo) ? 'View' : 'Hide'}
                                                        class={'h-button-setting'}
                                                    />
                                                </ElTooltip>
                                                <ElTooltip content={$t('commons.button.copy')} placement="top">
                                                    <ElButton
                                                        onClick={($event?: any) => {
                                                            (handleCopy as any)($event);
                                                        }}
                                                        link
                                                        icon="CopyDocument"
                                                        class={'h-button-setting'}
                                                    />
                                                </ElTooltip>
                                            </>
                                        ),
                                        body: () => (
                                            <>
                                                <ElScrollbar>
                                                    <ElDescriptions column={1} border class={'h-systemInfo -mt-2 ml-5'}>
                                                        <ElDescriptionsItem
                                                            class-name="system-content"
                                                            label-class-name="system-label"
                                                            v-slots={{
                                                                label: () => (
                                                                    <>
                                                                        <span class={'system-label'}>
                                                                            {$t('home.hostname')}
                                                                        </span>
                                                                    </>
                                                                ),
                                                            }}
                                                        >
                                                            {unref(showSensitiveInfo)
                                                                ? unref(baseInfo).hostname
                                                                : '****'}
                                                        </ElDescriptionsItem>
                                                        <ElDescriptionsItem
                                                            class-name="system-content"
                                                            label-class-name="system-label"
                                                            v-slots={{
                                                                label: () => (
                                                                    <>
                                                                        <span class={'system-label'}>
                                                                            {$t('home.platformVersion')}
                                                                        </span>
                                                                    </>
                                                                ),
                                                            }}
                                                        >
                                                            {unref(baseInfo).prettyDistro
                                                                ? unref(baseInfo).prettyDistro
                                                                : unref(baseInfo).platformVersion
                                                                  ? unref(baseInfo).platform +
                                                                    '-' +
                                                                    unref(baseInfo).platformVersion
                                                                  : unref(baseInfo).platform}
                                                        </ElDescriptionsItem>
                                                        <ElDescriptionsItem
                                                            class-name="system-content"
                                                            label-class-name="system-label"
                                                            v-slots={{
                                                                label: () => (
                                                                    <>
                                                                        <span class={'system-label'}>
                                                                            {$t('home.kernelVersion')}
                                                                        </span>
                                                                    </>
                                                                ),
                                                            }}
                                                        >
                                                            {unref(baseInfo).kernelVersion}
                                                        </ElDescriptionsItem>
                                                        <ElDescriptionsItem
                                                            class-name="system-content"
                                                            label-class-name="system-label"
                                                            v-slots={{
                                                                label: () => (
                                                                    <>
                                                                        <span class={'system-label'}>
                                                                            {$t('home.kernelArch')}
                                                                        </span>
                                                                    </>
                                                                ),
                                                            }}
                                                        >
                                                            {unref(baseInfo).kernelArch}
                                                        </ElDescriptionsItem>
                                                        <ElDescriptionsItem
                                                            class-name="system-content"
                                                            label-class-name="system-label"
                                                            v-slots={{
                                                                label: () => (
                                                                    <>
                                                                        <span class={'system-label'}>
                                                                            {$t('home.ip')}
                                                                        </span>
                                                                    </>
                                                                ),
                                                            }}
                                                        >
                                                            {unref(showSensitiveInfo)
                                                                ? unref(baseInfo).ipV4Addr
                                                                : '****'}
                                                        </ElDescriptionsItem>
                                                        {unref(baseInfo).httpProxy &&
                                                        unref(baseInfo).httpProxy !== 'noProxy' ? (
                                                            <ElDescriptionsItem
                                                                class-name="system-content"
                                                                label-class-name="system-label"
                                                                v-slots={{
                                                                    label: () => (
                                                                        <>
                                                                            <span class={'system-label'}>
                                                                                {$t('home.proxy')}
                                                                            </span>
                                                                            {unref(baseInfo).httpProxy}
                                                                        </>
                                                                    ),
                                                                }}
                                                            />
                                                        ) : null}
                                                        <ElDescriptionsItem
                                                            class-name="system-content"
                                                            label-class-name="system-label"
                                                            v-slots={{
                                                                label: () => (
                                                                    <>
                                                                        <span class={'system-label'}>
                                                                            {$t('home.uptime')}
                                                                        </span>
                                                                    </>
                                                                ),
                                                            }}
                                                        >
                                                            {unref(currentInfo).timeSinceUptime}
                                                        </ElDescriptionsItem>
                                                        <ElDescriptionsItem
                                                            class-name="system-content"
                                                            label-class-name="system-label"
                                                            v-slots={{
                                                                label: () => (
                                                                    <>
                                                                        <span class={'system-label'}>
                                                                            {$t('home.runningTime')}
                                                                        </span>
                                                                    </>
                                                                ),
                                                            }}
                                                        >
                                                            {formatUptime(unref(currentInfo).runningTime)}
                                                        </ElDescriptionsItem>
                                                    </ElDescriptions>
                                                </ElScrollbar>
                                            </>
                                        ),
                                    }}
                                />
                            </ElCarouselItem>
                            {unref(showMemoCarousel) ? (
                                <ElCarouselItem>
                                    <CardWithHeader
                                        header={$t('home.memo')}
                                        class={'memo-card'}
                                        v-slots={{
                                            'header-r': () => (
                                                <>
                                                    {!unref(memoEditing) ? (
                                                        <ElTooltip content={$t('commons.button.edit')} placement="top">
                                                            <ElButton
                                                                disabled={!unref(isAdminOrNodeAdmin)}
                                                                onClick={($event?: any) => {
                                                                    (startMemoEdit as any)($event);
                                                                }}
                                                                link
                                                                icon="Edit"
                                                                class={'h-button-setting'}
                                                            />
                                                        </ElTooltip>
                                                    ) : null}
                                                    {unref(memoEditing) ? (
                                                        <ElTooltip content={$t('commons.button.save')} placement="top">
                                                            <ElButton
                                                                onClick={($event?: any) => {
                                                                    (saveMemo as any)($event);
                                                                }}
                                                                link
                                                                icon="Check"
                                                                loading={unref(memoSaving)}
                                                                class={'h-button-setting'}
                                                            />
                                                        </ElTooltip>
                                                    ) : null}
                                                    {unref(memoEditing) ? (
                                                        <ElTooltip
                                                            content={$t('commons.button.cancel')}
                                                            placement="top"
                                                        >
                                                            <ElButton
                                                                onClick={($event?: any) => {
                                                                    (cancelMemoEdit as any)($event);
                                                                }}
                                                                link
                                                                icon="Close"
                                                                class={'h-button-setting'}
                                                            />
                                                        </ElTooltip>
                                                    ) : null}
                                                </>
                                            ),
                                            body: () => (
                                                <>
                                                    <ElScrollbar height="286px">
                                                        <div class={'memo-container mr-5 ml-5'}>
                                                            {unref(memoEditing) ? (
                                                                <ElInput
                                                                    modelValue={unref(memoEditContent)}
                                                                    onUpdate:modelValue={($v) => {
                                                                        memoEditContent.value = $v as any;
                                                                    }}
                                                                    type="textarea"
                                                                    rows={10}
                                                                    maxlength={500}
                                                                    placeholder={$t('home.memoPlaceholder')}
                                                                    show-word-limit
                                                                />
                                                            ) : (
                                                                <div class={'memo-content'}>
                                                                    {unref(memoContent) ? (
                                                                        <MarkDownEditor content={unref(memoContent)} />
                                                                    ) : (
                                                                        <div class={'memo-empty'}>
                                                                            <span class={'memo-placeholder'}>
                                                                                {$t('home.memoPlaceholder')}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </ElScrollbar>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElCarouselItem>
                            ) : null}
                            {showSimpleNode() ? (
                                <ElCarouselItem>
                                    <CardWithHeader
                                        header={$t('setting.panel')}
                                        v-slots={{
                                            'header-r': () => (
                                                <>
                                                    <ElTooltip content={$t('xpack.node.panelItem')} placement="top">
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                routerToExtensionName('SimpleNode', {
                                                                    uncached: 'true',
                                                                });
                                                            }}
                                                            link
                                                            icon="Setting"
                                                            class={'h-button-setting'}
                                                        />
                                                    </ElTooltip>
                                                </>
                                            ),
                                            body: () => (
                                                <>
                                                    <ElScrollbar height="286px">
                                                        {(unref(simpleNodes) || []).map((row) => (
                                                            <div class={'simple-node cursor-pointer'} key={row.id}>
                                                                <ElRow gutter={5}>
                                                                    <ElCol span={21}>
                                                                        <div class={'name'}>
                                                                            {row.name}
                                                                            <Status
                                                                                status={row.status}
                                                                                msg={row.message}
                                                                            />
                                                                        </div>
                                                                        <div class={'detail'}>{loadSource(row)}</div>
                                                                    </ElCol>
                                                                    <ElCol span={1}>
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                jumpPanel(row);
                                                                            }}
                                                                            size="small"
                                                                            disabled={row.status !== 'Healthy'}
                                                                            round
                                                                            plain
                                                                            type="primary"
                                                                            class={'visit'}
                                                                        >
                                                                            {$t('commons.button.visit')}
                                                                        </ElButton>
                                                                    </ElCol>
                                                                </ElRow>
                                                                <div class={'h-app-divider'} />
                                                            </div>
                                                        ))}
                                                    </ElScrollbar>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElCarouselItem>
                            ) : null}
                        </ElCarousel>
                        <AppLauncher ref={appRef} class={'dashboard-app'} />
                    </ElCol>
                </ElRow>
                <QuickJump
                    onSearch={($event?: any) => {
                        onLoadBaseInfo(false, 'all');
                    }}
                    ref={quickJumpRef}
                />
            </div>
        );
    },
    options,
);
