import { $t } from '@/utils/i18n-t';
import { Check, Close, QuestionFilled } from '@element-plus/icons-vue';
import DrawerPro from '@/components/drawer-pro/index';
import DialogPro from '@/components/dialog-pro/index';
import type { AuthInfo, AuthInfoUpdate } from '@/utils/rbac';
import { Setting } from '@/types/setting';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import router from '@/routers';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { base64UrlToBuffer, bufferToBase64Url } from '@/utils/auth';
import { MsgError, MsgSuccess } from '@/utils/message';
import { routerToNameWithQuery } from '@/utils/router';
import { checkNumberRange, Rules } from '@/global/form-rules';
import './index.styles.css';
import { cn } from '@/utils/cn';
import CopyButton from '@/components/copy-button/index';

interface CodemodProps {
    [key: string]: any;
    currentUser?: AuthInfo;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'user-info',
    props: {
        currentUser: { type: null },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-536c91d0',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const complexityVerification = ref(false);
        const { globalStore, docsUrl, entrance } = useGlobalStore();
        const open = ref(false);
        const loading = ref(false);
        const userRef = ref<FormInstance>();
        const mfaFormRef = ref<FormInstance>();
        const mfaDialogOpen = ref(false);
        const passkeyPrereqDialogOpen = ref(false);
        const passkeyDialogOpen = ref(false);
        const savedMfaStatus = ref('');
        const qrImage = ref();
        const passkeyActiveTab = ref('keys');
        const passkeyLoading = ref(false);
        const savePasskeyProxyLoading = ref(false);
        const passkeyList = ref<Setting.PasskeyInfo[]>([]);
        const passkeyTrustedProxies = ref('');
        const hasBindDomain = ref(false);
        const passkeyPrereqBrowser = ref(false);
        const passkeyPrereqBrowserDetailKey = ref('');
        const passkeyMaxCount = 5;
        const apiURL = `${window.location.protocol}//${window.location.hostname}${
            window.location.port ? `:${window.location.port}` : ''
        }/1panel/swagger/index.html`;
        const panelURL = `${docsUrl.value}/dev_manual/api_manual/`;
        const form = reactive({
            id: 0,
            name: '',
            password: '',
            oldPassword: '',
            mfaStatus: 'Disable',
            mfaInterval: 30,
        });
        const mfaForm = reactive({
            title: '1Panel',
            code: '',
            secret: '',
            interval: 30,
        });
        const passkeyForm = reactive({
            name: '',
        });
        const isLDAPUser = computed(() => (__panelSetupProps.currentUser?.authSource || '').toLowerCase() === 'ldap');
        const passkeyPrereqBindDomain = computed(() => hasBindDomain.value);
        const passkeyPrereqHttps = computed(() => window.isSecureContext);
        const passkeyPrereqBrowserDetail = computed(() => {
            if (!passkeyPrereqBrowserDetailKey.value) {
                return '';
            }
            return i18n.global.t(passkeyPrereqBrowserDetailKey.value);
        });
        const allPasskeyPrerequisitesMet = computed(() => {
            return passkeyPrereqBindDomain.value && passkeyPrereqHttps.value && passkeyPrereqBrowser.value;
        });
        const passkeyCountText = computed(() => {
            return i18n.global.t('setting.passkeyCount', [passkeyList.value.length, passkeyMaxCount]);
        });
        const canRegisterPasskey = computed(() => {
            return (
                allPasskeyPrerequisitesMet.value &&
                passkeyList.value.length < passkeyMaxCount &&
                passkeyForm.name.trim().length > 0
            );
        });
        const validatePassword = (_rule: any, value: string, callback: any) => {
            if (!value) {
                callback();
                return;
            }
            if (value.indexOf(' ') !== -1) {
                callback(new Error(i18n.global.t('setting.noSpace')));
                return;
            }
            if (complexityVerification.value) {
                const reg = /^(?![\d]+$)(?![a-zA-Z]+$)(?![^\da-zA-Z]+$).{8,30}$/;
                if (!reg.test(value)) {
                    callback(new Error(i18n.global.t('commons.rule.complexityPassword')));
                    return;
                }
            }
            callback();
        };
        const userRules = reactive({
            name: [Rules.requiredInput, Rules.noSpace],
            oldPassword: [Rules.requiredInput],
            password: [{ validator: validatePassword, trigger: 'blur' }],
        });
        const mfaRules = reactive({
            code: [Rules.requiredInput],
            title: [Rules.requiredInput],
            interval: [Rules.number, checkNumberRange(15, 60)],
        });
        const getUserFormFields = () => {
            const fields = ['name', 'password'];
            if (form.password) {
                fields.push('oldPassword');
            }
            return fields;
        };
        const openDrawer = async () => {
            if (!__panelSetupProps.currentUser) {
                return;
            }
            loadComplexitySetting();
            syncCurrentUser(__panelSetupProps.currentUser);
            open.value = true;
        };
        const syncCurrentUser = (currentUser: AuthInfo) => {
            form.id = currentUser.id;
            form.name = currentUser.name;
            form.password = '';
            form.oldPassword = '';
            form.mfaStatus = currentUser.mfaStatus || 'Disable';
            form.mfaInterval = currentUser.mfaInterval;
            savedMfaStatus.value = form.mfaStatus;
            mfaDialogOpen.value = false;
        };
        const loadComplexitySetting = async () => {
            const res = await rpc.core.setting.getBaseInfo({});
            complexityVerification.value = res.complexityVerification === 'Enable';
        };
        const loadMfaCodeBefore = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            const validInterval = await formEl.validateField('interval', validateFieldCallback);
            if (!validInterval) {
                return;
            }
            const validTitle = await formEl.validateField('title', validateFieldCallback);
            if (!validTitle) {
                return;
            }
            loadMfaCode();
        };
        const loadMfaCode = async () => {
            const param = {
                title: mfaForm.title,
                interval: mfaForm.interval,
            };
            const res = await rpc.core.auth.getMFA(param);
            mfaForm.secret = res.secret;
            qrImage.value = res.qrImage;
        };
        function validateFieldCallback(error: any) {
            if (error) {
                return error.message;
            }
            return;
        }
        const startMfaBinding = async () => {
            mfaForm.interval = form.mfaInterval || 30;
            mfaForm.title = '1Panel-' + form.name;
            mfaForm.code = '';
            await loadMfaCode();
            mfaDialogOpen.value = true;
        };
        const handleMfaDialogClose = () => {
            mfaDialogOpen.value = false;
            form.mfaStatus = savedMfaStatus.value;
        };
        const openPasskeyDrawer = async () => {
            const settingRes = await loadPasskeySettingInfo();
            hasBindDomain.value = !!settingRes?.bindDomain?.trim().length;
            passkeyTrustedProxies.value = settingRes?.passkeyTrustedProxies || '';
            passkeyForm.name = '';
            passkeyActiveTab.value = 'keys';
            await checkPasskeyBrowserSupport();

            if (!allPasskeyPrerequisitesMet.value) {
                passkeyPrereqDialogOpen.value = true;
                return;
            }

            passkeyDialogOpen.value = true;
            await loadPasskeys();
        };
        const handlePasskeyConfigureDomain = () => {
            passkeyPrereqDialogOpen.value = false;
            passkeyDialogOpen.value = false;
            open.value = false;
            routerToNameWithQuery('Safe', { uncached: 'true' });
        };
        const handlePasskeyPrereqDialogClose = () => {
            passkeyPrereqDialogOpen.value = false;
        };
        const handlePasskeyDialogClose = () => {
            passkeyDialogOpen.value = false;
        };
        const loadPasskeySettingInfo = async () => {
            try {
                return await rpc.core.setting.getInfo({});
            } catch (error) {
                return null;
            }
        };
        const checkPasskeyBrowserSupport = async () => {
            passkeyPrereqBrowser.value = false;
            passkeyPrereqBrowserDetailKey.value = '';
            const credentialApi = window.PublicKeyCredential;
            if (!credentialApi) {
                passkeyPrereqBrowserDetailKey.value = 'setting.passkeyPrereqBrowserDetailWebAuthnUnavailable';
                return;
            }
            if (typeof credentialApi.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
                passkeyPrereqBrowserDetailKey.value = 'setting.passkeyPrereqBrowserDetailPlatformCapabilityUnavailable';
                return;
            }
            try {
                passkeyPrereqBrowser.value = await credentialApi.isUserVerifyingPlatformAuthenticatorAvailable();
                if (!passkeyPrereqBrowser.value) {
                    passkeyPrereqBrowserDetailKey.value = 'setting.passkeyPrereqBrowserDetailNoPlatformAuthenticator';
                }
            } catch (error) {
                passkeyPrereqBrowserDetailKey.value = 'setting.passkeyPrereqBrowserDetailDetectFailed';
            }
        };
        const loadPasskeys = async () => {
            passkeyLoading.value = true;
            try {
                const res = await rpc.core.auth.passkeyList({});
                passkeyList.value = res.items || [];
            } catch (error) {
                passkeyList.value = [];
            } finally {
                passkeyLoading.value = false;
            }
        };
        const registerPasskey = async () => {
            if (!allPasskeyPrerequisitesMet.value) {
                return;
            }
            if (passkeyList.value.length >= passkeyMaxCount) {
                MsgError(i18n.global.t('setting.passkeyLimit'));
                return;
            }
            if (!passkeyForm.name.trim()) {
                MsgError(i18n.global.t('commons.rule.requiredInput'));
                return;
            }
            passkeyLoading.value = true;
            try {
                const res = await rpc.core.auth.passkeyRegisterBegin({ name: passkeyForm.name.trim() });
                const publicKey = normalizePasskeyCreation(JSON.parse(res.publicKey));
                const credential = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
                if (!credential) {
                    MsgError(i18n.global.t('setting.passkeyFailed'));
                    return;
                }
                const payload = buildPasskeyAttestation(credential);
                await rpc.core.auth.passkeyRegisterFinish(
                    payload as any,
                    {
                        headers: { 'Passkey-Session': res.sessionId },
                    } as any,
                );
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                passkeyForm.name = '';
                await loadPasskeys();
            } finally {
                passkeyLoading.value = false;
            }
        };
        const removePasskey = async (id: string) => {
            ElMessageBox.confirm(i18n.global.t('setting.passkeyDeleteConfirm'), i18n.global.t('setting.passkey'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            })
                .then(async () => {
                    passkeyLoading.value = true;
                    await rpc.core.auth.passkeyDelete({ id });
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    await loadPasskeys();
                })
                .catch(() => {})
                .finally(() => {
                    passkeyLoading.value = false;
                });
        };
        const onSavePasskeyTrustedProxies = async () => {
            savePasskeyProxyLoading.value = true;
            await rpc.core.setting
                .updateSetting({ key: 'PasskeyTrustedProxies', value: passkeyTrustedProxies.value })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .finally(() => {
                    savePasskeyProxyLoading.value = false;
                });
        };
        const normalizePasskeyCreation = (publicKey: Record<string, any>): PublicKeyCredentialCreationOptions => {
            const request = { ...publicKey };
            request.challenge = base64UrlToBuffer(request.challenge);
            request.user = { ...request.user, id: base64UrlToBuffer(request.user.id) };
            if (request.excludeCredentials && Array.isArray(request.excludeCredentials)) {
                request.excludeCredentials = request.excludeCredentials.map((item) => {
                    return { ...item, id: base64UrlToBuffer(item.id) };
                });
            }
            return request as PublicKeyCredentialCreationOptions;
        };
        const buildPasskeyAttestation = (credential: PublicKeyCredential) => {
            const response = credential.response as AuthenticatorAttestationResponse;
            return {
                id: credential.id,
                rawId: bufferToBase64Url(credential.rawId),
                type: credential.type,
                response: {
                    clientDataJSON: bufferToBase64Url(response.clientDataJSON),
                    attestationObject: bufferToBase64Url(response.attestationObject),
                },
                clientExtensionResults: credential.getClientExtensionResults(),
                authenticatorAttachment: credential.authenticatorAttachment,
            };
        };
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            if (isLDAPUser.value) return;
            const valid = await formEl.validateField(getUserFormFields(), () => {});
            if (!valid) return;
            const needReLogin = form.name !== __panelSetupProps.currentUser?.name || !!form.password;
            if (needReLogin) {
                try {
                    await ElMessageBox.confirm(
                        i18n.global.t('setting.userChangeHelper'),
                        i18n.global.t('setting.userChange'),
                        {
                            confirmButtonText: i18n.global.t('commons.button.confirm'),
                            cancelButtonText: i18n.global.t('commons.button.cancel'),
                        },
                    );
                } catch {
                    return;
                }
            }
            const param: AuthInfoUpdate = {
                id: form.id,
                name: form.name,
                password: form.password,
                oldPassword: form.oldPassword,
            };
            loading.value = true;
            await rpc.core.auth
                .updateCurrentUser({ name: param.name, password: param.password, oldPassword: param.oldPassword })
                .then(async () => {
                    loading.value = false;
                    open.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    if (needReLogin) {
                        globalStore.setLogStatus(false);
                        globalStore.clearAuthInfo();
                        router.push({ name: 'entrance', params: { code: entrance.value } });
                        return;
                    }
                    ctx.emit('search');
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onBindMFA = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            const valid = await formEl.validate(() => {});
            if (!valid) return;
            const param = {
                code: mfaForm.code,
                secret: mfaForm.secret,
                interval: mfaForm.interval,
            };
            loading.value = true;
            await rpc.core.auth
                .bindMFA(param as any)
                .then(() => {
                    loading.value = false;
                    mfaDialogOpen.value = false;
                    form.mfaStatus = 'Enable';
                    savedMfaStatus.value = 'Enable';
                    ctx.emit('search');
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const handleMFA = async () => {
            if (!form.mfaStatus) {
                return;
            }
            if (form.mfaStatus === 'Enable') {
                if (savedMfaStatus.value === 'Enable') {
                    return;
                }
                await startMfaBinding();
                return;
            }
            if (savedMfaStatus.value !== 'Enable') {
                mfaDialogOpen.value = false;
                return;
            }
            ElMessageBox.confirm(i18n.global.t('setting.mfaClose'), i18n.global.t('setting.mfa'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            })
                .then(async () => {
                    loading.value = true;
                    await rpc.core.auth
                        .closeMFA({})
                        .then(async () => {
                            loading.value = false;
                            mfaDialogOpen.value = false;
                            savedMfaStatus.value = 'Disable';
                            ctx.emit('search');
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                })
                .catch(() => {
                    form.mfaStatus = 'Enable';
                });
        };
        const openApiManagement = () => {
            open.value = false;
            router.push({ path: '/settings/apikeys', query: { uncached: 'true' } });
        };
        ctx.expose({
            openDrawer,
        });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={$t('xpack.user.userInfo')}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        open.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading) || unref(isLDAPUser)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        onSubmit(unref(userRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <div>
                            {unref(isLDAPUser) ? (
                                <ElAlert
                                    title={$t('xpack.ldap.localCredentialsManaged')}
                                    type="info"
                                    closable={false}
                                    show-icon
                                    class={'mb-4'}
                                />
                            ) : null}
                            <ElForm ref={userRef} label-position="top" model={form} rules={userRules}>
                                <input
                                    type="text"
                                    name="username"
                                    autocomplete="username"
                                    tabindex="-1"
                                    class={'hidden-autofill-field'}
                                />
                                <input
                                    type="password"
                                    name="password"
                                    autocomplete="current-password"
                                    tabindex="-1"
                                    class={'hidden-autofill-field'}
                                />
                                <ElFormItem label={$t('commons.login.username')} prop="name">
                                    <ElInput
                                        type="text"
                                        modelValue={form.name}
                                        onUpdate:modelValue={($v) => {
                                            form.name = $v as any;
                                        }}
                                        name="profile-name"
                                        autocomplete="off"
                                        disabled={unref(isLDAPUser)}
                                    />
                                </ElFormItem>
                                <ElFormItem label={$t('commons.login.password')} prop="password">
                                    <ElInput
                                        type="password"
                                        show-password
                                        clearable
                                        modelValue={form.password}
                                        onUpdate:modelValue={($v) => {
                                            form.password = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        name="profile-new-password"
                                        autocomplete="new-password"
                                        disabled={unref(isLDAPUser)}
                                    />
                                    {!unref(isLDAPUser) ? (
                                        <span class={'input-help'}>{$t('setting.passwordEmptyTip')}</span>
                                    ) : null}
                                </ElFormItem>
                                {form.password && !unref(isLDAPUser) ? (
                                    <ElFormItem label={$t('setting.oldPassword')} prop="oldPassword">
                                        <ElInput
                                            type="password"
                                            show-password
                                            clearable
                                            modelValue={form.oldPassword}
                                            onUpdate:modelValue={($v) => {
                                                form.oldPassword = typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                            name="profile-old-password"
                                            autocomplete="current-password"
                                        />
                                    </ElFormItem>
                                ) : null}
                            </ElForm>
                            <ElForm label-position="top" model={form} class={'setting-section'}>
                                <ElFormItem
                                    v-slots={{
                                        label: () => (
                                            <>
                                                <span class={'label-with-help'}>
                                                    {$t('setting.mfa')}
                                                    <ElTooltip
                                                        placement="top"
                                                        v-slots={{
                                                            content: () => (
                                                                <>
                                                                    <div class={'tooltip-help-block'}>
                                                                        {$t('setting.mfaAlert')}
                                                                    </div>
                                                                    <div>{$t('setting.mfaHelper1')}</div>
                                                                    <ul class={'tooltip-help-list'}>
                                                                        <li>{'Google Authenticator'}</li>
                                                                        <li>{'Microsoft Authenticator'}</li>
                                                                        <li>{'1Password'}</li>
                                                                        <li>{'LastPass'}</li>
                                                                        <li>{'Authenticator'}</li>
                                                                    </ul>
                                                                </>
                                                            ),
                                                        }}
                                                    >
                                                        <ElIcon class={'help-icon'}>
                                                            <QuestionFilled />
                                                        </ElIcon>
                                                    </ElTooltip>
                                                </span>
                                            </>
                                        ),
                                    }}
                                >
                                    <ElSwitch
                                        onChange={($event?: any) => {
                                            (handleMFA as any)($event);
                                        }}
                                        modelValue={form.mfaStatus}
                                        onUpdate:modelValue={($v) => {
                                            form.mfaStatus = $v as any;
                                        }}
                                        active-value="Enable"
                                        inactive-value="Disable"
                                    />
                                    <span class={'input-help'}>{$t('setting.mfaHelper')}</span>
                                </ElFormItem>
                            </ElForm>
                            <ElForm label-position="top" model={form} class={'setting-section'}>
                                <ElFormItem
                                    v-slots={{
                                        label: () => (
                                            <>
                                                <span class={'label-with-help'}>
                                                    {$t('setting.passkey')}
                                                    <ElTooltip
                                                        placement="top"
                                                        v-slots={{
                                                            content: () => (
                                                                <>
                                                                    <div>{$t('setting.passkeyRequireSSL')}</div>
                                                                </>
                                                            ),
                                                        }}
                                                    >
                                                        <ElIcon class={'help-icon'}>
                                                            <QuestionFilled />
                                                        </ElIcon>
                                                    </ElTooltip>
                                                </span>
                                            </>
                                        ),
                                    }}
                                >
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (openPasskeyDrawer as any)($event);
                                        }}
                                    >
                                        {$t('setting.passkeyManage')}
                                    </ElButton>
                                    <span class={'input-help'}>{$t('setting.passkeyHelper')}</span>
                                </ElFormItem>
                            </ElForm>
                            <ElForm label-position="top" model={form} class={'setting-section'}>
                                <ElFormItem
                                    v-slots={{
                                        label: () => (
                                            <>
                                                <span class={'label-with-help'}>
                                                    {$t('setting.apiInterface')}
                                                    <ElTooltip
                                                        placement="top"
                                                        v-slots={{
                                                            content: () => (
                                                                <>
                                                                    <ul class={'tooltip-help-list'}>
                                                                        <li>{$t('setting.apiInterfaceAlert1')}</li>
                                                                        <li>{$t('setting.apiInterfaceAlert2')}</li>
                                                                        <li>
                                                                            <ElLink
                                                                                href={apiURL}
                                                                                target="_blank"
                                                                                class={'tooltip-help-link'}
                                                                            >
                                                                                {$t('setting.apiInterfaceAlert3')}
                                                                            </ElLink>
                                                                        </li>
                                                                        <li>
                                                                            <ElLink
                                                                                href={panelURL}
                                                                                target="_blank"
                                                                                class={'tooltip-help-link'}
                                                                            >
                                                                                {$t('setting.apiInterfaceAlert4')}
                                                                            </ElLink>
                                                                        </li>
                                                                    </ul>
                                                                </>
                                                            ),
                                                        }}
                                                    >
                                                        <ElIcon class={'help-icon'}>
                                                            <QuestionFilled />
                                                        </ElIcon>
                                                    </ElTooltip>
                                                </span>
                                            </>
                                        ),
                                    }}
                                >
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (openApiManagement as any)($event);
                                        }}
                                    >
                                        {$t('apiKeyManagement.manage')}
                                    </ElButton>
                                    <span class={'input-help'}>{$t('apiKeyManagement.personalEntry')}</span>
                                </ElFormItem>
                            </ElForm>
                        </div>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
                <DialogPro
                    modelValue={unref(mfaDialogOpen)}
                    onUpdate:modelValue={($v) => {
                        mfaDialogOpen.value = $v as any;
                    }}
                    title={$t('setting.mfa')}
                    size="large"
                    onClose={($event?: any) => {
                        (handleMfaDialogClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        (handleMfaDialogClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        onBindMFA(unref(mfaFormRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm
                            ref={mfaFormRef}
                            model={mfaForm}
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                            label-position="top"
                            rules={mfaRules}
                        >
                            <ElFormItem label={$t('setting.mfaHelper2')}>
                                <ElImage src={unref(qrImage)} class={'h-32 w-32'} />
                                <span class={'input-help flex items-center'}>
                                    <span>
                                        {$t('setting.secret')}
                                        {': '}
                                        {mfaForm.secret}
                                    </span>
                                    <CopyButton content={mfaForm.secret} />
                                </span>
                            </ElFormItem>
                            <ElFormItem label={$t('commons.table.title')} prop="title">
                                <ElInput
                                    modelValue={mfaForm.title}
                                    onUpdate:modelValue={($v) => {
                                        mfaForm.title = $v as any;
                                    }}
                                    v-slots={{
                                        append: () => (
                                            <>
                                                <ElButton
                                                    onClick={($event?: any) => {
                                                        loadMfaCodeBefore(unref(mfaFormRef));
                                                    }}
                                                >
                                                    {$t('commons.button.save')}
                                                </ElButton>
                                            </>
                                        ),
                                    }}
                                />
                                <span class={'input-help'}>{$t('setting.mfaTitleHelper')}</span>
                            </ElFormItem>
                            <ElFormItem label={$t('setting.mfaInterval')} prop="interval">
                                <ElInput
                                    modelValue={mfaForm.interval}
                                    onUpdate:modelValue={($v) => {
                                        mfaForm.interval = $v === '' ? $v : Number($v);
                                    }}
                                    v-slots={{
                                        append: () => (
                                            <>
                                                <ElButton
                                                    onClick={($event?: any) => {
                                                        loadMfaCodeBefore(unref(mfaFormRef));
                                                    }}
                                                >
                                                    {$t('commons.button.save')}
                                                </ElButton>
                                            </>
                                        ),
                                    }}
                                />
                                <span class={'input-help'}>{$t('setting.mfaIntervalHelper')}</span>
                            </ElFormItem>
                            <ElFormItem label={$t('setting.mfaCode')} prop="code">
                                <ElInput
                                    modelValue={mfaForm.code}
                                    onUpdate:modelValue={($v) => {
                                        mfaForm.code = $v as any;
                                    }}
                                />
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DialogPro>
                <DialogPro
                    modelValue={unref(passkeyPrereqDialogOpen)}
                    onUpdate:modelValue={($v) => {
                        passkeyPrereqDialogOpen.value = $v as any;
                    }}
                    title={$t('setting.passkey')}
                    size="small"
                    onClose={($event?: any) => {
                        (handlePasskeyPrereqDialogClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handlePasskeyPrereqDialogClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    <div class={'passkey-prereq-dialog'}>
                        <div class={'passkey-prereq-title'}>{$t('setting.passkeyPrereqTitle')}</div>
                        <div class={'passkey-prereq-list'}>
                            <div class={'passkey-prereq-item'}>
                                <ElIcon
                                    class={cn(
                                        'passkey-prereq-status',
                                        unref(passkeyPrereqBindDomain) ? 'is-ok' : 'is-missing',
                                    )}
                                >
                                    {unref(passkeyPrereqBindDomain) ? <Check /> : <Close />}
                                </ElIcon>
                                <span>{$t('setting.passkeyPrereqBindDomain')}</span>
                                {!unref(passkeyPrereqBindDomain) ? (
                                    <ElButton
                                        link
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (handlePasskeyConfigureDomain as any)($event);
                                        }}
                                    >
                                        {$t('setting.passkeyPrereqGoSetup')}
                                    </ElButton>
                                ) : null}
                            </div>
                            <div class={'passkey-prereq-item'}>
                                <ElIcon
                                    class={cn(
                                        'passkey-prereq-status',
                                        unref(passkeyPrereqHttps) ? 'is-ok' : 'is-missing',
                                    )}
                                >
                                    {unref(passkeyPrereqHttps) ? <Check /> : <Close />}
                                </ElIcon>
                                <span>{$t('setting.passkeyPrereqHttps')}</span>
                            </div>
                            <div class={'passkey-prereq-item is-browser'}>
                                <ElIcon
                                    class={cn(
                                        'passkey-prereq-status',
                                        unref(passkeyPrereqBrowser) ? 'is-ok' : 'is-missing',
                                    )}
                                >
                                    {unref(passkeyPrereqBrowser) ? <Check /> : <Close />}
                                </ElIcon>
                                <div class={'passkey-prereq-browser-copy'}>
                                    <div>{$t('setting.passkeyPrereqBrowser')}</div>
                                    {!unref(passkeyPrereqBrowser) && unref(passkeyPrereqBrowserDetail) ? (
                                        <div class={'passkey-prereq-detail'}>{unref(passkeyPrereqBrowserDetail)}</div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogPro>
                <DialogPro
                    modelValue={unref(passkeyDialogOpen)}
                    onUpdate:modelValue={($v) => {
                        passkeyDialogOpen.value = $v as any;
                    }}
                    title={$t('setting.passkey')}
                    size="large"
                    onClose={($event?: any) => {
                        (handlePasskeyDialogClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handlePasskeyDialogClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    <ElTabs
                        modelValue={unref(passkeyActiveTab)}
                        onUpdate:modelValue={($v) => {
                            passkeyActiveTab.value = $v as any;
                        }}
                    >
                        <ElTabPane label={$t('setting.passkeyKeyManagement')} name="keys">
                            <ElForm label-position="top">
                                <ElFormItem label={$t('setting.passkeyName')}>
                                    <ElInput
                                        modelValue={passkeyForm.name}
                                        onUpdate:modelValue={($v) => {
                                            passkeyForm.name = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        placeholder={$t('setting.passkeyNameHelper')}
                                        disabled={!unref(allPasskeyPrerequisitesMet)}
                                    />
                                </ElFormItem>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (registerPasskey as any)($event);
                                    }}
                                    disabled={!unref(canRegisterPasskey)}
                                >
                                    {$t('setting.passkeyAdd')}
                                </ElButton>
                                <span class={'ml-3 text-xs text-gray-500'}>{unref(passkeyCountText)}</span>
                            </ElForm>
                            {withDirectives(
                                <ElTable data={unref(passkeyList)} class={'mt-4'}>
                                    <ElTableColumn prop="name" label={$t('setting.passkeyName')} min-width="120" />
                                    <ElTableColumn
                                        prop="createdAt"
                                        label={$t('setting.passkeyCreatedAt')}
                                        min-width="160"
                                    />
                                    <ElTableColumn
                                        label={$t('setting.passkeyLastUsedAt')}
                                        min-width="160"
                                        v-slots={{
                                            default: (scope) => (
                                                <>
                                                    <span>{scope.row.lastUsedAt || '-'}</span>
                                                </>
                                            ),
                                        }}
                                    />
                                    <ElTableColumn
                                        label={$t('commons.table.operate')}
                                        width="120"
                                        v-slots={{
                                            default: (scope) => (
                                                <>
                                                    <ElButton
                                                        link
                                                        type="danger"
                                                        disabled={!unref(allPasskeyPrerequisitesMet)}
                                                        onClick={($event?: any) => {
                                                            removePasskey(scope.row.id);
                                                        }}
                                                    >
                                                        {$t('commons.button.delete')}
                                                    </ElButton>
                                                </>
                                            ),
                                        }}
                                    />
                                </ElTable>,
                                [[vLoading, unref(passkeyLoading)]],
                            )}
                        </ElTabPane>
                        <ElTabPane label={$t('app.advanced')} name="advanced">
                            <ElForm label-position="top">
                                <ElFormItem label={$t('setting.passkeyTrustedProxies')}>
                                    <div class={'flex w-full items-start gap-2'}>
                                        <ElInput
                                            modelValue={unref(passkeyTrustedProxies)}
                                            onUpdate:modelValue={($v) => {
                                                passkeyTrustedProxies.value = $v as any;
                                            }}
                                            type="textarea"
                                            rows={3}
                                        />
                                        <ElButton
                                            loading={unref(savePasskeyProxyLoading)}
                                            onClick={($event?: any) => {
                                                (onSavePasskeyTrustedProxies as any)($event);
                                            }}
                                        >
                                            {$t('commons.button.save')}
                                        </ElButton>
                                    </div>
                                    <span class={'input-help'}>{$t('setting.passkeyTrustedProxiesHelper')}</span>
                                    <span class={'input-help'}>{$t('setting.allowIPEgs')}</span>
                                </ElFormItem>
                            </ElForm>
                        </ElTabPane>
                    </ElTabs>
                </DialogPro>
            </>
        );
    },
    options,
);
