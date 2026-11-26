import { $t } from '@/utils/i18n-t';
import { panelCacheKey, readPanelCache, writePanelCache } from '@/utils/panel-cache';
import './TableSetting.styles.css';

interface CodemodProps {
    [key: string]: any;
    title?: string;
    rate?: number;
}

const emits = {
    search: (...args: unknown[]) => true,
};

const options = {
    name: 'TableSetting',
    props: {
        title: { type: String },
        rate: { type: Number },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-eaf27be2',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const refreshRateUnit = ref(0);
        const route = useRoute();
        const pagePath = route.path;
        const cacheKey = () => panelCacheKey(`refresh:${pagePath}:${__panelSetupProps.title || ''}`);
        let timer: ReturnType<typeof setInterval> | undefined;
        let active = false;
        const stopTimer = () => {
            clearInterval(timer);
            timer = undefined;
        };
        const startTimer = () => {
            stopTimer();
            if (active && refreshRateUnit.value > 0) {
                timer = setInterval(() => ctx.emit('search'), 1000 * refreshRateUnit.value);
            }
        };
        const restore = () => {
            const rate = readPanelCache<number>('refresh', cacheKey());
            refreshRateUnit.value = Number.isFinite(rate) && rate >= 0 ? rate : __panelSetupProps.rate || 0;
            startTimer();
        };
        const changeRefresh = (rate: number) => {
            refreshRateUnit.value = rate;
            writePanelCache('refresh', cacheKey(), rate);
            startTimer();
        };
        const activate = () => {
            if (active) return;
            active = true;
            restore();
        };
        watch(cacheKey, () => {
            if (active) restore();
        });
        onMounted(activate);
        onActivated(activate);
        onDeactivated(() => {
            active = false;
            stopTimer();
        });
        onUnmounted(stopTimer);
        return () => (
            <div>
                <ElDropdown
                    onCommand={($event?: any) => {
                        (changeRefresh as any)($event);
                    }}
                    v-slots={{
                        dropdown: () => (
                            <>
                                <ElDropdownMenu>
                                    <ElDropdownItem command={0}>{$t('commons.table.noRefresh')}</ElDropdownItem>
                                    <ElDropdownItem command={5}>{'5s'}</ElDropdownItem>
                                    <ElDropdownItem command={10}>{'10s'}</ElDropdownItem>
                                    <ElDropdownItem command={30}>{'30s'}</ElDropdownItem>
                                    <ElDropdownItem command={60}>{'60s'}</ElDropdownItem>
                                    <ElDropdownItem command={120}>{'120s'}</ElDropdownItem>
                                    <ElDropdownItem command={300}>{'300s'}</ElDropdownItem>
                                </ElDropdownMenu>
                            </>
                        ),
                    }}
                >
                    <ElButton class={'timer-button'}>
                        {unref(refreshRateUnit) === 0 ? $t('commons.table.noRefresh') : unref(refreshRateUnit) + 's'}
                    </ElButton>
                </ElDropdown>
            </div>
        );
    },
    options,
);
