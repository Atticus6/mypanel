import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { FormInstance } from 'element-plus';
import { ref } from 'vue';
import { Website } from '@/types/website';
import { MsgSuccess } from '@/utils/message';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'delete',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const initData = () => ({
            id: 0,
            deleteApp: false,
            deleteBackup: false,
            forceDelete: false,
            deleteDB: false,
        });
        const key = 1;
        const open = ref(false);
        const loading = ref(false);
        const deleteReq = ref(initData());
        const type = ref('');
        const deleteForm = ref<FormInstance>();
        const deleteInfo = ref('');
        const websiteName = ref('');
        const deleteHelper = ref('');
        const subSites = ref('');
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
        };
        const acceptParams = async (website: Website.WebsiteDTO) => {
            deleteReq.value = initData();

            subSites.value = '';
            if (website.childSites && website.childSites.length > 0) {
                subSites.value = website.childSites.join(',');
            }
            deleteInfo.value = '';
            deleteReq.value.id = website.id;
            websiteName.value = website.primaryDomain;
            deleteHelper.value = i18n.global.t('website.deleteConfirmHelper', [website.primaryDomain]);
            type.value = website.type;
            open.value = true;
        };
        const submit = () => {
            loading.value = true;
            rpc.website
                .delete({
                    id: deleteReq.value.id,
                    deleteApp: deleteReq.value.deleteApp,
                    deleteBackup: deleteReq.value.deleteBackup,
                    forceDelete: deleteReq.value.forceDelete,
                    deleteDb: deleteReq.value.deleteDB,
                })
                .then(() => {
                    handleClose();
                    MsgSuccess(i18n.global.t('commons.msg.deleteSuccess'));
                })
                .finally(() => {
                    loading.value = false;
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
                title={$t('website.delete') + ' - ' + unref(websiteName)}
                size="small"
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
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit();
                                        }}
                                        disabled={unref(loading) || unref(deleteInfo) != unref(websiteName)}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <div key={key}>
                        <ElForm ref={deleteForm} label-position="left">
                            <ElFormItem>
                                <ElCheckbox
                                    modelValue={unref(deleteReq).forceDelete}
                                    onUpdate:modelValue={($v) => {
                                        unref(deleteReq).forceDelete = $v as any;
                                    }}
                                    label={$t('website.forceDelete')}
                                />
                                <span class={'input-help'}>{$t('website.forceDeleteHelper')}</span>
                            </ElFormItem>
                            {unref(type) === 'deployment' ? (
                                <ElFormItem>
                                    <ElCheckbox
                                        modelValue={unref(deleteReq).deleteApp}
                                        onUpdate:modelValue={($v) => {
                                            unref(deleteReq).deleteApp = $v as any;
                                        }}
                                        label={$t('website.deleteApp')}
                                    />
                                    <span class={'input-help'}>{$t('website.deleteAppHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            <ElFormItem>
                                <ElCheckbox
                                    modelValue={unref(deleteReq).deleteBackup}
                                    onUpdate:modelValue={($v) => {
                                        unref(deleteReq).deleteBackup = $v as any;
                                    }}
                                    label={$t('website.deleteBackup')}
                                />
                                <span class={'input-help'}>{$t('website.deleteBackupHelper')}</span>
                            </ElFormItem>
                            {unref(type) === 'runtime' ? (
                                <ElFormItem>
                                    <ElCheckbox
                                        modelValue={unref(deleteReq).deleteDB}
                                        onUpdate:modelValue={($v) => {
                                            unref(deleteReq).deleteDB = $v as any;
                                        }}
                                        label={$t('app.deleteDB')}
                                    />
                                    <span class={'input-help'}>{$t('website.deleteDatabaseHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            {unref(subSites) != '' ? (
                                <ElFormItem>
                                    <span class={'input-help text-red-500'}>
                                        {$t('website.deleteSubsite', [unref(subSites)])}
                                    </span>
                                </ElFormItem>
                            ) : null}
                            <ElFormItem>
                                <span innerHTML={unref(deleteHelper)} />
                                <ElInput
                                    modelValue={unref(deleteInfo)}
                                    onUpdate:modelValue={($v) => {
                                        deleteInfo.value = $v as any;
                                    }}
                                    placeholder={unref(websiteName)}
                                />
                            </ElFormItem>
                        </ElForm>
                    </div>,
                    [[vLoading, unref(loading)]],
                )}
            </DialogPro>
        );
    },
    options,
);
