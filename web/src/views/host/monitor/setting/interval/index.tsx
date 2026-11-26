import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { FormInstance } from 'element-plus';
import { Rules } from '@/global/form-rules';
import { transferTimeToSecond } from '@/utils/validate';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    key: string;
    timeItem: number;
    timeUnit: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElButton } from 'element-plus';
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
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
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
                {withDirectives(
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        model={form}
                        rules={rules}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
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
                                                modelValue={form.timeUnit}
                                                onUpdate:modelValue={($v) => {
                                                    form.timeUnit = $v as any;
                                                }}
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
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
