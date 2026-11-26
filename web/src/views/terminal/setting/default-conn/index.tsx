import { $t } from '@/utils/i18n-t';
import { ref, reactive } from 'vue';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { decodeBase64 } from '@/utils/base64';
import { rpc } from '@/lib/rpc';
type FormInstance = InstanceType<typeof ElForm>;
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadio } from 'element-plus';
import { ElButton } from 'element-plus';
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
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
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
                {withDirectives(
                    <ElForm ref={formRef} label-position="top" model={form} rules={rules}>
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
                                modelValue={form.user}
                                onUpdate:modelValue={($v) => {
                                    form.user = $v as any;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('terminal.authMode')} prop="authMode">
                            <ElRadioGroup
                                onChange={($event?: any) => {
                                    isOK.value = false;
                                }}
                                modelValue={form.authMode}
                                onUpdate:modelValue={($v) => {
                                    form.authMode = $v as any;
                                }}
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
                                    modelValue={form.password}
                                    onUpdate:modelValue={($v) => {
                                        form.password = $v as any;
                                    }}
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
                                    modelValue={form.privateKey}
                                    onUpdate:modelValue={($v) => {
                                        form.privateKey = $v as any;
                                    }}
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
                                    modelValue={form.passPhrase}
                                    onUpdate:modelValue={($v) => {
                                        form.passPhrase = $v as any;
                                    }}
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
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
