import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { ElMessageBox, FormInstance } from 'element-plus';
import { Rules } from '@/global/form-rules';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    ipv6: string;
    bindAddress: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadio } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'bind',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { entrance, isLogin } = useGlobalStore();
        const drawerVisible = ref();
        const loading = ref();
        const interfaceOptions = ref();
        const form = reactive({
            ipv6: '',
            bindAddress: '',
            input: false,
        });
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            form.ipv6 = params.ipv6;
            form.bindAddress = params.bindAddress;
            loadInterface();
            drawerVisible.value = true;
        };
        const loadInterface = async () => {
            const res = await rpc.core.setting.getInterface({});
            interfaceOptions.value = res.addrs || [];
        };
        const onChangeMode = () => {
            form.bindAddress = form.ipv6 === 'Enable' ? '::' : '0.0.0.0';
        };
        const onSavePort = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                ElMessageBox.confirm(i18n.global.t('setting.bindInfoHelper'), i18n.global.t('setting.bindInfo'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                }).then(async () => {
                    loading.value = true;
                    await rpc.core.setting
                        .updateBindInfo({ ipv6: form.ipv6, bindAddress: form.bindAddress })
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            isLogin.value = false;
                            let href = window.location.href;
                            let address = '';
                            if (entrance.value) {
                                address = href.replaceAll('settings/safe', entrance.value);
                            } else {
                                address = href.replaceAll('settings/safe', 'login');
                            }
                            window.open(address, '_self');
                        })
                        .catch(() => {
                            loading.value = false;
                        });
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
                header={$t('setting.bindInfo')}
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
                                        onSavePort(unref(formRef));
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
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElFormItem label={$t('setting.ipv6')} prop="ipv6" rules={Rules.requiredSelect}>
                            <ElRadioGroup
                                modelValue={form.ipv6}
                                onUpdate:modelValue={($v) => {
                                    form.ipv6 = $v as any;
                                }}
                                onChange={($event?: any) => {
                                    onChangeMode();
                                }}
                                style={'width: 100%'}
                            >
                                <ElRadio value="Enable">{$t('commons.button.enable')}</ElRadio>
                                <ElRadio value="Disable">{$t('commons.button.disable')}</ElRadio>
                            </ElRadioGroup>
                        </ElFormItem>
                        {form.ipv6 === 'Disable' ? (
                            <ElFormItem label={$t('setting.bindAddress')} prop="bindAddress" rules={Rules.ip}>
                                <ElCheckbox
                                    modelValue={form.input}
                                    onUpdate:modelValue={($v) => {
                                        form.input = $v as any;
                                    }}
                                    label={$t('container.input')}
                                />
                                {!form.input ? (
                                    <ElSelect
                                        clearable
                                        modelValue={form.bindAddress}
                                        onUpdate:modelValue={($v) => {
                                            form.bindAddress = $v as any;
                                        }}
                                    >
                                        <ElOption value="0.0.0.0" label="0.0.0.0" />
                                        {(unref(interfaceOptions) || []).map((item) => (
                                            <div key={item}>
                                                {item.indexOf(':') === -1 ? (
                                                    <ElOption value={item} label={item} />
                                                ) : null}
                                            </div>
                                        ))}
                                    </ElSelect>
                                ) : (
                                    <ElInput
                                        clearable
                                        modelValue={form.bindAddress}
                                        onUpdate:modelValue={($v) => {
                                            form.bindAddress = $v as any;
                                        }}
                                    />
                                )}
                            </ElFormItem>
                        ) : (
                            <ElFormItem label={$t('setting.bindAddress')} prop="bindAddress" rules={Rules.ipV6}>
                                <ElCheckbox
                                    modelValue={form.input}
                                    onUpdate:modelValue={($v) => {
                                        form.input = $v as any;
                                    }}
                                    label={$t('container.input')}
                                />
                                {!form.input ? (
                                    <ElSelect
                                        clearable
                                        modelValue={form.bindAddress}
                                        onUpdate:modelValue={($v) => {
                                            form.bindAddress = $v as any;
                                        }}
                                    >
                                        <ElOption value="::" label="::" />
                                        {(unref(interfaceOptions) || []).map((item) => (
                                            <div key={item}>
                                                {item.indexOf(':') !== -1 ? (
                                                    <ElOption value={item} label={item} />
                                                ) : null}
                                            </div>
                                        ))}
                                    </ElSelect>
                                ) : (
                                    <ElInput
                                        clearable
                                        modelValue={form.bindAddress}
                                        onUpdate:modelValue={($v) => {
                                            form.bindAddress = $v as any;
                                        }}
                                    />
                                )}
                            </ElFormItem>
                        )}
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
