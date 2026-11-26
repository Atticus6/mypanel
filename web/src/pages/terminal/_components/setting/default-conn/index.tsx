import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { decodeBase64 } from '@/utils/base64';
import { rpc } from '@/lib/rpc';
type FormInstance = InstanceType<typeof ElForm>;
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'default-conn',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const isOK = ref(false);
        const drawerVisible = ref(false);
        const formRef = ref<FormInstance>();
        const form = reactive({
            user: 'root',
            addr: '127.0.0.1',
            port: 22,
            authMode: 'password',
            password: '',
            privateKey: '',
            passPhrase: '',
            isLocal: true,

            id: 0,
            name: '',
            groupID: 0,
            description: '',
            rememberPassword: false,
            localSSHConnShow: '',
        });
        const rules = reactive({
            addr: [Rules.ipV4V6OrDomain],
            user: [Rules.requiredInput],
            port: [Rules.requiredInput, Rules.port],
            authMode: [Rules.requiredSelect],
            password: [Rules.requiredInput],
            privateKey: [Rules.requiredInput],
        });
        const acceptParams = (): void => {
            search();
            drawerVisible.value = true;
        };
        const search = async () => {
            await rpc.agentSetting.getLocalConn({}).then((res) => {
                if (res.addr) {
                    form.addr = res.addr || '127.0.0.1';
                    form.port = res.port || 22;
                    form.authMode = res.authMode || 'password';
                    form.password = decodeBase64(res.password);
                    form.privateKey = decodeBase64(res.privateKey);
                    form.passPhrase = decodeBase64(res.passPhrase);
                }
            });
        };
        const handleClose = () => {
            ctx.emit('search');
            drawerVisible.value = false;
        };
        const onSave = (formEl: FormInstance) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                await rpc.agentSetting
                    .saveLocalConn(form as any)
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        drawerVisible.value = false;
                        ctx.emit('search');
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const onTest = (formEl: FormInstance) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                await rpc.agentSetting.testConnByInfo(form as any).then((res) => {
                    loading.value = false;
                    if (res.ok) {
                        isOK.value = true;
                        MsgSuccess(i18n.global.t('terminal.connTestOk'));
                    } else {
                        isOK.value = false;
                        MsgError(i18n.global.t('terminal.connTestFailed'));
                    }
                });
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={drawerVisible.value}
                header={$t('terminal.defaultConn')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    onClick={($event?: any) => {
                                        onTest(unref(formRef));
                                    }}
                                >
                                    {$t('terminal.testConn')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    disabled={!unref(isOK)}
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
                    <ElForm ref={formRef} label-position="top" model={form} rules={rules} v-loading={unref(loading)}>
                        <ElFormItem label={$t('terminal.ip')} prop="addr">
                            <ElInput
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                clearable
                                modelValue={form.addr}
                                onUpdate:modelValue={($v) => {
                                    form.addr = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('commons.login.username')} prop="user">
                            <ElInput
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                clearable
                                v-model={form.user}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('terminal.authMode')} prop="authMode">
                            <ElRadioGroup
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                v-model={form.authMode}
                            >
                                <ElRadio value="password">{$t('terminal.passwordMode')}</ElRadio>
                                <ElRadio value="key">{$t('terminal.keyMode')}</ElRadio>
                            </ElRadioGroup>
                        </ElFormItem>
                        {form.authMode === 'password' ? (
                            <ElFormItem label={$t('commons.login.password')} prop="password">
                                <ElInput
                                    onChange={($event?: any) => {
                                        isOK.value = false;
                                    }}
                                    clearable
                                    show-password
                                    type="password"
                                    v-model={form.password}
                                />
                            </ElFormItem>
                        ) : null}
                        {form.authMode === 'key' ? (
                            <ElFormItem label={$t('terminal.key')} prop="privateKey">
                                <ElInput
                                    onChange={($event?: any) => {
                                        isOK.value = false;
                                    }}
                                    clearable
                                    type="textarea"
                                    v-model={form.privateKey}
                                />
                            </ElFormItem>
                        ) : null}
                        {form.authMode === 'key' ? (
                            <ElFormItem label={$t('terminal.keyPassword')} prop="passPhrase">
                                <ElInput
                                    onChange={($event?: any) => {
                                        isOK.value = false;
                                    }}
                                    type="password"
                                    show-password
                                    clearable
                                    v-model={form.passPhrase}
                                />
                            </ElFormItem>
                        ) : null}
                        <ElFormItem label={$t('commons.table.port')} prop="port" style={'margin-top: 10px'}>
                            <ElInput
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                clearable
                                modelValue={form.port}
                                onUpdate:modelValue={($v) => {
                                    form.port = $v === '' ? $v : Number($v);
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
