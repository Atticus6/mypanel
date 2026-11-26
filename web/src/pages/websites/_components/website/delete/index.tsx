import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { Website } from '@/types/website';
import { MsgSuccess } from '@/utils/message';
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
                v-model={open.value}
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
                                {
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit();
                                        }}
                                        disabled={unref(loading) || unref(deleteInfo) != unref(websiteName)}
                                        v-permission={true}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                }
                            </span>
                        </>
                    ),
                }}
            >
                {
                    <div key={key} v-loading={unref(loading)}>
                        <ElForm ref={deleteForm} label-position="left">
                            <ElFormItem>
                                <ElCheckbox v-model={unref(deleteReq).forceDelete} label={$t('website.forceDelete')} />
                                <span class={'input-help'}>{$t('website.forceDeleteHelper')}</span>
                            </ElFormItem>
                            {unref(type) === 'deployment' ? (
                                <ElFormItem>
                                    <ElCheckbox v-model={unref(deleteReq).deleteApp} label={$t('website.deleteApp')} />
                                    <span class={'input-help'}>{$t('website.deleteAppHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            <ElFormItem>
                                <ElCheckbox
                                    v-model={unref(deleteReq).deleteBackup}
                                    label={$t('website.deleteBackup')}
                                />
                                <span class={'input-help'}>{$t('website.deleteBackupHelper')}</span>
                            </ElFormItem>
                            {unref(type) === 'runtime' ? (
                                <ElFormItem>
                                    <ElCheckbox v-model={unref(deleteReq).deleteDB} label={$t('app.deleteDB')} />
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
                                <ElInput v-model={deleteInfo.value} placeholder={unref(websiteName)} />
                            </ElFormItem>
                        </ElForm>
                    </div>
                }
            </DialogPro>
        );
    },
    options,
);
