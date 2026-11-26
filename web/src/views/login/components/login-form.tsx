import { ArrowDown } from '@element-plus/icons-vue';
import { $t } from '@/utils/i18n-t';
import { applyPanelCacheSettings } from '@/utils/panel-cache';
import { ref, reactive, onMounted, onBeforeUnmount, computed, nextTick } from 'vue';
import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import { LoginResponseSchema } from '@/gen/panel/core/v1/auth_pb';
type Init<T extends DescMessage> = MessageInitShape<T>;
type ResLogin = Init<typeof LoginResponseSchema>;
import { MenuStore, TabsStore } from '@/store';
import { MsgError, MsgSuccess } from '@/utils/message';
import { useI18n } from 'vue-i18n';
import { encryptPassword, base64UrlToBuffer, bufferToBase64Url } from '@/utils/auth';
import { getXpackSettingForTheme } from '@/utils/xpack';
import { routerToName } from '@/utils/router';
import { Key } from '@element-plus/icons-vue';
import { changeToLocal } from '@/utils/node';
import { syncAuthInfo } from '@/utils/rbac';
import { loadMenuList } from '@/utils/menu';
import { adjustColorToRGBA } from '@/utils/color';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import { encodeBase64 } from '@/utils/base64';
import { ConnectError, Code } from '@connectrpc/connect';
type FormInstance = InstanceType<typeof ElForm>;
import './login-form.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElDropdown } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElDropdownMenu } from 'element-plus';
import { ElDropdownItem } from 'element-plus';
import { ElLink } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElText } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';
interface CodemodProps {
    [key: string]: any;
}
const emits = {
    'external-login-ready': () => true,
};
const options = {
    name: 'login-form',
    props: {},
    emits: emits,
    __scopeId: 'data-v-43ca622f',
};
export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const toLoginError = (error: unknown): { code: number; message: string } => {
            const connectError = ConnectError.from(error);
            const key = connectError.metadata.get('panel-error-key') || connectError.rawMessage;
            const code =
                connectError.code === Code.Unauthenticated
                    ? 401
                    : connectError.code === Code.InvalidArgument
                      ? 400
                      : connectError.code === Code.PermissionDenied
                        ? 403
                        : 500;
            return { code, message: key };
        };
        const i18n = useI18n();
        const {
            globalStore,
            agreeLicense,
            currentNode,
            entrance,
            ignoreCaptcha,
            isAdmin,
            isEnterprise,
            isEnterpriseLicenseLoaded,
            isIntl,
            isLogin,
            isOffline,
            isOnRestart,
            openMenuTabs,
            menuAccordion,
            themeConfig,
        } = useGlobalStore();
        const menuStore = MenuStore();
        const tabsStore = TabsStore();
        const errAuthInfo = ref(false);
        const errCaptcha = ref(false);
        const errMfaInfo = ref(false);
        const passkeySetting = ref(false);
        const passkeySupported = ref(false);
        const autoPasskeyEnabledKey = '1panel-passkey-auto-enabled';
        const showPasswordLogin = ref(false);
        const loginSource = ref<'local' | 'ldap'>('local');
        const isDemo = ref(false);
        const loginSettingsLoading = ref(true);
        const isMasterProductPro = ref(false);
        const requireCommunityLicense = computed(
            () => !isIntl.value && !isEnterprise.value && !isMasterProductPro.value,
        );
        const open = ref(false);
        const loginBtnLinkColor = ref<string | null>(null);
        let loginViewActive = true;
        const _isMobile = () => {
            const rect = document.body.getBoundingClientRect();
            return rect.width - 1 < 600;
        };
        const loginButtonFocused = ref();
        const loginFormRef = ref<FormInstance>();
        const loginForm = reactive({
            name: '',
            password: '',
            captcha: '',
            captchaID: '',
            authMethod: 'session',
            agreeLicense: false,
            language: 'zh',
        });
        const loginRules = reactive({
            name: [{ required: true, validator: checkUsername, trigger: 'blur' }],
            password: [{ required: true, validator: checkPassword, trigger: 'blur' }],
            agreeLicense: [{ required: true, validator: checkAgreeLicense, trigger: 'blur' }],
        });
        function checkUsername(rule: any, value: any, callback: any) {
            if (value === '') {
                return callback(new Error(i18n.t('commons.rule.username')));
            }
            callback();
        }
        function checkPassword(rule: any, value: any, callback: any) {
            if (value === '') {
                return callback(new Error(i18n.t('commons.rule.password')));
            }
            callback();
        }
        function checkAgreeLicense(rule: any, value: any, callback: any) {
            if (requireCommunityLicense.value && !value && !_isMobile()) {
                return callback(new Error(i18n.t('commons.login.errorAgree')));
            }
            callback();
        }
        let isLoggingIn = false;
        const userNameRef = ref();
        const mfaLoginRef = ref();
        const mfaButtonFocused = ref();
        const pendingLoginMethod = ref<'password' | 'passkey'>('password');
        const mfaLoginForm = reactive({
            sessionId: '',
            secret: '',
            code: '',
            authMethod: 'session',
        });
        const captcha = reactive({
            captchaID: '',
            imagePath: '',
            captchaLength: 0,
        });
        const loading = ref<boolean>(false);
        const mfaShow = ref<boolean>(false);
        const dropdownText = ref('中文(简体)');
        const isAutoPasskeyEnabled = () => {
            try {
                return localStorage.getItem(autoPasskeyEnabledKey) === '1';
            } catch (error) {
                return false;
            }
        };
        const enableAutoPasskey = () => {
            try {
                localStorage.setItem(autoPasskeyEnabledKey, '1');
            } catch (error) {}
        };
        const disableAutoPasskey = () => {
            try {
                localStorage.removeItem(autoPasskeyEnabledKey);
            } catch (error) {}
        };
        const languageLabelMap: Record<string, string> = {
            zh: '中文(简体)',
            en: 'English',
            'pt-BR': 'Português (Brasil)',
            'zh-Hant': '中文(繁體)',
            ko: '한국어',
            ja: '日本語',
            ru: 'Русский',
            ms: 'Bahasa Melayu',
            tr: 'Turkish',
            'es-ES': 'España - Español',
            fa: 'فارسی',
            lo: 'ພາສາລາວ',
        };
        const handleCommand = async (command: string) => {
            const activeLocale = await globalStore.updateLanguage(command);
            loginForm.language = activeLocale;
            dropdownText.value = languageLabelMap[activeLocale] || languageLabelMap.zh;
        };
        const agreeWithLogin = () => {
            open.value = false;
            loginForm.agreeLicense = true;
            if (pendingLoginMethod.value === 'passkey') {
                passkeyLogin();
                return;
            }
            login(loginFormRef.value);
        };
        const showPasskeyOnly = computed(() => {
            return passkeySetting.value && passkeySupported.value && !showPasswordLogin.value;
        });
        const switchToPasswordLogin = () => {
            loginSource.value = 'local';
            showPasswordLogin.value = true;
            nextTick(() => {
                userNameRef.value?.focus();
            });
        };
        const navigateAfterLogin = async () => {
            await routerToName('home');
        };
        const completeLogin = async (result: ResLogin) => {
            isLogin.value = true;
            agreeLicense.value = true;
            menuStore.resetMenuList();
            tabsStore.removeAllTabs();
            isAdmin.value = result.role === 'ADMIN';
            await changeToLocal();
            await syncAuthInfo(currentNode.value);
            await loadMenuList();
            MsgSuccess(i18n.t('commons.msg.loginSuccess'));
            localStorage.removeItem('dashboardCache');
            localStorage.removeItem('upgradeChecked');
            clearLoginKeydownHandler();
            await navigateAfterLogin();
        };
        const handleLoginResult = async (result: ResLogin) => {
            if (result.mfaStatus === 'Enable') {
                mfaLoginForm.sessionId = result.mfaSession || '';
                mfaLoginForm.code = '';
                mfaShow.value = true;
                errMfaInfo.value = false;
                errCaptcha.value = false;
                nextTick(() => {
                    mfaLoginRef.value?.focus();
                });
                return;
            }
            await completeLogin(result);
        };
        const login = (formEl: FormInstance | undefined) => {
            if (!formEl || isLoggingIn || loginSettingsLoading.value) return;
            errAuthInfo.value = false;
            errCaptcha.value = false;
            formEl.validate(async (valid) => {
                if (!valid) return;
                if (!requireCommunityLicense.value) {
                    loginForm.agreeLicense = true;
                }
                if (!loginForm.agreeLicense) {
                    if (_isMobile()) {
                        pendingLoginMethod.value = 'password';
                        open.value = true;
                    }
                    return;
                }
                const requestLoginForm = {
                    name: loginForm.name,
                    password: encryptPassword(loginForm.password),
                    captcha: loginForm.captcha,
                    captchaId: captcha.captchaID,
                    authSource: loginSource.value,
                    language: loginForm.language,
                    entranceCode: encodeBase64(entrance.value),
                };
                if (!ignoreCaptcha.value && requestLoginForm.captcha == '') {
                    errCaptcha.value = true;
                    return;
                }
                try {
                    isLoggingIn = true;
                    loading.value = true;
                    const res = await rpc.core.auth.login(requestLoginForm);
                    ignoreCaptcha.value = true;
                    await handleLoginResult(res);
                } catch (error) {
                    const res = toLoginError(error);
                    if (res.code === 401) {
                        if (res.message === 'ErrCaptchaCode') {
                            ignoreCaptcha.value = false;
                            loginForm.captcha = '';
                            errCaptcha.value = true;
                            errAuthInfo.value = false;
                            loginVerify();
                            return;
                        }
                        if (res.message === 'ErrAuth') {
                            ignoreCaptcha.value = false;
                            errCaptcha.value = false;
                            errAuthInfo.value = true;
                            loginVerify();
                            return;
                        }
                        MsgError(res.message);
                    }
                    loginVerify();
                } finally {
                    isLoggingIn = false;
                    loading.value = false;
                }
            });
        };
        const mfaLogin = async (auto: boolean) => {
            if (isLoggingIn) return;
            if ((!auto && mfaLoginForm.code) || (auto && mfaLoginForm.code.length === 6)) {
                isLoggingIn = true;
                try {
                    errMfaInfo.value = false;
                    const res = await rpc.core.auth.mFALogin({
                        sessionId: mfaLoginForm.sessionId,
                        code: mfaLoginForm.code,
                        entranceCode: encodeBase64(entrance.value),
                    });
                    await completeLogin(res);
                } catch (error) {
                    const res = toLoginError(error);
                    if (res.code === 401) {
                        if (res.message === 'ErrCaptchaCode') {
                            ignoreCaptcha.value = false;
                            mfaLoginForm.code = '';
                            mfaShow.value = false;
                            loginVerify();
                            nextTick(() => {
                                userNameRef.value?.focus();
                            });
                        } else if (res.message === 'ErrMFA') {
                            errMfaInfo.value = true;
                        } else if (res.message) {
                            MsgError(res.message);
                        }
                        isLoggingIn = false;
                        return;
                    }
                    loginVerify();
                } finally {
                    isLoggingIn = false;
                }
            }
        };
        const passkeyLogin = async () => {
            if (isLoggingIn || !passkeySetting.value) return;
            if (!passkeySupported.value) {
                disableAutoPasskey();
                MsgError(i18n.t('commons.login.passkeyNotSupported'));
                return;
            }
            if (requireCommunityLicense.value && !loginForm.agreeLicense) {
                if (_isMobile() || showPasskeyOnly.value) {
                    pendingLoginMethod.value = 'passkey';
                    open.value = true;
                } else {
                    MsgError(i18n.t('commons.login.errorAgree'));
                }
                return;
            }
            try {
                isLoggingIn = true;
                loading.value = true;
                const res = await rpc.core.auth.passkeyBeginLogin({});
                const publicKey = normalizePasskeyRequest(JSON.parse(res.publicKey));
                const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
                if (!credential) {
                    disableAutoPasskey();
                    MsgError(i18n.t('commons.login.passkeyFailed'));
                    return;
                }
                const payload = buildPasskeyAssertion(credential);
                const loginRes = await rpc.core.auth.passkeyFinishLogin(
                    { ...payload, sessionId: res.sessionId } as any,
                    { headers: { 'Passkey-Session': res.sessionId } } as any,
                );
                enableAutoPasskey();
                ignoreCaptcha.value = true;
                await handleLoginResult(loginRes);
            } catch (res: any) {
                disableAutoPasskey();
                if (res?.message) {
                    MsgError(i18n.t('commons.login.passkeyFailed'));
                }
            } finally {
                isLoggingIn = false;
                loading.value = false;
            }
        };
        const normalizePasskeyRequest = (publicKey: Record<string, any>): PublicKeyCredentialRequestOptions => {
            const request = { ...publicKey };
            request.challenge = base64UrlToBuffer(request.challenge);
            if (request.allowCredentials && Array.isArray(request.allowCredentials)) {
                request.allowCredentials = request.allowCredentials.map((item) => {
                    return { ...item, id: base64UrlToBuffer(item.id) };
                });
            }
            return request as PublicKeyCredentialRequestOptions;
        };
        const buildPasskeyAssertion = (credential: PublicKeyCredential) => {
            const response = credential.response as AuthenticatorAssertionResponse;
            const payload: Record<string, any> = {
                id: credential.id,
                rawId: bufferToBase64Url(credential.rawId),
                type: credential.type,
                response: {
                    clientDataJSON: bufferToBase64Url(response.clientDataJSON),
                    authenticatorData: bufferToBase64Url(response.authenticatorData),
                    signature: bufferToBase64Url(response.signature),
                },
                clientExtensionResults: credential.getClientExtensionResults(),
                authenticatorAttachment: credential.authenticatorAttachment,
            };
            if (response.userHandle) {
                payload.response.userHandle = bufferToBase64Url(response.userHandle);
            }
            return payload;
        };
        const loginVerify = async () => {
            const res = await rpc.core.auth.captcha({});
            captcha.imagePath = res.imagePath ? res.imagePath : '';
            captcha.captchaID = res.captchaId ? res.captchaId : '';
        };
        const getSetting = async () => {
            try {
                const res = await rpc.core.auth.getLoginSetting({});
                isDemo.value = res.isDemo;
                const language = res.language || loginForm.language;
                await handleCommand(language);
                isIntl.value = res.isIntl;
                isOffline.value = res.isOffline;
                isEnterprise.value = res.isEnterprise;
                isMasterProductPro.value = Boolean(res.isMasterProductPro);
                isEnterpriseLicenseLoaded.value = !res.isEnterprise;
                ignoreCaptcha.value = !res.needCaptcha;
                passkeySetting.value = res.passkeySetting;
                if (!ignoreCaptcha.value) {
                    loginVerify();
                }
                document.title = res.panelName;
                i18n.warnHtmlMessage = false;
                openMenuTabs.value = res.menuTabs === 'Enable';
                menuAccordion.value = res.menuAccordion === 'Enable';
                applyPanelCacheSettings(res.panelCache);
                themeConfig.value = { ...themeConfig.value, theme: res.theme, panelName: res.panelName };
                if (res.passkeySetting && !isIntl.value) {
                    loginForm.agreeLicense = true;
                }
                if (passkeySetting.value && passkeySupported.value && isAutoPasskeyEnabled()) {
                    passkeyLogin();
                }
            } catch (error) {
            } finally {
                loginSettingsLoading.value = false;
            }
        };
        const applyLoginButtonTheme = () => {
            loginBtnLinkColor.value = themeConfig.value.loginBtnLinkColor || '#005eeb';
            document.documentElement.style.setProperty('--login-btn-link-color', loginBtnLinkColor.value);
            document.documentElement.style.setProperty(
                '--login-btn-link-hover-color',
                adjustColorToRGBA(loginBtnLinkColor.value, -10, 80),
            );
            document.documentElement.style.setProperty(
                '--login-loading-mask-color',
                adjustColorToRGBA(loginBtnLinkColor.value, 30, 15),
            );
        };
        function loginKeydownHandler(event: KeyboardEvent) {
            const target = event.target;
            if (event.defaultPrevented || (target instanceof Element && target.closest('.external-login-button')))
                return;
            if (event.key === 'Enter' || event.keyCode === 13) {
                if (!mfaShow.value) {
                    if (!loginButtonFocused.value) {
                        login(loginFormRef.value);
                    }
                }
                if (mfaShow.value && !mfaButtonFocused.value) {
                    mfaLogin(false);
                }
            }
        }
        function clearLoginKeydownHandler() {
            if (document.onkeydown === loginKeydownHandler) {
                document.onkeydown = null;
            }
        }
        onMounted(async () => {
            isOnRestart.value = false;
            passkeySupported.value = !!window.PublicKeyCredential && window.isSecureContext;
            applyLoginButtonTheme();
            await getSetting();
            if (!loginViewActive) return;
            if (!loginViewActive || isLogin.value) return;
            try {
                await getXpackSettingForTheme();
            } catch (error) {
                // 即使获取失败也不影响登录，默认为之前的主题配置
            }
            if (!loginViewActive) return;
            applyLoginButtonTheme();
            if (!ignoreCaptcha.value) {
                loginVerify();
            }
            document.title = themeConfig.value.panelName;
            nextTick(() => {
                userNameRef.value?.focus();
            });
            loginForm.agreeLicense = agreeLicense.value;
            document.onkeydown = loginKeydownHandler;
        });
        onBeforeUnmount(() => {
            loginViewActive = false;
            clearLoginKeydownHandler();
        });
        return () =>
            withDirectives(
                <div class={'flex h-full w-full items-center justify-center px-8'}>
                    <div class={'login-form flex w-full flex-grow flex-col'}>
                        {unref(mfaShow) ? (
                            <div>
                                <ElForm
                                    onSubmit={($event?: any) => {
                                        $event.preventDefault();
                                    }}
                                >
                                    <div class={'mb-6 flex flex-col items-center justify-center'}>
                                        <div class={'text-center text-2xl font-medium text-gray-900'}>
                                            {$t('commons.login.mfaTitle')}
                                        </div>
                                    </div>
                                    <div class={'flex-grow space-y-6'}>
                                        <ElFormItem>
                                            <ElInput
                                                ref={mfaLoginRef}
                                                size="large"
                                                placeholder={$t('commons.login.mfaCode')}
                                                modelValue={mfaLoginForm.code}
                                                onUpdate:modelValue={($v) => {
                                                    mfaLoginForm.code = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                autocomplete="one-time-code"
                                                onInput={($event?: any) => {
                                                    mfaLogin(true);
                                                }}
                                            />
                                            <div class={'h-1'}>
                                                {unref(errMfaInfo) ? (
                                                    <span class={'input-error'}>
                                                        {$t('commons.login.errorMfaInfo')}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </ElFormItem>
                                        <ElFormItem>
                                            <ElButton
                                                onFocus={($event?: any) => {
                                                    mfaButtonFocused.value = true;
                                                }}
                                                onBlur={($event?: any) => {
                                                    mfaButtonFocused.value = false;
                                                }}
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    mfaLogin(false);
                                                }}
                                                class={'login-button w-full'}
                                            >
                                                {$t('commons.button.verify')}
                                            </ElButton>
                                        </ElFormItem>
                                    </div>
                                </ElForm>
                            </div>
                        ) : unref(showPasskeyOnly) ? (
                            <div>
                                <div class={'mb-6 flex items-center justify-between'}>
                                    <div class={'text-2xl font-medium text-gray-900'}>{$t('commons.button.login')}</div>
                                    <div class={'cursor-pointer'}>
                                        <ElDropdown
                                            onCommand={($event?: any) => {
                                                (handleCommand as any)($event);
                                            }}
                                            v-slots={{
                                                dropdown: () => (
                                                    <>
                                                        <ElDropdownMenu>
                                                            {unref(isIntl) ? (
                                                                <ElDropdownItem command="en">
                                                                    {'English'}
                                                                </ElDropdownItem>
                                                            ) : null}
                                                            <ElDropdownItem command="zh">{'中文(简体)'}</ElDropdownItem>
                                                            <ElDropdownItem command="zh-Hant">
                                                                {'中文(繁體)'}
                                                            </ElDropdownItem>
                                                            {!unref(isIntl) ? (
                                                                <ElDropdownItem command="en">
                                                                    {'English'}
                                                                </ElDropdownItem>
                                                            ) : null}
                                                            <ElDropdownItem command="ja">{'日本語'}</ElDropdownItem>
                                                            <ElDropdownItem command="pt-BR">
                                                                {'Português (Brasil)'}
                                                            </ElDropdownItem>
                                                            <ElDropdownItem command="ko">{'한국어'}</ElDropdownItem>
                                                            <ElDropdownItem command="ru">{'Русский'}</ElDropdownItem>
                                                            <ElDropdownItem command="ms">
                                                                {'Bahasa Melayu'}
                                                            </ElDropdownItem>
                                                            <ElDropdownItem command="tr">{'Turkish'}</ElDropdownItem>
                                                            <ElDropdownItem command="fa">{'فارسی'}</ElDropdownItem>
                                                            <ElDropdownItem command="lo">{'ພາສາລາວ'}</ElDropdownItem>
                                                        </ElDropdownMenu>
                                                    </>
                                                ),
                                            }}
                                        >
                                            <span class={'flex items-center space-x-1'}>
                                                {unref(dropdownText)}
                                                <ElIcon>
                                                    <ArrowDown />
                                                </ElIcon>
                                            </span>
                                        </ElDropdown>
                                    </div>
                                </div>
                                <div class={'space-y-6'}>
                                    <ElFormItem>
                                        <ElButton
                                            type="primary"
                                            size="default"
                                            onClick={($event?: any) => {
                                                (passkeyLogin as any)($event);
                                            }}
                                            class={'login-button w-full'}
                                        >
                                            <ElIcon class={'mr-2'}>
                                                <Key />
                                            </ElIcon>
                                            {$t('commons.login.passkey')}
                                        </ElButton>
                                    </ElFormItem>
                                    <ElFormItem>
                                        <ElLink
                                            type="primary"
                                            underline={false}
                                            onClick={($event?: any) => {
                                                (switchToPasswordLogin as any)($event);
                                            }}
                                        >
                                            {$t('commons.login.passkeyToPassword')}
                                        </ElLink>
                                    </ElFormItem>
                                    {!unref(loginSettingsLoading) && unref(requireCommunityLicense) ? (
                                        <ElFormItem>
                                            <ElCheckbox
                                                modelValue={loginForm.agreeLicense}
                                                onUpdate:modelValue={($v) => {
                                                    loginForm.agreeLicense = $v as any;
                                                }}
                                                v-slots={{
                                                    default: () => (
                                                        <>
                                                            <span class={'agree-title'}>
                                                                {$t('commons.button.agree')}
                                                                <a
                                                                    href="https://www.fit2cloud.com/legal/licenses.html"
                                                                    target="_blank"
                                                                    class={'agree'}
                                                                >
                                                                    {$t('commons.login.licenseHelper')}
                                                                </a>
                                                            </span>
                                                        </>
                                                    ),
                                                }}
                                            />
                                        </ElFormItem>
                                    ) : null}
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div class={'mb-6 flex items-center justify-between'}>
                                    <div class={'text-2xl font-medium text-gray-900'}>{$t('commons.button.login')}</div>
                                    <div class={'cursor-pointer'}>
                                        <ElDropdown
                                            onCommand={($event?: any) => {
                                                (handleCommand as any)($event);
                                            }}
                                            v-slots={{
                                                dropdown: () => (
                                                    <>
                                                        <ElDropdownMenu>
                                                            {unref(isIntl) ? (
                                                                <ElDropdownItem command="en">
                                                                    {'English'}
                                                                </ElDropdownItem>
                                                            ) : null}
                                                            <ElDropdownItem command="zh">{'中文(简体)'}</ElDropdownItem>
                                                            <ElDropdownItem command="zh-Hant">
                                                                {'中文(繁體)'}
                                                            </ElDropdownItem>
                                                            {!unref(isIntl) ? (
                                                                <ElDropdownItem command="en">
                                                                    {'English'}
                                                                </ElDropdownItem>
                                                            ) : null}
                                                            <ElDropdownItem command="ja">{'日本語'}</ElDropdownItem>
                                                            <ElDropdownItem command="pt-BR">
                                                                {'Português (Brasil)'}
                                                            </ElDropdownItem>
                                                            <ElDropdownItem command="ko">{'한국어'}</ElDropdownItem>
                                                            <ElDropdownItem command="ru">{'Русский'}</ElDropdownItem>
                                                            <ElDropdownItem command="ms">
                                                                {'Bahasa Melayu'}
                                                            </ElDropdownItem>
                                                            <ElDropdownItem command="tr">{'Turkish'}</ElDropdownItem>
                                                            <ElDropdownItem command="fa">{'فارسی'}</ElDropdownItem>
                                                            <ElDropdownItem command="lo">{'ພາສາລາວ'}</ElDropdownItem>
                                                        </ElDropdownMenu>
                                                    </>
                                                ),
                                            }}
                                        >
                                            <span class={'flex items-center space-x-1'}>
                                                {unref(dropdownText)}
                                                <ElIcon>
                                                    <ArrowDown />
                                                </ElIcon>
                                            </span>
                                        </ElDropdown>
                                    </div>
                                </div>
                                <ElForm ref={loginFormRef} model={loginForm} size="default" rules={loginRules}>
                                    <div class={'flex-grow space-y-6'}>
                                        <ElFormItem prop="name" class={'w-full'}>
                                            <ElInput
                                                modelValue={loginForm.name}
                                                onUpdate:modelValue={($v) => {
                                                    loginForm.name = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                placeholder={$t('commons.login.username')}
                                                size="large"
                                                name="username"
                                                autocomplete="username"
                                                ref={userNameRef}
                                                class={'w-full'}
                                            />
                                        </ElFormItem>
                                        <ElFormItem prop="password" class={'w-full'}>
                                            <ElInput
                                                type="password"
                                                show-password
                                                modelValue={loginForm.password}
                                                onUpdate:modelValue={($v) => {
                                                    loginForm.password = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                size="large"
                                                placeholder={$t('commons.login.password')}
                                                name="password"
                                                autocomplete="current-password"
                                                class={'w-full'}
                                            />
                                        </ElFormItem>
                                        <ElRow gutter={10}>
                                            {!unref(ignoreCaptcha) ? (
                                                <ElCol span={12}>
                                                    <ElFormItem prop="captcha">
                                                        <ElInput
                                                            modelValue={loginForm.captcha}
                                                            onUpdate:modelValue={($v) => {
                                                                loginForm.captcha =
                                                                    typeof $v === 'string' ? $v.trim() : $v;
                                                            }}
                                                            size="large"
                                                            placeholder={$t('commons.login.captchaHelper')}
                                                        />
                                                    </ElFormItem>
                                                </ElCol>
                                            ) : null}
                                            {!unref(ignoreCaptcha) ? (
                                                <ElCol span={12}>
                                                    {captcha.imagePath ? (
                                                        <img
                                                            src={captcha.imagePath}
                                                            alt={$t('commons.login.captchaHelper')}
                                                            onClick={($event?: any) => {
                                                                loginVerify();
                                                            }}
                                                            class={'h-10 w-full'}
                                                        />
                                                    ) : null}
                                                </ElCol>
                                            ) : null}
                                            <ElCol span={24} class={'h-0.5'}>
                                                <span
                                                    class={'input-error'}
                                                    style={[{}, { display: unref(errCaptcha) ? '' : 'none' }]}
                                                >
                                                    {$t('commons.login.errorCaptcha')}
                                                </span>
                                                <span
                                                    class={'input-error'}
                                                    style={[{}, { display: unref(errAuthInfo) ? '' : 'none' }]}
                                                >
                                                    {$t('commons.login.errorAuthInfo')}
                                                </span>
                                            </ElCol>
                                        </ElRow>
                                        <ElFormItem>
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    login(unref(loginFormRef));
                                                }}
                                                onFocus={($event?: any) => {
                                                    loginButtonFocused.value = true;
                                                }}
                                                onBlur={($event?: any) => {
                                                    loginButtonFocused.value = false;
                                                }}
                                                type="primary"
                                                size="default"
                                                disabled={unref(loginSettingsLoading)}
                                                class={'login-button w-full'}
                                            >
                                                {$t('commons.button.login')}
                                            </ElButton>
                                        </ElFormItem>
                                        {unref(isDemo) ? (
                                            <ElText type="danger" class={'demo'}>
                                                {$t('commons.login.username')}
                                                {':demo '}
                                                {$t('commons.login.password')}
                                                {':1panel '}
                                            </ElText>
                                        ) : null}
                                        {!unref(loginSettingsLoading) && unref(requireCommunityLicense) ? (
                                            <ElFormItem prop="agreeLicense">
                                                <ElCheckbox
                                                    modelValue={loginForm.agreeLicense}
                                                    onUpdate:modelValue={($v) => {
                                                        loginForm.agreeLicense = $v as any;
                                                    }}
                                                    v-slots={{
                                                        default: () => (
                                                            <>
                                                                <span class={'agree-title'}>
                                                                    {$t('commons.button.agree')}
                                                                    <a
                                                                        href="https://www.fit2cloud.com/legal/licenses.html"
                                                                        target="_blank"
                                                                        class={'agree'}
                                                                    >
                                                                        {$t('commons.login.licenseHelper')}
                                                                    </a>
                                                                </span>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            </ElFormItem>
                                        ) : null}
                                    </div>
                                </ElForm>
                            </div>
                        )}
                        <DialogPro
                            modelValue={unref(open)}
                            onUpdate:modelValue={($v) => {
                                open.value = $v as any;
                            }}
                            center
                            size="w-90"
                            v-slots={{
                                footer: () => (
                                    <>
                                        <span class={'dialog-footer login-footer-btn'}>
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    open.value = false;
                                                }}
                                            >
                                                {$t('commons.button.notAgree')}
                                            </ElButton>
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    agreeWithLogin();
                                                }}
                                            >
                                                {$t('commons.button.agree')}
                                            </ElButton>
                                        </span>
                                    </>
                                ),
                            }}
                        >
                            <ElRow type="flex" justify="center">
                                <span class={'mb-4 text-base'}>{$t('commons.login.agreeTitle')}</span>
                            </ElRow>
                            <div>
                                <span innerHTML={$t('commons.login.agreeContent')} />
                            </div>
                        </DialogPro>
                    </div>
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
