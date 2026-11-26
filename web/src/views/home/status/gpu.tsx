import { $t } from '@/utils/i18n-t';
import { computed, ref } from 'vue';
import { ArrowDown, ArrowRight, ArrowUp } from '@element-plus/icons-vue';
import { Dashboard } from '@/types/dashboard';
import { computeSizeForDocker } from '@/utils/size';
import i18n from '@/lang';
import './gpu.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { cn } from '@/utils/cn';
import { ElButton } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElPopover } from 'element-plus';
import { ElDescriptions } from 'element-plus';
import { ElDescriptionsItem } from 'element-plus';
import { ElProgress } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    current?: Dashboard.CurrentInfo;
}

const emits = {
    open: () => true,
};

const options = {
    name: 'gpu',
    props: {
        current: { type: null },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-793c0ea2',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const showAll = ref(false);
        const t = i18n.global.t;
        const isAvailable = (value?: string) =>
            Boolean(value?.trim() && !/^(N\/A|NA|NOT SUPPORTED|\[NOT SUPPORTED\])$/i.test(value.trim()));
        const memoryBytes = (value?: string): number | null => {
            const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*(B|bytes?|[KMGT]i?B)?$/i);
            if (!match) return null;
            const units: Record<string, number> = {
                '': 1024 ** 2,
                b: 1,
                byte: 1,
                bytes: 1,
                kb: 1000,
                kib: 1024,
                mb: 1000 ** 2,
                mib: 1024 ** 2,
                gb: 1000 ** 3,
                gib: 1024 ** 3,
                tb: 1000 ** 4,
                tib: 1024 ** 4,
            };
            const bytes = Number(match[1]) * units[(match[2] || '').toLowerCase()];
            return Number.isFinite(bytes) ? bytes : null;
        };
        const formatMemory = (value: number | null) => (value === null ? '—' : computeSizeForDocker(value));
        const devices = computed(() =>
            [
                ...(__panelSetupProps.current.gpuData || []).map((item) => ({
                    key: `gpu-${item.type}-${item.busID || item.index}`,
                    type: 'GPU',
                    sharedMemory: !!item.sharedMemory,
                    card: `${item.type}-${item.busID || item.index}`,
                    id: `GPU ${item.index}`,
                    name: item.productName || 'GPU',
                    util: item.gpuUtil,
                    used: item.memUsed || item.memoryUsage?.split('/')[0],
                    total: item.memTotal || item.memoryUsage?.split('/')[1],
                    temperature: item.temperature,
                    power: item.powerUsage || item.powerDraw,
                    details: [
                        [t('aiTools.gpu.busID'), item.busID],
                        [t('aiTools.gpu.fanSpeed'), item.fanSpeed],
                        [t('aiTools.gpu.performanceState'), item.performanceState],
                        [t('aiTools.gpu.powerUsage'), item.powerUsage || item.powerDraw],
                    ],
                })),
                ...(__panelSetupProps.current.npuData || []).map((item) => ({
                    key: `npu-${item.npuIndex}-${item.chipIndex}`,
                    type: 'NPU',
                    sharedMemory: false,
                    card: item.npuIndex,
                    id: `NPU ${item.npuIndex} · Chip ${item.chipIndex}`,
                    name: item.productName || 'NPU',
                    util: item.aiCore,
                    used: item.memUsed,
                    total: item.memTotal,
                    temperature: item.temperature,
                    power: item.powerDraw,
                    details: [
                        [t('aiTools.gpu.busID'), item.busID],
                        [t('commons.table.status'), item.health],
                        [t('aiTools.gpu.ddrUsage'), `${item.memoryUsed || '—'} / ${item.memoryTotal || '—'}`],
                        [t('aiTools.gpu.hbmUsage'), `${item.hbmUsed || '—'} / ${item.hbmTotal || '—'}`],
                        [
                            t('aiTools.gpu.hugepagesUsage'),
                            `${item.hugepagesUsed || '—'} / ${item.hugepagesTotal || '—'}`,
                        ],
                    ],
                })),
                ...(__panelSetupProps.current.xpuData || []).map((item) => ({
                    key: `xpu-${item.deviceID}`,
                    type: 'XPU',
                    sharedMemory: false,
                    card: item.deviceID,
                    id: `XPU ${item.deviceID}`,
                    name: item.deviceName || 'XPU',
                    util: item.gpuUtil,
                    used: item.memoryUsed,
                    total: item.memory,
                    temperature: item.temperature,
                    power: item.power,
                    details: [[t('aiTools.gpu.busID'), item.pciBdfAddress]],
                })),
            ].map((item) => {
                const memoryUsed = memoryBytes(item.used);
                const memoryTotal = memoryBytes(item.total);
                const utilization = item.util?.trim().match(/^(\d+(?:\.\d+)?)\s*%?$/);
                return {
                    ...item,
                    memoryUsed,
                    memoryTotal,
                    utilization: utilization ? Math.min(100, Number(utilization[1])) : null,
                    memoryPercent:
                        memoryUsed !== null && memoryTotal !== null && memoryTotal > 0
                            ? Math.min(100, Number(((memoryUsed / memoryTotal) * 100).toFixed(1)))
                            : null,
                    temperature: isAvailable(item.temperature) ? item.temperature.replace(/\s*°?C\b/, ' °C') : '—',
                    power: isAvailable(item.power) ? item.power : '—',
                };
            }),
        );
        const visibleDevices = computed(() => (showAll.value ? devices.value : devices.value.slice(0, 4)));
        const deviceGroups = computed(() =>
            ['GPU', 'NPU', 'XPU']
                .map((type) => ({
                    type,
                    count: new Set(devices.value.filter((item) => item.type === type).map((item) => item.card)).size,
                }))
                .filter((item) => item.count > 0),
        );
        const sharedMemoryDevice = computed(() => devices.value.find((item) => item.sharedMemory));
        const dedicatedMemoryDevices = computed(() => devices.value.filter((item) => !item.sharedMemory));
        const totalMemory = computed(() =>
            dedicatedMemoryDevices.value.some((item) => item.memoryTotal === null)
                ? null
                : dedicatedMemoryDevices.value.reduce((sum, item) => sum + item.memoryTotal!, 0),
        );
        const usedMemory = computed(() =>
            dedicatedMemoryDevices.value.some((item) => item.memoryUsed === null)
                ? null
                : dedicatedMemoryDevices.value.reduce((sum, item) => sum + item.memoryUsed!, 0),
        );
        return () => (
            <div class={cn('gpu-status', { 'gpu-status-single': unref(devices).length === 1 })}>
                {unref(devices).length !== 1 ? (
                    <div class={'gpu-summary'}>
                        <div class={'gpu-summary-header'}>
                            <div class={'device-counts'}>
                                {(unref(deviceGroups) || []).map((group) => (
                                    <strong key={group.type}>
                                        {group.type}
                                        {' × '}
                                        {group.count}
                                    </strong>
                                ))}
                            </div>
                            <div class={'summary-actions'}>
                                {unref(devices).length > 4 ? (
                                    <ElButton
                                        link
                                        type="primary"
                                        size="small"
                                        onClick={($event?: any) => {
                                            showAll.value = !unref(showAll);
                                        }}
                                    >
                                        {$t(unref(showAll) ? 'tabs.hide' : 'tabs.more')}
                                        <ElIcon>{unref(showAll) ? <ArrowUp /> : <ArrowDown />}</ElIcon>
                                    </ElButton>
                                ) : null}
                                <ElButton
                                    link
                                    type="primary"
                                    size="small"
                                    onClick={($event?: any) => {
                                        ctx.emit('open');
                                    }}
                                >
                                    {$t('aiTools.gpu.viewHistory')}
                                    <ElIcon>
                                        <ArrowRight />
                                    </ElIcon>
                                </ElButton>
                            </div>
                        </div>
                        {unref(dedicatedMemoryDevices).length ? (
                            <div class={'summary-memory'}>
                                <span class={'metric-label'}>{$t('aiTools.gpu.memoryTotal')}</span>
                                <strong>{formatMemory(unref(totalMemory))}</strong>
                                <span class={'metric-label'}>
                                    {$t('home.used')}
                                    {formatMemory(unref(usedMemory))}
                                </span>
                            </div>
                        ) : null}
                        {unref(sharedMemoryDevice) ? (
                            <div title={$t('aiTools.gpu.systemMemoryHelper')} class={'summary-memory'}>
                                <span class={'metric-label'}>{$t('aiTools.gpu.systemMemory')}</span>
                                <strong>{formatMemory(unref(sharedMemoryDevice).memoryTotal)}</strong>
                                <span class={'metric-label'}>
                                    {$t('home.used')}
                                    {formatMemory(unref(sharedMemoryDevice).memoryUsed)}
                                </span>
                            </div>
                        ) : null}
                    </div>
                ) : null}
                <div class={'gpu-grid'}>
                    {(unref(visibleDevices) || []).map((device) => (
                        <article class={'gpu-card'} key={device.key}>
                            <div class={'device-header'}>
                                <h3 class={'device-id'}>{device.id}</h3>
                                <ElPopover
                                    width={360}
                                    trigger="click"
                                    popper-class="dashboard-gpu-popover"
                                    v-slots={{
                                        reference: () => (
                                            <>
                                                <ElButton link type="primary" size="small">
                                                    {$t('commons.button.view')}
                                                </ElButton>
                                            </>
                                        ),
                                    }}
                                >
                                    <ElDescriptions title={device.name} column={1} size="small">
                                        {(device.details.filter((item) => isAvailable(item[1])) || []).map((detail) => (
                                            <ElDescriptionsItem label={detail[0]} key={detail[0]}>
                                                {detail[1]}
                                            </ElDescriptionsItem>
                                        ))}
                                    </ElDescriptions>
                                </ElPopover>
                                {unref(devices).length === 1 ? (
                                    <ElButton
                                        link
                                        type="primary"
                                        size="small"
                                        onClick={($event?: any) => {
                                            ctx.emit('open');
                                        }}
                                    >
                                        {$t('aiTools.gpu.viewHistory')}
                                        <ElIcon>
                                            <ArrowRight />
                                        </ElIcon>
                                    </ElButton>
                                ) : null}
                            </div>
                            <div class={'device-metrics'}>
                                <div class={'device-metric'}>
                                    <div class={'metric-heading'}>
                                        <span class={'metric-label'}>
                                            {device.type === 'NPU'
                                                ? $t('aiTools.gpu.aiCore')
                                                : $t('aiTools.gpu.gpuUtil')}
                                        </span>
                                        <strong>{device.utilization === null ? '—' : `${device.utilization}%`}</strong>
                                    </div>
                                    <ElProgress
                                        percentage={device.utilization ?? 0}
                                        show-text={false}
                                        stroke-width={3}
                                    />
                                </div>
                                <div class={'device-metric'}>
                                    <div class={'metric-heading'}>
                                        <span
                                            title={
                                                device.sharedMemory ? $t('aiTools.gpu.systemMemoryHelper') : undefined
                                            }
                                            class={'metric-label'}
                                        >
                                            {$t(
                                                device.sharedMemory
                                                    ? 'aiTools.gpu.systemMemory'
                                                    : 'aiTools.gpu.memoryUsed',
                                            )}
                                        </span>
                                        <strong>
                                            {formatMemory(device.memoryUsed)}
                                            <span class={'metric-total'}>
                                                {'/ '}
                                                {formatMemory(device.memoryTotal)}
                                            </span>
                                        </strong>
                                    </div>
                                    <ElProgress
                                        percentage={device.memoryPercent ?? 0}
                                        show-text={false}
                                        stroke-width={3}
                                        color="var(--el-color-primary)"
                                    />
                                </div>
                            </div>
                            <div class={'device-footer'}>
                                <div>
                                    <span class={'metric-label'}>{$t('aiTools.gpu.temperature')}</span>
                                    <strong>{device.temperature}</strong>
                                </div>
                                <div>
                                    <span class={'metric-label'}>{$t('aiTools.gpu.powerUsage')}</span>
                                    <strong>{device.power}</strong>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        );
    },
    options,
);
