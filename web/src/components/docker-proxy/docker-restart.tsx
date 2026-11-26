import { $t } from '@/utils/i18n-t';
interface DialogProps {
    title: string;
}
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    'update:withDockerRestart': (...args: unknown[]) => true,
    submit: (...args: unknown[]) => true,
};

type SlotsShape = {
    helper: (arg?: unknown) => VNode[];
};

const options = {
    name: 'docker-restart',
    props: {},
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const title = ref();
        const restart = ref(true);
        const acceptParams = async (params: DialogProps): Promise<void> => {
            title.value = params.title;
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
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
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
                    <ElFormItem label={unref(title)}>
                        <ElRadioGroup
                            modelValue={unref(restart)}
                            onUpdate:modelValue={($v) => {
                                restart.value = $v as any;
                            }}
                        >
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
                {ctx.slots['helper']?.(undefined)}
            </DialogPro>
        );
    },
    options,
);
