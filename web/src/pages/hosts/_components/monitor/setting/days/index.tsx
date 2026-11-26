import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { Rules } from '@/global/form-rules';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    key: string;
    monitorStoreDays: number;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
    updateSetting?: (...args: any[]) => any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'days',
    props: {
        updateSetting: {
            type: Function,
            default: (key: string, value: string) => rpc.monitor.updateSetting({ key, value }),
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const settingKey = ref<DialogProps['key']>('MonitorStoreDays');
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            monitorStoreDays: 30,
        });
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            settingKey.value = params.key;
            form.monitorStoreDays = params.monitorStoreDays;
            drawerVisible.value = true;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                await __panelSetupProps
                    .updateSetting(settingKey.value, form.monitorStoreDays + '')
                    .then(() => {
                        loading.value = false;
                        handleClose();
                        ctx.emit('search');
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={drawerVisible.value}
                header={$t('monitor.storeDays')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        onSave(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        model={form}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        v-loading={unref(loading)}
                    >
                        <ElFormItem
                            label={$t('monitor.storeDays')}
                            rules={[Rules.integerNumber]}
                            prop="monitorStoreDays"
                        >
                            <ElInput
                                clearable
                                modelValue={form.monitorStoreDays}
                                onUpdate:modelValue={($v) => {
                                    form.monitorStoreDays = $v === '' ? $v : Number($v);
                                }}
                            />
                        </ElFormItem>
                    </ElForm>
                }
            </DrawerPro>
        );
    },
    options,
);
