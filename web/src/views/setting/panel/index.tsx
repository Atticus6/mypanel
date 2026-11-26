import { $t } from '@/utils/i18n-t';
import { applyPanelCacheSettings } from '@/utils/panel-cache';
import { ref, reactive, onMounted } from 'vue';
import { ElForm, ElMessageBox } from 'element-plus';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { useTheme } from '@/global/use-theme';
import { MsgSuccess } from '@/utils/message';
import ThemeColor from '@/views/setting/panel/theme-color/index';
import Watermark from '@/views/setting/panel/watermark/index';
import Edition from '@/views/setting/panel/edition/index';
import Timeout from '@/views/setting/panel/timeout/index';
import PanelName from '@/views/setting/panel/name/index';
import SystemIP from '@/views/setting/panel/systemip/index';
import Proxy from '@/views/setting/panel/proxy/index';
import CacheSettings from '@/views/setting/panel/cache/index';
import HideMenu from '@/views/setting/panel/hidemenu/index';
import { getXpackProxyDocker } from '@/extensions/xpack';
import { getXpackSetting, updateXpackSettingByKey } from '@/utils/xpack';
import { setPrimaryColor } from '@/utils/theme';
import { codeEditorThemeStorageKey } from '@/utils/code-editor-theme';
import i18n from '@/lang';
interface ThemeColor {
    light: string;
    dark: string;
    themePredefineColors: {
        light: string[];
        dark: string[];
    };
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadioButton } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElInput } from 'element-plus';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'panel',
    props: {},
    emits: emits,
    __scopeId: 'data-v-f6001c4e',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const {
            docWithRegion,
            globalStore,
            isEnterprise,
            isIntl,
            isMobile,
            isXpackOrEE,
            menuAccordion,
            openMenuTabs,
            themeConfig,
            watermark,
            watermarkShow,
        } = useGlobalStore();
        const loading = ref(false);
        const { switchTheme } = useTheme();
        const form = reactive({
            panelName: '',
            theme: '',
            watermark: '',
            watermarkShow: '',
            themeColor: {} as ThemeColor,
            menuTabs: '',
            menuAccordion: '',
            language: '',
            sessionTimeout: 0,
            docSource: 'withByRegion',
            edition: '',
            developerMode: '',
            systemIP: '',

            proxyShow: '',
            proxyUrl: '',
            proxyType: '',
            proxyPort: '',
            proxyUser: '',
            proxyPasswd: '',
            proxyPasswdKeep: '',
            proxyDocker: '',

            hideMenu: '',
        });
        const show = ref();
        const panelNameRef = ref();
        const systemIPRef = ref();
        const proxyRef = ref();
        const timeoutRef = ref();
        const hideMenuRef = ref();
        const cacheRef = ref();
        const watermarkRef = ref();
        const themeColorRef = ref();
        const editionRef = ref();
        const unset = ref(i18n.global.t('setting.unSetting'));
        const languageOptions = ref([
            { value: 'zh', label: '中文(简体)' },
            { value: 'zh-Hant', label: '中文(繁體)' },
            ...(!isIntl.value ? [{ value: 'en', label: 'English' }] : []),
            { value: 'ja', label: '日本語' },
            { value: 'pt-BR', label: 'Português (Brasil)' },
            { value: 'ko', label: '한국어' },
            { value: 'ru', label: 'Русский' },
            { value: 'ms', label: 'Bahasa Melayu' },
            { value: 'tr', label: 'Turkish' },
            { value: 'es-ES', label: 'España - Español' },
            { value: 'fa', label: 'فارسی' },
            { value: 'lo', label: 'ພາສາລາວ' },
        ]);
        if (isIntl.value) {
            languageOptions.value.unshift({ value: 'en', label: 'English' });
        }
        const search = async () => {
            const agentRes = await rpc.agentSetting.getInfo({});
            form.systemIP = agentRes.systemIp;

            const res = await rpc.core.setting.getInfo({});
            form.theme = res.theme;
            form.menuTabs = res.menuTabs;
            form.menuAccordion = res.menuAccordion || 'Disable';
            menuAccordion.value = form.menuAccordion === 'Enable';
            applyPanelCacheSettings(res.panelCache);
            form.panelName = res.panelName;
            form.language = res.language;
            form.sessionTimeout = Number(res.sessionTimeout || 0);
            form.docSource = res.docSource || 'withByRegion';
            form.edition = res.edition;
            docWithRegion.value = form.docSource === 'withByRegion';
            isIntl.value = form.edition === 'intl';

            form.proxyUrl = res.proxyUrl;
            form.proxyType = res.proxyType;
            form.proxyPort = res.proxyPort;
            form.proxyShow = form.proxyUrl ? form.proxyUrl + ':' + form.proxyPort : unset.value;
            form.proxyUser = res.proxyUser;
            form.proxyPasswd = res.proxyPasswd;
            form.proxyPasswdKeep = res.proxyPasswdKeep;

            form.developerMode = res.developerMode;
            form.hideMenu = res.hideMenu;

            if (isXpackOrEE.value) {
                const [xpackRes, proxyDockerRes] = await Promise.all([
                    getXpackSetting(),
                    getXpackProxyDocker().catch(() => null),
                ]);
                if (xpackRes) {
                    form.theme = xpackRes.data.theme || themeConfig.value.theme || 'light';
                    form.themeColor = JSON.parse(xpackRes.data.themeColor || '{"light":"#005eeb","dark":"#F0BE96"}');
                    themeConfig.value.themeColor = xpackRes.data.themeColor
                        ? xpackRes.data.themeColor
                        : '{"light":"#005eeb","dark":"#F0BE96"}';
                    themeConfig.value.theme = form.theme;
                    form.watermark = xpackRes.data.watermark;
                    form.watermarkShow = xpackRes.data.watermarkShow;
                    try {
                        watermark.value = JSON.parse(xpackRes.data.watermark);
                    } catch {
                        watermark.value = null;
                    }
                }
                form.proxyDocker = proxyDockerRes?.data?.proxyDocker || '';
            } else {
                themeConfig.value.theme = form.theme;
            }
        };
        const onChangeTitle = () => {
            panelNameRef.value.acceptParams({ panelName: form.panelName });
        };
        const onChangeTimeout = () => {
            timeoutRef.value.acceptParams({ sessionTimeout: form.sessionTimeout });
        };
        const onChangeSystemIP = () => {
            systemIPRef.value.acceptParams({ systemIP: form.systemIP });
        };
        const onChangeProxy = () => {
            proxyRef.value.acceptParams({
                url: form.proxyUrl,
                type: form.proxyType,
                port: form.proxyPort,
                user: form.proxyUser,
                passwd: form.proxyPasswd,
                passwdKeep: form.proxyPasswdKeep,
                proxyDocker: form.proxyDocker,
            });
        };
        const onChangeHideMenus = () => {
            hideMenuRef.value.acceptParams({
                hideMenu: form.hideMenu,
                menuAccordion: form.menuAccordion,
            });
        };
        const onChangeRegion = () => {
            editionRef.value.acceptParams({ edition: form.edition, docSource: form.docSource });
        };
        const runtimeEnvLabel = () => {
            const editionLabel = form.edition === 'cn' ? i18n.global.t('setting.cn') : i18n.global.t('setting.intl');
            const docSourceLabel = i18n.global.t(`setting.${form.docSource || 'withByRegion'}`);
            return `${editionLabel} / ${docSourceLabel}`;
        };
        const onChangeThemeColor = () => {
            const themeColor: ThemeColor = JSON.parse(themeConfig.value.themeColor);
            themeColorRef.value.acceptParams({ themeColor: themeColor, theme: themeConfig.value.theme });
        };
        const onChangeWatermark = async () => {
            if (form.watermarkShow === 'Enable') {
                watermarkRef.value.acceptParams(form.watermark);
                return;
            }
            ElMessageBox.confirm(i18n.global.t('setting.watermarkCloseHelper'), i18n.global.t('setting.watermark'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            })
                .then(async () => {
                    loading.value = true;
                    await updateXpackSettingByKey('WatermarkShow', 'Disable')
                        .then(() => {
                            loading.value = false;
                            watermark.value = null;
                            watermarkShow.value = false;
                            search();
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                })
                .catch(() => {
                    form.watermarkShow = 'Enable';
                });
        };
        const handleThemeChange = async (val: string) => {
            localStorage.removeItem(codeEditorThemeStorageKey);
            themeConfig.value.theme = val;
            switchTheme();
            if (isXpackOrEE.value) {
                await updateXpackSettingByKey('Theme', val);
                let color: string;
                const themeColor: ThemeColor = JSON.parse(themeConfig.value.themeColor);
                if (val === 'auto') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
                    color = prefersDark.matches ? themeColor.dark : themeColor.light;
                } else {
                    color = val === 'dark' ? themeColor.dark : themeColor.light;
                }
                themeConfig.value.primary = color;
                setPrimaryColor(color);
            }
        };
        const onSave = async (key: string, val: any) => {
            loading.value = true;
            let param = {
                key: key,
                value: val + '',
            };
            try {
                await rpc.core.setting.updateSetting(param);
                switch (key) {
                    case 'Theme':
                        handleThemeChange(val);
                        break;
                    case 'MenuTabs':
                        openMenuTabs.value = val === 'Enable';
                        break;
                    case 'MenuAccordion':
                        menuAccordion.value = val === 'Enable';
                        break;
                    case 'Language':
                        await globalStore.updateLanguage(val);
                        location.reload();
                        break;
                }
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                search();
            } catch (error) {
                loading.value = false;
                return false;
            }
            loading.value = false;
            return true;
        };
        onMounted(() => {
            search();
            rpc.core.setting.getSystemAvailable({});
        });
        return () =>
            withDirectives(
                <div>
                    <LayoutContent
                        title={$t('setting.panel')}
                        divider={true}
                        v-slots={{
                            main: () => (
                                <>
                                    <ElForm
                                        model={form}
                                        label-position={unref(isMobile) ? 'top' : 'left'}
                                        label-width="150px"
                                    >
                                        <ElRow>
                                            <ElCol span={1}>
                                                <br />
                                            </ElCol>
                                            <ElCol xs={24} sm={20} md={15} lg={12} xl={12}>
                                                <ElFormItem label={$t('setting.theme')} prop="theme">
                                                    <div class={'flex items-center justify-center gap-2 sm:gap-6'}>
                                                        <div class={'hidden sm:contents'}>
                                                            <ElRadioGroup
                                                                onChange={($event?: any) => {
                                                                    onSave('Theme', form.theme);
                                                                }}
                                                                modelValue={form.theme}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.theme = $v as any;
                                                                }}
                                                            >
                                                                <ElRadioButton value="light">
                                                                    <span>{$t('setting.light')}</span>
                                                                </ElRadioButton>
                                                                <ElRadioButton value="dark">
                                                                    <span>{$t('setting.dark')}</span>
                                                                </ElRadioButton>
                                                                <ElRadioButton value="auto">
                                                                    <span>{$t('setting.auto')}</span>
                                                                </ElRadioButton>
                                                            </ElRadioGroup>
                                                        </div>
                                                        <div class={'block !h-[33.5px] w-32 sm:hidden'}>
                                                            <ElSelect
                                                                onChange={($event?: any) => {
                                                                    onSave('Theme', form.theme);
                                                                }}
                                                                modelValue={form.theme}
                                                                onUpdate:modelValue={($v) => {
                                                                    form.theme = $v as any;
                                                                }}
                                                            >
                                                                <ElOption value="light" label={$t('setting.light')}>
                                                                    {$t('setting.light')}
                                                                </ElOption>
                                                                <ElOption value="dark" label={$t('setting.dark')}>
                                                                    {$t('setting.dark')}
                                                                </ElOption>
                                                                <ElOption value="auto" label={$t('setting.auto')}>
                                                                    {$t('setting.auto')}
                                                                </ElOption>
                                                            </ElSelect>
                                                        </div>
                                                        <div>
                                                            {unref(isXpackOrEE) ? (
                                                                <ElButton
                                                                    onClick={($event?: any) => {
                                                                        (onChangeThemeColor as any)($event);
                                                                    }}
                                                                    icon="Setting"
                                                                    class={'!h-[32px] sm:!h-[33.5px]'}
                                                                >
                                                                    <span>{$t('container.custom')}</span>
                                                                </ElButton>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </ElFormItem>
                                                <ElFormItem label={$t('setting.menuTabs')} prop="menuTabs">
                                                    <ElRadioGroup
                                                        onChange={($event?: any) => {
                                                            onSave('MenuTabs', form.menuTabs);
                                                        }}
                                                        modelValue={form.menuTabs}
                                                        onUpdate:modelValue={($v) => {
                                                            form.menuTabs = $v as any;
                                                        }}
                                                    >
                                                        <ElRadioButton value="Enable">
                                                            <span>{$t('commons.button.enable')}</span>
                                                        </ElRadioButton>
                                                        <ElRadioButton value="Disable">
                                                            <span>{$t('commons.button.disable')}</span>
                                                        </ElRadioButton>
                                                    </ElRadioGroup>
                                                    <span class={'input-help'}>{$t('setting.menuTabsHelper')}</span>
                                                </ElFormItem>
                                                {unref(isXpackOrEE) ? (
                                                    <ElFormItem label={$t('setting.watermark')} prop="watermark">
                                                        <ElRadioGroup
                                                            onChange={($event?: any) => {
                                                                (onChangeWatermark as any)($event);
                                                            }}
                                                            modelValue={form.watermarkShow}
                                                            onUpdate:modelValue={($v) => {
                                                                form.watermarkShow = $v as any;
                                                            }}
                                                            class={'w-full'}
                                                        >
                                                            <ElRadioButton value="Enable">
                                                                <span>{$t('commons.button.enable')}</span>
                                                            </ElRadioButton>
                                                            <ElRadioButton value="Disable">
                                                                <span>{$t('commons.button.disable')}</span>
                                                            </ElRadioButton>
                                                        </ElRadioGroup>
                                                        {form.watermarkShow === 'Enable' ? (
                                                            <div>
                                                                <div>
                                                                    <ElButton
                                                                        link
                                                                        type="primary"
                                                                        onClick={($event?: any) => {
                                                                            (onChangeWatermark as any)($event);
                                                                        }}
                                                                    >
                                                                        {$t('commons.button.view')}
                                                                    </ElButton>
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </ElFormItem>
                                                ) : null}
                                                <ElFormItem label={$t('setting.title')} prop="panelName">
                                                    <ElInput
                                                        disabled
                                                        modelValue={form.panelName}
                                                        onUpdate:modelValue={($v) => {
                                                            form.panelName = $v as any;
                                                        }}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    <ElButton
                                                                        icon="Setting"
                                                                        onClick={($event?: any) => {
                                                                            (onChangeTitle as any)($event);
                                                                        }}
                                                                    >
                                                                        {$t('commons.button.set')}
                                                                    </ElButton>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </ElFormItem>
                                                <ElFormItem label={$t('setting.language')} prop="language">
                                                    <ElSelect
                                                        onChange={($event?: any) => {
                                                            onSave('Language', form.language);
                                                        }}
                                                        modelValue={form.language}
                                                        onUpdate:modelValue={($v) => {
                                                            form.language = $v as any;
                                                        }}
                                                        class={'!w-full sm:!w-1/2'}
                                                    >
                                                        {(unref(languageOptions) || []).map((option) => (
                                                            <ElOption
                                                                value={option.value}
                                                                label={option.label}
                                                                key={option.value}
                                                            >
                                                                {option.label}
                                                            </ElOption>
                                                        ))}
                                                    </ElSelect>
                                                </ElFormItem>
                                                <ElFormItem label={$t('setting.sessionTimeout')} prop="sessionTimeout">
                                                    <ElInput
                                                        disabled
                                                        modelValue={form.sessionTimeout}
                                                        onUpdate:modelValue={($v) => {
                                                            form.sessionTimeout = $v === '' ? $v : Number($v);
                                                        }}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    <ElButton
                                                                        onClick={($event?: any) => {
                                                                            (onChangeTimeout as any)($event);
                                                                        }}
                                                                        icon="Setting"
                                                                    >
                                                                        {$t('commons.button.set')}
                                                                    </ElButton>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <span class={'input-help'}>
                                                        {$t('setting.sessionTimeoutHelper', [form.sessionTimeout])}
                                                    </span>
                                                </ElFormItem>
                                                <ElFormItem label={$t('setting.systemIP')} prop="systemIP">
                                                    {form.systemIP ? (
                                                        <ElInput
                                                            disabled
                                                            modelValue={form.systemIP}
                                                            onUpdate:modelValue={($v) => {
                                                                form.systemIP = $v as any;
                                                            }}
                                                            v-slots={{
                                                                append: () => (
                                                                    <>
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeSystemIP as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                    ) : null}
                                                    {!form.systemIP ? (
                                                        <ElInput
                                                            disabled
                                                            modelValue={unref(unset)}
                                                            onUpdate:modelValue={($v) => {
                                                                unset.value = $v as any;
                                                            }}
                                                            v-slots={{
                                                                append: () => (
                                                                    <>
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeSystemIP as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                    ) : null}
                                                    <span class={'input-help'}>{$t('setting.systemIPHelper')}</span>
                                                </ElFormItem>
                                                <ElFormItem label={$t('setting.proxy')} prop="proxyShow">
                                                    <ElInput
                                                        disabled
                                                        modelValue={form.proxyShow}
                                                        onUpdate:modelValue={($v) => {
                                                            form.proxyShow = $v as any;
                                                        }}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    <ElButton
                                                                        onClick={($event?: any) => {
                                                                            (onChangeProxy as any)($event);
                                                                        }}
                                                                        icon="Setting"
                                                                    >
                                                                        {$t('commons.button.set')}
                                                                    </ElButton>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </ElFormItem>
                                                {!unref(isEnterprise) ? (
                                                    <ElFormItem
                                                        label={$t('setting.developerMode')}
                                                        prop="developerMode"
                                                    >
                                                        <ElRadioGroup
                                                            onChange={($event?: any) => {
                                                                onSave('DeveloperMode', form.developerMode);
                                                            }}
                                                            modelValue={form.developerMode}
                                                            onUpdate:modelValue={($v) => {
                                                                form.developerMode = $v as any;
                                                            }}
                                                        >
                                                            <ElRadioButton value="Enable">
                                                                <span>{$t('commons.button.enable')}</span>
                                                            </ElRadioButton>
                                                            <ElRadioButton value="Disable">
                                                                <span>{$t('commons.button.disable')}</span>
                                                            </ElRadioButton>
                                                        </ElRadioGroup>
                                                        <span class={'input-help'}>
                                                            {$t('setting.developerModeHelper')}
                                                        </span>
                                                    </ElFormItem>
                                                ) : null}
                                                <ElFormItem label={$t('setting.menuSetting')}>
                                                    <ElButton
                                                        onClick={($event?: any) => {
                                                            (onChangeHideMenus as any)($event);
                                                        }}
                                                        icon="Setting"
                                                        style={[{}, { display: !unref(show) ? '' : 'none' }]}
                                                    >
                                                        {$t('commons.button.set')}
                                                    </ElButton>
                                                </ElFormItem>
                                                <ElFormItem label={$t('setting.panelCache.title')}>
                                                    <ElButton
                                                        onClick={($event?: any) => {
                                                            unref(cacheRef).acceptParams();
                                                        }}
                                                        icon="Setting"
                                                        style={[{}, { display: !unref(show) ? '' : 'none' }]}
                                                    >
                                                        {$t('commons.button.set')}
                                                    </ElButton>
                                                </ElFormItem>
                                                <ElFormItem label={$t('setting.runtimeEnv')} prop="edition">
                                                    <ElButton
                                                        icon="Setting"
                                                        onClick={($event?: any) => {
                                                            (onChangeRegion as any)($event);
                                                        }}
                                                    >
                                                        {runtimeEnvLabel()}
                                                    </ElButton>
                                                </ElFormItem>
                                            </ElCol>
                                        </ElRow>
                                    </ElForm>
                                </>
                            ),
                        }}
                    />
                    <PanelName
                        ref={panelNameRef}
                        onSearch={($event?: any) => {
                            search();
                        }}
                    />
                    <SystemIP
                        ref={systemIPRef}
                        onSearch={($event?: any) => {
                            search();
                        }}
                    />
                    <Proxy
                        ref={proxyRef}
                        onSearch={($event?: any) => {
                            search();
                        }}
                    />
                    <Timeout
                        ref={timeoutRef}
                        onSearch={($event?: any) => {
                            search();
                        }}
                    />
                    <HideMenu
                        ref={hideMenuRef}
                        onSearch={($event?: any) => {
                            search();
                        }}
                    />
                    <CacheSettings ref={cacheRef} />
                    <ThemeColor ref={themeColorRef} />
                    <Watermark
                        ref={watermarkRef}
                        onSearch={($event?: any) => {
                            search();
                        }}
                    />
                    <Edition
                        ref={editionRef}
                        onSearch={($event?: any) => {
                            search();
                        }}
                    />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
