import { $t } from '@/utils/i18n-t';
import { App } from '@/types/app';
import { rpc } from '@/lib/rpc';
import bus from '@/global/bus';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'create',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const resourceName = ref('');
        const req = reactive({
            appID: 0,
            appDetailID: 0,
            scope: 'all',
        });
        const versions = ref();
        const appInstallID = ref(0);
        const rules = ref<any>({
            appDetailID: [Rules.requiredSelect],
        });
        const loading = ref(false);
        const handleClose = () => {
            open.value = false;
        };
        const acceptParams = (apppInstall: App.AppInstalled) => {
            appInstallID.value = apppInstall.id;
            req.appID = apppInstall.appID;
            getVersions();
            open.value = true;
        };
        const getVersions = async () => {
            try {
                const res = await rpc.app.updateVersions({ appInstallId: appInstallID.value, loadCompose: false });
                versions.value = res.items;
                if (versions.value.length > 0) {
                    req.appDetailID = versions.value[0].detailId;
                }
            } catch (error) {}
        };
        const submit = async () => {
            loading.value = true;
            try {
                await rpc.app.ignoreAppUpgrade({ appId: req.appID, appDetailId: req.appDetailID, scope: req.scope });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                handleClose();
                bus.emit('upgrade', true);
                ctx.emit('close');
            } catch (error) {
                return;
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('commons.button.ignore')}
                resource={unref(resourceName)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (submit as any)($event);
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <ElForm
                    onSubmit={($event?: any) => {
                        $event.preventDefault();
                    }}
                    ref="updateRef"
                    rules={unref(rules)}
                    label-position="top"
                    model={req}
                >
                    <ElFormItem>
                        <ElRadioGroup
                            modelValue={req.scope}
                            onUpdate:modelValue={($v) => {
                                req.scope = $v as any;
                            }}
                        >
                            <ElRadioButton label={$t('app.ignoreAll')} value="all" />
                            <ElRadioButton label={$t('app.ignoreVersion')} value="version" />
                        </ElRadioGroup>
                    </ElFormItem>
                    {req.scope === 'version' ? (
                        <ElFormItem label={$t('app.versionSelect')} prop="appDetailID">
                            <ElSelect
                                modelValue={req.appDetailID}
                                onUpdate:modelValue={($v) => {
                                    req.appDetailID = $v as any;
                                }}
                            >
                                {(unref(versions) || []).map((version, index) => (
                                    <ElOption value={version.detailId} label={version.version} key={index} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                    ) : null}
                </ElForm>
            </DrawerPro>
        );
    },
    options,
);
