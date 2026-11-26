import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { Rules } from '@/global/form-rules';
import { transferTimeToSecond } from '@/utils/validate';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    key: string;
    timeItem: number;
    timeUnit: string;
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
    name: 'interval',
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
        const settingKey = ref<DialogProps['key']>('MonitorInterval');
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            timeItem: 5,
            timeUnit: 'h',
            monitorInterval: 300,
        });
        const verifyInterval = (rule: any, value: any, callback: any) => {
            if (value < 10 || value > 43200) {
                callback(new Error(i18n.global.t('monitor.intervalHelper')));
                return;
            }
            callback();
        };
        const rules = reactive({
            monitorInterval: [Rules.integerNumber, { validator: verifyInterval, trigger: 'blur', required: true }],
        });
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            settingKey.value = params.key;
            form.timeItem = params.timeItem;
            form.timeUnit = params.timeUnit;
            loadInterval();
            drawerVisible.value = true;
        };
        const loadInterval = () => {
            form.monitorInterval = transferTimeToSecond(form.timeItem + form.timeUnit);
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                await __panelSetupProps
                    .updateSetting(settingKey.value, form.monitorInterval + '')
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
                header={$t('monitor.interval')}
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
                        rules={rules}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        v-loading={unref(loading)}
                    >
                        <ElFormItem label={$t('monitor.interval')} prop="monitorInterval">
                            <ElInput
                                type="number"
                                onInput={($event?: any) => {
                                    loadInterval();
                                }}
                                modelValue={form.timeItem}
                                onUpdate:modelValue={($v) => {
                                    form.timeItem = $v === '' ? $v : Number($v);
                                }}
                                class={'selectClass'}
                                v-slots={{
                                    append: () => (
                                        <>
                                            <ElSelect
                                                v-model={form.timeUnit}
                                                onChange={($event?: any) => {
                                                    (loadInterval as any)($event);
                                                }}
                                                style={'width: 80px'}
                                            >
                                                <ElOption label={$t('commons.units.second')} value="s" />
                                                <ElOption label={$t('commons.units.minute')} value="m" />
                                                <ElOption label={$t('commons.units.hour')} value="h" />
                                            </ElSelect>
                                        </>
                                    ),
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
