import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { FormInstance } from 'element-plus';
import { reactive, ref } from 'vue';
import { encodeBase64Fields } from '@/utils/base64';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import ConfirmDialog from '@/components/confirm-dialog/index';
import DockerProxyDialog from '@/components/docker-proxy/dialog';
interface DialogProps {
    url: string;
    type: string;
    port: string;
    user: string;
    passwd: string;
    passwdKeep: string;
    proxyDocker: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'proxy',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isXpackOrEE } = useGlobalStore();
        const confirmDialogRef = ref();
        const formRef = ref<FormInstance>();
        const rules = reactive({
            proxyType: [Rules.requiredSelect],
            proxyUrl: [Rules.noSpace, Rules.requiredInput],
            proxyPortItem: [Rules.port],
        });
        const loading = ref(false);
        const proxyVisible = ref<boolean>(false);
        const proxyDockerVisible = ref<boolean>(false);
        const form = reactive({
            proxyUrl: '',
            proxyType: '',
            proxyPort: '',
            proxyPortItem: 7890,
            proxyUser: '',
            proxyPasswd: '',
            proxyPasswdKeep: '',
            proxyPasswdKeepItem: false,
            proxyDocker: false,
        });
        const dockerStatus = ref();
        const withDockerRestart = ref(false);
        const dockerProxyRef = ref();
        const acceptParams = (params: DialogProps): void => {
            if (params.url) {
                if (params.type === 'http' || params.type === 'https') {
                    form.proxyUrl = params.url.replaceAll(params.type + '://', '');
                } else {
                    form.proxyUrl = params.url;
                }
            } else {
                form.proxyUrl = '127.0.0.1';
            }
            form.proxyType = params.type || 'close';
            form.proxyPortItem = params.port ? Number(params.port) : 7890;
            form.proxyUser = params.user;
            form.proxyPasswd = params.passwd;
            form.proxyDocker = params.proxyDocker === 'Enable';
            proxyDockerVisible.value = params.proxyDocker === 'Enable';
            proxyVisible.value = true;
            form.proxyPasswdKeepItem = params.passwdKeep === 'Enable';
            loadDocker();
        };
        const loadDocker = async () => {
            const res = await rpc.container.getDockerStatus({});
            dockerStatus.value = res.isExist;
        };
        const submitChangePassword = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                let isClose = form.proxyType === '' || form.proxyType === 'close';
                let params = {
                    proxyType: isClose ? '' : form.proxyType,
                    proxyUrl: isClose ? '' : form.proxyUrl,
                    proxyPort: isClose ? '' : form.proxyPortItem + '',
                    proxyUser: isClose ? '' : form.proxyUser,
                    proxyPasswd: isClose ? '' : form.proxyPasswd,
                    proxyPasswdKeep: '',
                    proxyDocker: isClose ? false : form.proxyDocker,
                    withDockerRestart: false,
                };
                if (!isClose) {
                    params.proxyPasswdKeep = form.proxyPasswdKeepItem ? 'Enable' : 'Disable';
                }
                if (form.proxyType === 'http' || form.proxyType === 'https') {
                    params.proxyUrl = form.proxyUrl;
                }
                if (dockerStatus.value && isXpackOrEE.value && (params.proxyDocker || proxyDockerVisible.value)) {
                    dockerProxyRef.value.acceptParams({
                        syncList: 'SyncSystemProxy',
                        open: true,
                    });
                } else {
                    loading.value = true;
                    await submitProxy(params)
                        .then(async () => {
                            loading.value = false;
                            ctx.emit('search');
                            proxyVisible.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                }
            });
        };
        const submitProxy = async (params: any) => {
            const request = { ...params };
            encodeBase64Fields(request, ['proxyPasswd']);
            request.proxyType = request.proxyType === 'close' ? '' : request.proxyType;
            await rpc.core.setting.updateProxy(request);
        };
        const onSubmit = async () => {
            try {
                loading.value = true;
                let isClose = form.proxyType === '' || form.proxyType === 'close';
                let params = {
                    proxyType: isClose ? '' : form.proxyType,
                    proxyUrl: isClose ? '' : form.proxyUrl,
                    proxyPort: isClose ? '' : form.proxyPortItem + '',
                    proxyUser: isClose ? '' : form.proxyUser,
                    proxyPasswd: isClose ? '' : form.proxyPasswd,
                    proxyPasswdKeep: '',
                    proxyDocker: isClose ? false : form.proxyDocker,
                    withDockerRestart: withDockerRestart.value,
                };
                if (!isClose) {
                    params.proxyPasswdKeep = form.proxyPasswdKeepItem ? 'Enable' : 'Disable';
                }
                if (form.proxyType === 'http' || form.proxyType === 'https') {
                    params.proxyUrl = form.proxyUrl;
                }
                await submitProxy(params);
                ctx.emit('search');
                handleClose();
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } finally {
                loading.value = false;
            }
        };
        const handleClose = () => {
            proxyVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(proxyVisible)}
                    onUpdate:modelValue={($v) => {
                        proxyVisible.value = $v as any;
                    }}
                    header={$t('setting.proxy')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        proxyVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submitChangePassword(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm ref={formRef} label-position="top" model={form} rules={rules}>
                            <ElAlert
                                closable={false}
                                type="warning"
                                class={'common-prompt'}
                                v-slots={{
                                    default: () => (
                                        <>
                                            {$t('setting.proxyHelper')}
                                            <ul class={'-ml-5'}>
                                                <li>{$t('setting.proxyHelper1')}</li>
                                                <li>{$t('setting.proxyHelper5')}</li>
                                                <li>{$t('setting.proxyHelper2')}</li>
                                                <li>{$t('setting.proxyHelper4')}</li>
                                                <li>{$t('setting.proxyHelper6')}</li>
                                                <li>{$t('setting.proxyHelper3')}</li>
                                            </ul>
                                        </>
                                    ),
                                }}
                            />
                            <ElFormItem label={$t('setting.proxyType')} prop="proxyType">
                                <ElSelect
                                    modelValue={form.proxyType}
                                    onUpdate:modelValue={($v) => {
                                        form.proxyType = $v as any;
                                    }}
                                    clearable
                                >
                                    <ElOption value="close" label={$t('commons.button.close')} />
                                    <ElOption value="socks5" label="SOCKS5" />
                                    <ElOption value="http" label="HTTP" />
                                    <ElOption value="https" label="HTTPS" />
                                </ElSelect>
                            </ElFormItem>
                            {form.proxyType !== 'close' ? (
                                <div>
                                    <ElFormItem label={$t('setting.proxyUrl')} prop="proxyUrl">
                                        {form.proxyType == 'http' || form.proxyType === 'https' ? (
                                            <ElInput
                                                clearable
                                                modelValue={form.proxyUrl}
                                                onUpdate:modelValue={($v) => {
                                                    form.proxyUrl = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                v-slots={{
                                                    prepend: () => (
                                                        <>
                                                            <span>{form.proxyType}</span>
                                                        </>
                                                    ),
                                                }}
                                            />
                                        ) : (
                                            <ElInput
                                                clearable
                                                modelValue={form.proxyUrl}
                                                onUpdate:modelValue={($v) => {
                                                    form.proxyUrl = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                            />
                                        )}
                                    </ElFormItem>
                                    <ElFormItem label={$t('setting.proxyPort')} prop="proxyPortItem">
                                        <ElInput
                                            clearable
                                            type="number"
                                            modelValue={form.proxyPortItem}
                                            onUpdate:modelValue={($v) => {
                                                form.proxyPortItem = $v === '' ? $v : Number($v);
                                            }}
                                        />
                                    </ElFormItem>
                                    <ElFormItem label={$t('commons.login.username')} prop="proxyUser">
                                        <ElInput
                                            clearable
                                            modelValue={form.proxyUser}
                                            onUpdate:modelValue={($v) => {
                                                form.proxyUser = typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                    <ElFormItem label={$t('commons.login.password')} prop="proxyPasswd">
                                        <ElInput
                                            type="password"
                                            show-password
                                            clearable
                                            modelValue={form.proxyPasswd}
                                            onUpdate:modelValue={($v) => {
                                                form.proxyPasswd = typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                        />
                                    </ElFormItem>
                                    <ElFormItem>
                                        <ElCheckbox
                                            modelValue={form.proxyPasswdKeepItem}
                                            onUpdate:modelValue={($v) => {
                                                form.proxyPasswdKeepItem = $v as any;
                                            }}
                                            label={$t('setting.proxyPasswdKeep')}
                                        />
                                    </ElFormItem>
                                    {unref(isXpackOrEE) ? (
                                        <ElFormItem label={$t('setting.proxyDocker')} prop="proxyDocker">
                                            <ElCheckbox
                                                modelValue={form.proxyDocker}
                                                onUpdate:modelValue={($v) => {
                                                    form.proxyDocker = $v as any;
                                                }}
                                                label={$t('setting.proxyDocker')}
                                            />
                                            <span class={'input-help'}>{$t('setting.proxyDockerHelper')}</span>
                                        </ElFormItem>
                                    ) : null}
                                </div>
                            ) : null}
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
                <ConfirmDialog
                    ref={confirmDialogRef}
                    onConfirm={($event?: any) => {
                        (onSubmit as any)($event);
                    }}
                />
                <DockerProxyDialog
                    ref={dockerProxyRef}
                    onSubmit={($event?: any) => {
                        (onSubmit as any)($event);
                    }}
                    with-docker-restart={unref(withDockerRestart)}
                    onUpdate:with-docker-restart={($v) => {
                        withDockerRestart.value = $v as any;
                    }}
                />
            </>
        );
    },
    options,
);
