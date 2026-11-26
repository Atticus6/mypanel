import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { getXpackProxyDocker } from '@/extensions/xpack';

interface CodemodProps {
    [key: string]: any;
    syncList?: string;
}

const emits = {
    'update:withDockerRestart': (...args: unknown[]) => true,
};

const options = {
    name: 'docker-proxy',
    props: {
        syncList: { type: String },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const showOption = ref(false);
        const restart = ref(false);
        const loadStatus = async () => {
            if (__panelSetupProps.syncList.indexOf('SyncSystemProxy') === -1) {
                ctx.emit('update:withDockerRestart', false);
                return;
            }
            await rpc.core.setting
                .getBaseInfo({})
                .then((res) => {
                    if (res.proxyType === '' || res.proxyType === 'close') {
                        ctx.emit('update:withDockerRestart', false);
                        return;
                    }
                })
                .catch(() => {
                    ctx.emit('update:withDockerRestart', false);
                    return;
                });
            const res = await getXpackProxyDocker();
            if (!res) {
                ctx.emit('update:withDockerRestart', false);
                return;
            }
            if (res.data.proxyDocker !== 'Enable') {
                ctx.emit('update:withDockerRestart', false);
                return;
            }
            showOption.value = true;
        };
        const changeRestart = () => {
            ctx.emit('update:withDockerRestart', restart.value);
        };
        onMounted(() => {
            showOption.value = false;
            loadStatus();
        });
        return () =>
            unref(showOption) ? (
                <div class={'w-full'}>
                    <ElRadioGroup
                        modelValue={unref(restart)}
                        onUpdate:modelValue={($v) => {
                            restart.value = $v as any;
                        }}
                        onChange={($event?: any) => {
                            (changeRestart as any)($event);
                        }}
                    >
                        <ElRadio value={true}>{$t('setting.restartNow')}</ElRadio>
                        <ElRadio value={false}>{$t('setting.restartLater')}</ElRadio>
                    </ElRadioGroup>
                    {unref(restart) ? (
                        <span class={'input-help'}>{$t('xpack.node.syncProxyHelper3')}</span>
                    ) : (
                        <span class={'input-help'}>{$t('xpack.node.syncProxyHelper4')}</span>
                    )}
                </div>
            ) : null;
    },
    options,
);
