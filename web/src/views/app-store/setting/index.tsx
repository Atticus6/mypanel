import { h } from 'vue';
import { $t } from '@/utils/i18n-t';
import { getCurrentNodeCustomAppConfig } from '@/api/modules/app';
import { rpc } from '@/lib/rpc';
import { FormRules } from 'element-plus';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { defineAsyncComponent } from 'vue';
import { loadOptionalComponent } from '@/extensions/optional';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElForm } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSwitch } from 'element-plus';
import { ElLink } from 'element-plus';
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
                                {withDirectives(
                                    <ElForm
                                        model={unref(config)}
                                        label-position="left"
                                        label-width="260px"
                                        rules={unref(rules)}
                                        ref={configForm}
                                        class={'app-setting-form ml-2.5'}
                                    >
                                        <ElRow>
                                            <ElCol xs={24} sm={20} md={15} lg={12} xl={12}>
                                                <ElFormItem
                                                    label={$t('app.uninstallDeleteBackup')}
                                                    prop="uninstallDeleteBackup"
                                                >
                                                    {withDirectives(
                                                        <ElSwitch
                                                            modelValue={unref(config).uninstallDeleteBackup}
                                                            onUpdate:modelValue={($v) => {
                                                                unref(config).uninstallDeleteBackup = $v as any;
                                                            }}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            loading={unref(loading)}
                                                            onChange={($event?: any) => {
                                                                updateConfig(
                                                                    'UninstallDeleteBackup',
                                                                    unref(config).uninstallDeleteBackup,
                                                                );
                                                            }}
                                                        />,
                                                        [[permissionDirective, true]],
                                                    )}
                                                </ElFormItem>
                                                <ElFormItem
                                                    label={$t('app.uninstallDeleteImage')}
                                                    prop="uninstallDeleteImage"
                                                >
                                                    {withDirectives(
                                                        <ElSwitch
                                                            modelValue={unref(config).uninstallDeleteImage}
                                                            onUpdate:modelValue={($v) => {
                                                                unref(config).uninstallDeleteImage = $v as any;
                                                            }}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            loading={unref(loading)}
                                                            onChange={($event?: any) => {
                                                                updateConfig(
                                                                    'UninstallDeleteImage',
                                                                    unref(config).uninstallDeleteImage,
                                                                );
                                                            }}
                                                        />,
                                                        [[permissionDirective, true]],
                                                    )}
                                                </ElFormItem>
                                                <ElFormItem label={$t('app.upgradeBackup')} prop="upgradeBackup">
                                                    {withDirectives(
                                                        <ElSwitch
                                                            modelValue={unref(config).upgradeBackup}
                                                            onUpdate:modelValue={($v) => {
                                                                unref(config).upgradeBackup = $v as any;
                                                            }}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            loading={unref(loading)}
                                                            onChange={($event?: any) => {
                                                                updateConfig(
                                                                    'UpgradeBackup',
                                                                    unref(config).upgradeBackup,
                                                                );
                                                            }}
                                                        />,
                                                        [[permissionDirective, true]],
                                                    )}
                                                </ElFormItem>
                                                <ElFormItem
                                                    label={$t('app.upgradeDeleteImage')}
                                                    prop="upgradeDeleteImage"
                                                >
                                                    {withDirectives(
                                                        <ElSwitch
                                                            modelValue={unref(config).upgradeDeleteImage}
                                                            onUpdate:modelValue={($v) => {
                                                                unref(config).upgradeDeleteImage = $v as any;
                                                            }}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            loading={unref(loading)}
                                                            onChange={($event?: any) => {
                                                                updateConfig(
                                                                    'UpgradeDeleteImage',
                                                                    unref(config).upgradeDeleteImage,
                                                                );
                                                            }}
                                                        />,
                                                        [[permissionDirective, true]],
                                                    )}
                                                </ElFormItem>
                                                <ElFormItem label={$t('app.installAllowPort')} prop="installAllowPort">
                                                    {withDirectives(
                                                        <ElSwitch
                                                            modelValue={unref(config).installAllowPort}
                                                            onUpdate:modelValue={($v) => {
                                                                unref(config).installAllowPort = $v as any;
                                                            }}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            loading={unref(loading)}
                                                            onChange={($event?: any) => {
                                                                updateConfig(
                                                                    'InstallAllowPort',
                                                                    unref(config).installAllowPort,
                                                                );
                                                            }}
                                                        />,
                                                        [[permissionDirective, true]],
                                                    )}
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
                                    </ElForm>,
                                    [[vLoading, unref(loading)]],
                                )}
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
