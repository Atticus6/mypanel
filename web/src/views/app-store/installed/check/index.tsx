import { $t } from '@/utils/i18n-t';
import { App } from '@/types/app';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { routerToName } from '@/utils/router';
import { ref } from 'vue';
import ErrPrompt from '@/components/error-prompt/index';
interface CheckRrops {
    items: App.AppInstallResource[];
    installID: number;
    key: string;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElDescriptions } from 'element-plus';
import { ElDescriptionsItem } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElButton } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'check',
    props: {},
    emits: emits,
    __scopeId: 'data-v-0cc5294b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const installData = ref<CheckRrops>({
            items: [],
            installID: 0,
            key: '',
        });
        const open = ref(false);
        const map = new Map();
        const forceDelete = ref(false);
        const acceptParams = (__panelSetupProps: CheckRrops) => {
            map.clear();
            forceDelete.value = false;
            installData.value.installID = __panelSetupProps.installID;
            installData.value.key = __panelSetupProps.key;
            installData.value.items = [];
            installData.value.items = __panelSetupProps.items;
            installData.value.items.forEach((item) => {
                if (map.has(item.type)) {
                    const array = map.get(item.type);
                    array.push(item.name);
                    map.set(item.type, array);
                } else {
                    map.set(item.type, [item.name]);
                }
            });
            open.value = true;
        };
        const toPage = (key: string) => {
            if (key === 'app') {
                open.value = false;
            }
            if (key === 'website') {
                routerToName('Website');
            }
            if (key === 'database') {
                routerToName('MySQL');
            }
        };
        const onConfirm = () => {
            ElMessageBox.confirm(
                i18n.global.t('app.operatorHelper', [i18n.global.t('commons.button.delete')]),
                i18n.global.t('commons.button.delete'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            ).then(() => {
                const deleteReq = {
                    operate: 'delete',
                    installId: Number(installData.value.installID),
                    deleteBackup: true,
                    forceDelete: true,
                    deleteDB: true,
                };
                rpc.app
                    .operate({
                        installId: deleteReq.installId,
                        operate: deleteReq.operate,
                        deleteBackup: deleteReq.deleteBackup,
                        forceDelete: deleteReq.forceDelete,
                        deleteDb: deleteReq.deleteDB,
                    })
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        open.value = false;
                        ctx.emit('close', open.value);
                    });
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DialogPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                title={$t('app.checkTitle')}
                size="large"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        open.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (onConfirm as any)($event);
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <ElRow>
                    {unref(open) ? (
                        <ElCol span={20} offset={2}>
                            <ElAlert
                                type="error"
                                description={$t('app.deleteHelper', [$t('app.app')])}
                                center
                                show-icon
                                closable={false}
                            />
                            <ElDescriptions border column={1} class={'mt-5'}>
                                {[...(map || [])].map((item, key) => (
                                    <ElDescriptionsItem
                                        label-class-name="check-label"
                                        class-name="check-content"
                                        min-width="60px"
                                        key={key}
                                        v-slots={{
                                            label: () => (
                                                <>
                                                    <a
                                                        href="javascript:void(0);"
                                                        onClick={($event?: any) => {
                                                            toPage(item[0]);
                                                        }}
                                                        class={'check-label-a'}
                                                    >
                                                        {$t('menu.' + item[0])}
                                                    </a>
                                                </>
                                            ),
                                        }}
                                    >
                                        <span class={'resources'}>{map.get(item[0]).toString()}</span>
                                    </ElDescriptionsItem>
                                ))}
                            </ElDescriptions>
                            {unref(installData).key === 'openresty' ? (
                                <div class={'mt-5'}>
                                    <ElCheckbox
                                        modelValue={unref(forceDelete)}
                                        onUpdate:modelValue={($v) => {
                                            forceDelete.value = $v as any;
                                        }}
                                        label="true"
                                    >
                                        {$t('app.forceDelete')}
                                    </ElCheckbox>
                                    <ErrPrompt title={$t('app.openrestyDeleteHelper')} />
                                </div>
                            ) : null}
                        </ElCol>
                    ) : null}
                </ElRow>
            </DialogPro>
        );
    },
    options,
);
