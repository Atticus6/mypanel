import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    ipv6: string;
    bindAddress: string;
}
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
                v-model={drawerVisible.value}
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
                        <ElFormItem label={$t('setting.ipv6')} prop="ipv6" rules={Rules.requiredSelect}>
                            <ElRadioGroup
                                v-model={form.ipv6}
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
                                <ElCheckbox v-model={form.input} label={$t('container.input')} />
                                {!form.input ? (
                                    <ElSelect clearable v-model={form.bindAddress}>
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
                                    <ElInput clearable v-model={form.bindAddress} />
                                )}
                            </ElFormItem>
                        ) : (
                            <ElFormItem label={$t('setting.bindAddress')} prop="bindAddress" rules={Rules.ipV6}>
                                <ElCheckbox v-model={form.input} label={$t('container.input')} />
                                {!form.input ? (
                                    <ElSelect clearable v-model={form.bindAddress}>
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
                                    <ElInput clearable v-model={form.bindAddress} />
                                )}
                            </ElFormItem>
                        )}
                    </ElForm>
                }
            </DrawerPro>
        );
    },
    options,
);
