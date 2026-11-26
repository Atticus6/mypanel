import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { getXpackProxyDocker } from '@/extensions/xpack';
interface DialogProps {
    syncList: string;
    open: boolean;
}
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    'update:withDockerRestart': (...args: unknown[]) => true,
    submit: (...args: unknown[]) => true,
};

const options = {
    name: 'dialog',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const restart = ref(true);
        const emit = () => {
            ctx.emit('update:withDockerRestart', false);
            ctx.emit('submit');
        };
        const acceptParams = async (__panelSetupProps: DialogProps): Promise<void> => {
            if (__panelSetupProps.syncList.indexOf('SyncSystemProxy') === -1) {
                emit();
                return;
            }
            if (__panelSetupProps.open) {
                open.value = true;
                return;
            }
            try {
                const res = await rpc.core.setting.getBaseInfo({});
                if (res.proxyType === '' || res.proxyType === 'close') {
                    emit();
                    return;
                }
            } catch (error) {
                emit();
                return;
            }

            const res = await getXpackProxyDocker();
            if (!res) {
                emit();
                return;
            }
            if (res.data.proxyDocker !== 'Enable') {
                emit();
                return;
            }
            open.value = true;
        };
        const onConfirm = async () => {
            ctx.emit('update:withDockerRestart', restart.value);
            ctx.emit('submit');
            open.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DialogPro
                v-model={open.value}
                title={$t('commons.msg.infoTitle')}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        open.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (onConfirm as any)($event);
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <ElForm
                    ref="formRef"
                    label-position="top"
                    onSubmit={($event?: any) => {
                        $event.preventDefault();
                    }}
                >
                    <ElFormItem label={$t('xpack.node.syncProxyHelper')}>
                        <ElRadioGroup v-model={restart.value}>
                            <ElRadio value={true}>{$t('setting.restartNow')}</ElRadio>
                            <ElRadio value={false}>{$t('setting.restartLater')}</ElRadio>
                        </ElRadioGroup>
                        {unref(restart) ? (
                            <span class={'input-help'}>{$t('xpack.node.syncProxyHelper1')}</span>
                        ) : (
                            <span class={'input-help'}>{$t('xpack.node.syncProxyHelper2')}</span>
                        )}
                    </ElFormItem>
                </ElForm>
            </DialogPro>
        );
    },
    options,
);
