import { $t } from '@/utils/i18n-t';
import { FormInstance } from 'element-plus';
import { onBeforeUnmount, ref } from 'vue';
import { App } from '@/types/app';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import bus from '@/global/bus';
import TaskLog from '@/components/log/task/index';
import { v4 as uuidv4 } from 'uuid';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
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
        const deleteReq = ref({
            operate: 'delete',
            installId: 0,
            deleteBackup: false,
            forceDelete: false,
            deleteDB: true,
            deleteImage: false,
            taskID: '',
        });
        const open = ref(false);
        const loading = ref(false);
        const deleteHelper = ref('');
        const deleteInfo = ref('');
        const appInstallName = ref('');
        const appType = ref('');
        const taskLogRef = ref();
        const linkDB = ref(false);
        const deleteForm = ref<FormInstance>();
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', open.value);
        };
        const handleFormSubmit = () => {
            if (!loading.value && deleteInfo.value === appInstallName.value) {
                submit();
            }
        };
        const acceptParams = async (app: App.AppInstallDto) => {
            const config = await rpc.core.setting.getAppStoreConfig({});
            deleteReq.value = {
                operate: 'delete',
                installId: 0,
                deleteBackup: config.uninstallDeleteBackup === 'Enable',
                forceDelete: false,
                deleteDB: true,
                deleteImage: config.uninstallDeleteImage === 'Enable',
                taskID: uuidv4(),
            };
            deleteInfo.value = '';
            deleteReq.value.installId = app.id;
            appType.value = app.appType;
            deleteHelper.value = i18n.global.t('website.deleteConfirmHelper', [app.name]);
            appInstallName.value = app.name;
            linkDB.value = app.linkDB;
            open.value = true;
        };
        const submit = async () => {
            rpc.app
                .operate({
                    installId: deleteReq.value.installId,
                    operate: deleteReq.value.operate,
                    deleteBackup: deleteReq.value.deleteBackup,
                    forceDelete: deleteReq.value.forceDelete,
                    deleteDb: deleteReq.value.deleteDB,
                    deleteImage: deleteReq.value.deleteImage,
                    taskId: deleteReq.value.taskID,
                })
                .then(() => {
                    handleClose();
                    taskLogRef.value.openWithTaskID(deleteReq.value.taskID);
                    bus.emit('update', true);
                });
        };
        onBeforeUnmount(() => {
            bus.off('update');
        });
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DialogPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    title={$t('commons.button.uninstall') + ' - ' + unref(appInstallName)}
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
                                        disabled={unref(loading) || unref(deleteInfo) !== unref(appInstallName)}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm
                            ref={deleteForm}
                            label-position="left"
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                                (handleFormSubmit as any)($event);
                            }}
                            onKeyup={($event?: any) => {
                                if (!($event.key === 'Enter')) return;
                                (handleFormSubmit as any)($event);
                            }}
                        >
                            <ElFormItem>
                                <ElCheckbox
                                    modelValue={unref(deleteReq).forceDelete}
                                    onUpdate:modelValue={($v) => {
                                        unref(deleteReq).forceDelete = $v as any;
                                    }}
                                    label={$t('app.forceUninstall')}
                                />
                                <span class={'input-help'}>{$t('app.forceDeleteHelper')}</span>
                            </ElFormItem>
                            <ElFormItem>
                                <ElCheckbox
                                    modelValue={unref(deleteReq).deleteBackup}
                                    onUpdate:modelValue={($v) => {
                                        unref(deleteReq).deleteBackup = $v as any;
                                    }}
                                    label={$t('app.deleteBackup')}
                                />
                                <span class={'input-help'}>{$t('app.deleteBackupHelper')}</span>
                            </ElFormItem>
                            <ElFormItem>
                                <ElCheckbox
                                    modelValue={unref(deleteReq).deleteImage}
                                    onUpdate:modelValue={($v) => {
                                        unref(deleteReq).deleteImage = $v as any;
                                    }}
                                    label={$t('app.deleteImage')}
                                />
                                <span class={'input-help'}>{$t('app.deleteImageHelper')}</span>
                            </ElFormItem>
                            {unref(appType) === 'website' && unref(linkDB) ? (
                                <ElFormItem>
                                    <ElCheckbox
                                        modelValue={unref(deleteReq).deleteDB}
                                        onUpdate:modelValue={($v) => {
                                            unref(deleteReq).deleteDB = $v as any;
                                        }}
                                        label={$t('app.deleteDB')}
                                    />
                                    <span class={'input-help'}>{$t('app.deleteDBHelper')}</span>
                                </ElFormItem>
                            ) : null}
                            <ElFormItem>
                                <span innerHTML={unref(deleteHelper)} />
                                <ElInput
                                    modelValue={unref(deleteInfo)}
                                    onUpdate:modelValue={($v) => {
                                        deleteInfo.value = $v as any;
                                    }}
                                    placeholder={unref(appInstallName)}
                                    onKeyup={($event?: any) => {
                                        if (!($event.key === 'Enter')) return;
                                        (handleFormSubmit as any)($event);
                                    }}
                                />
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DialogPro>
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
