import { $t } from '@/utils/i18n-t';
import MarkDownEditor from '@/components/mkdown-editor/index';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    upgradeInfo: number;
    upgradeVersion: string;
}
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: (...args: unknown[]) => true,
};

const options = {
    name: 'upgrade',
    props: {},
    emits: emits,
    __scopeId: 'data-v-d4e1025d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isLoading, isOnRestart } = useGlobalStore();
        const drawerVisible = ref(false);
        const upgradeInfo = ref();
        const loading = ref();
        const upgradeVersion = ref();
        const acceptParams = (params: DialogProps): void => {
            upgradeInfo.value = params.upgradeInfo;
            upgradeVersion.value = params.upgradeVersion;
            drawerVisible.value = true;
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const changeOption = async () => {
            loading.value = true;
            await rpc.core.setting
                .getUpgradeNotes({ version: upgradeVersion.value })
                .then((res) => {
                    loading.value = false;
                    upgradeInfo.value.releaseNote = res.content;
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onUpgrade = async () => {
            ElMessageBox.confirm(i18n.global.t('setting.upgradeHelper', i18n.global.t('commons.button.upgrade')), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                await rpc.core.setting.upgrade({ version: upgradeVersion.value });
                isLoading.value = true;
                isOnRestart.value = true;
                drawerVisible.value = false;
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                ctx.emit('search');
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
                header={$t('commons.button.upgrade')}
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
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (onUpgrade as any)($event);
                                    }}
                                >
                                    {$t('setting.upgradeNow')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <div class={'panel-MdEditor'}>
                    <div class={'default-theme'}>
                        <h2 class={'inline-block'}>{$t('app.version')}</h2>
                    </div>
                    <ElRadioGroup
                        modelValue={unref(upgradeVersion)}
                        onUpdate:modelValue={($v) => {
                            upgradeVersion.value = $v as any;
                        }}
                        onChange={($event?: any) => {
                            (changeOption as any)($event);
                        }}
                        class={'tag inline-block'}
                    >
                        {unref(upgradeInfo).newVersion ? (
                            <ElRadio value={unref(upgradeInfo).newVersion}>{unref(upgradeInfo).newVersion}</ElRadio>
                        ) : null}
                        {unref(upgradeInfo).latestVersion ? (
                            <ElRadio value={unref(upgradeInfo).latestVersion}>
                                {unref(upgradeInfo).latestVersion}
                            </ElRadio>
                        ) : null}
                        {unref(upgradeInfo).testVersion ? (
                            <ElRadio value={unref(upgradeInfo).testVersion}>{unref(upgradeInfo).testVersion}</ElRadio>
                        ) : null}
                    </ElRadioGroup>
                    {withDirectives(
                        <div>
                            <MarkDownEditor content={unref(upgradeInfo).releaseNote} />
                        </div>,
                        [[vLoading, unref(loading)]],
                    )}
                </div>
            </DrawerPro>
        );
    },
    options,
);
