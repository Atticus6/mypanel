import { $t } from '@/utils/i18n-t';
import NoSuchService from '@/components/layout-content/no-such-service';
import { routerToName } from '@/utils/router';
import { rpc } from '@/lib/rpc';

interface CodemodProps {
    [key: string]: any;
    isHide?: boolean;
}

const emits = {
    search: (...args: unknown[]) => true,
    mounted: (...args: unknown[]) => true,
    'update:isActive': (...args: unknown[]) => true,
    'update:isExist': (...args: unknown[]) => true,
    'update:loading': (...args: unknown[]) => true,
};

const options = {
    name: 'docker-status',
    props: {
        isHide: { type: Boolean },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const isActive = ref(true);
        const isExist = ref(true);
        const loadStatus = async () => {
            ctx.emit('update:loading', true);
            await rpc.container
                .getDockerStatus({})
                .then((res) => {
                    isActive.value = res.isActive;
                    isExist.value = res.isExist;
                    ctx.emit('update:loading', false);
                    ctx.emit('update:isActive', isActive.value);
                    ctx.emit('update:isExist', isExist.value);
                    ctx.emit('search');
                    ctx.emit('mounted');
                })
                .catch(() => {
                    ctx.emit('update:loading', false);
                    ctx.emit('update:isActive', false);
                    ctx.emit('update:isExist', false);
                });
        };
        const goSetting = async () => {
            routerToName('ContainerSetting');
        };
        onMounted(() => {
            loadStatus();
        });
        return () => (
            <div>
                {unref(isExist) && !unref(isActive) && !__panelSetupProps.isHide ? (
                    <ElCard class={'mask-prompt'}>
                        <span>{$t('container.serviceUnavailable')}</span>
                        <ElButton
                            type="primary"
                            link
                            onClick={($event?: any) => {
                                (goSetting as any)($event);
                            }}
                            class={'bt'}
                        >
                            {'【 '}
                            {$t('container.setting')}
                            {' 】'}
                        </ElButton>
                        <span>{$t('container.startIn')}</span>
                    </ElCard>
                ) : null}
                {!unref(isExist) ? <NoSuchService name="Docker" /> : null}
            </div>
        );
    },
    options,
);
