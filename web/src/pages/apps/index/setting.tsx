import { $t } from '@/utils/i18n-t';
import { getCurrentNodeCustomAppConfig } from '@/api/modules/app';
import { rpc } from '@/lib/rpc';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { loadOptionalComponent } from '@/extensions/optional';
import { useGlobalStore } from '@/composables/useGlobalStore';
import '@/pages/apps/_components/setting/index.styles.css';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'setting',
    props: {},
    emits: emits,
    __scopeId: 'data-v-068c21b2',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isXpackOrEE } = useGlobalStore();
        const CustomSetting = defineAsyncComponent(() => loadOptionalComponent('/src/xpack/views/appstore/index'));
        const LicenseImport = defineAsyncComponent(() =>
            loadOptionalComponent('/src/xpack/views/license/import/index'),
        );
        const rules = ref<FormRules>({});
        const config = ref({
            uninstallDeleteImage: '',
            uninstallDeleteBackup: '',
            upgradeBackup: '',
            upgradeDeleteImage: '',
            installAllowPort: '',
        });
        const loading = ref(false);
        const configForm = ref();
        const useCustomApp = ref(false);
        const isInitializing = ref(true);
        const licenseRef = ref();
        const search = async () => {
            loading.value = true;
            try {
                const res = await rpc.core.setting.getAppStoreConfig({});
                if (res) {
                    isInitializing.value = true;
                    config.value = res;
                    setTimeout(() => {
                        isInitializing.value = false;
                    }, 0);
                }
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const toUpload = () => {
            licenseRef.value.acceptParams();
        };
        const getNodeConfig = async () => {
            if (isXpackOrEE.value) {
                return;
            }
            const res = await getCurrentNodeCustomAppConfig();
            if (res && res.data) {
                useCustomApp.value = res.data.status === 'enable';
            }
        };
        const updateConfig = async (scope: string, value: string) => {
            if (isInitializing.value) {
                return;
            }
            loading.value = true;
            try {
                const req = {
                    scope: scope,
                    status: value,
                };
                await rpc.core.setting.updateAppStoreConfig(req);
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                search();
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        onMounted(() => {
            search();
            getNodeConfig();
        });
        return () => (
            <>
                <LayoutContent
                    title={$t('commons.button.set')}
                    v-slots={{
                        main: () => (
                            <>
                                {
                                    <ElForm
                                        model={unref(config)}
                                        label-position="left"
                                        label-width="260px"
                                        rules={unref(rules)}
                                        ref={configForm}
                                        class={'app-setting-form ml-2.5'}
                                        v-loading={unref(loading)}
                                    >
                                        <ElRow>
                                            <ElCol xs={24} sm={20} md={15} lg={12} xl={12}>
                                                <ElFormItem
                                                    label={$t('app.uninstallDeleteBackup')}
                                                    prop="uninstallDeleteBackup"
                                                >
                                                    {
                                                        <ElSwitch
                                                            v-model={unref(config).uninstallDeleteBackup}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            loading={unref(loading)}
                                                            onChange={($event?: any) => {
                                                                updateConfig(
                                                                    'UninstallDeleteBackup',
                                                                    unref(config).uninstallDeleteBackup,
                                                                );
                                                            }}
                                                            v-permission={true}
                                                        />
                                                    }
                                                </ElFormItem>
                                                <ElFormItem
                                                    label={$t('app.uninstallDeleteImage')}
                                                    prop="uninstallDeleteImage"
                                                >
                                                    {
                                                        <ElSwitch
                                                            v-model={unref(config).uninstallDeleteImage}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            loading={unref(loading)}
                                                            onChange={($event?: any) => {
                                                                updateConfig(
                                                                    'UninstallDeleteImage',
                                                                    unref(config).uninstallDeleteImage,
                                                                );
                                                            }}
                                                            v-permission={true}
                                                        />
                                                    }
                                                </ElFormItem>
                                                <ElFormItem label={$t('app.upgradeBackup')} prop="upgradeBackup">
                                                    {
                                                        <ElSwitch
                                                            v-model={unref(config).upgradeBackup}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            loading={unref(loading)}
                                                            onChange={($event?: any) => {
                                                                updateConfig(
                                                                    'UpgradeBackup',
                                                                    unref(config).upgradeBackup,
                                                                );
                                                            }}
                                                            v-permission={true}
                                                        />
                                                    }
                                                </ElFormItem>
                                                <ElFormItem
                                                    label={$t('app.upgradeDeleteImage')}
                                                    prop="upgradeDeleteImage"
                                                >
                                                    {
                                                        <ElSwitch
                                                            v-model={unref(config).upgradeDeleteImage}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            loading={unref(loading)}
                                                            onChange={($event?: any) => {
                                                                updateConfig(
                                                                    'UpgradeDeleteImage',
                                                                    unref(config).upgradeDeleteImage,
                                                                );
                                                            }}
                                                            v-permission={true}
                                                        />
                                                    }
                                                </ElFormItem>
                                                <ElFormItem label={$t('app.installAllowPort')} prop="installAllowPort">
                                                    {
                                                        <ElSwitch
                                                            v-model={unref(config).installAllowPort}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            loading={unref(loading)}
                                                            onChange={($event?: any) => {
                                                                updateConfig(
                                                                    'InstallAllowPort',
                                                                    unref(config).installAllowPort,
                                                                );
                                                            }}
                                                            v-permission={true}
                                                        />
                                                    }
                                                </ElFormItem>
                                                {unref(isXpackOrEE) ? (
                                                    h(CustomSetting, {})
                                                ) : (
                                                    <span class={'input-help logText'}>
                                                        {$t('xpack.customApp.licenseHelper')}
                                                        <ElLink
                                                            onClick={($event?: any) => {
                                                                (toUpload as any)($event);
                                                            }}
                                                            type="primary"
                                                            class={'link'}
                                                        >
                                                            {$t('license.levelUpPro')}
                                                        </ElLink>
                                                    </span>
                                                )}
                                            </ElCol>
                                        </ElRow>
                                    </ElForm>
                                }
                            </>
                        ),
                    }}
                />
                {h(LicenseImport, { ref: licenseRef })}
            </>
        );
    },
    options,
);

definePage({
    name: 'AppStoreSetting',
    props: true,
    meta: {
        activeMenu: '/apps',
        parent: 'menu.app',
        title: 'commons.button.set',
        permission: 'app_view',
        hidden: true,
    },
});
