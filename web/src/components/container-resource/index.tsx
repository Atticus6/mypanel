import { $t } from '@/utils/i18n-t';
import type { Container } from '@/types/container';
import { computeCPU, computeSizeForDocker } from '@/utils/size';
import SvgIcon from '@/components/svg-icon/svg-icon';
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    stats?: Container.ContainerListStats;
}

const emits = {};

type SlotsShape = {
    default: (arg?: unknown) => VNode[];
    footer: (arg?: unknown) => VNode[];
};

const options = {
    name: 'container-resource',
    props: {
        stats: { type: null },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-418b4e6d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        return () => (
            <div>
                <div class={'source-font'}>
                    {'CPU: '}
                    {__panelSetupProps.stats.cpuPercent.toFixed(2)}
                    {'%'}
                </div>
                <div class={'source-font float-left'}>
                    {$t('monitor.memory')}
                    {': '}
                    {__panelSetupProps.stats.memoryPercent.toFixed(2)}
                    {'%'}
                </div>
                <ElPopover
                    placement="right"
                    width="500px"
                    class={'float-right'}
                    v-slots={{
                        reference: () => (
                            <>
                                <SvgIcon iconName="p-xiangqing" className="resource-detail-icon" />
                            </>
                        ),
                        default: () => (
                            <>
                                <ElDescriptions direction="vertical" border column={3} size="small">
                                    <ElDescriptionsItem label={$t('container.cpuUsage')}>
                                        {computeCPU(__panelSetupProps.stats.cpuTotalUsage)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('container.cpuTotal')}>
                                        {computeCPU(__panelSetupProps.stats.systemUsage)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('container.core')}>
                                        {__panelSetupProps.stats.percpuUsage}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('container.memUsage')}>
                                        {computeSizeForDocker(__panelSetupProps.stats.memoryUsage)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('container.memCache')}>
                                        {computeSizeForDocker(__panelSetupProps.stats.memoryCache)}
                                    </ElDescriptionsItem>
                                    <ElDescriptionsItem label={$t('container.memTotal')}>
                                        {computeSizeForDocker(__panelSetupProps.stats.memoryLimit)}
                                    </ElDescriptionsItem>
                                    {ctx.slots['default']?.(undefined)}
                                </ElDescriptions>
                                {ctx.slots['footer']?.(undefined)}
                            </>
                        ),
                    }}
                />
            </div>
        );
    },
    options,
);
