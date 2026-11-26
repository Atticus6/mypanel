import { $t } from '@/utils/i18n-t';
import { ref } from 'vue';
import { FormInstance } from 'element-plus';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import TaskLog from '@/components/log/task/index';
import { rpc } from '@/lib/rpc';
import { computeSize } from '@/utils/size';
import { newUUID } from '@/utils/id';
interface DialogProps {
    id: number;
    isNew: boolean;
    name: string;
    taskID: string;
    reDownload: boolean;
    arch: string;
    size: number;
    freeSize: number;
    interruptStep: string;
    status: string;
    message: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElInput } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'recover',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        let loading = ref(false);
        let open = ref(false);
        const recoverForm = ref<FormInstance>();
        const taskLogRef = ref();
        let recoverReq = ref({
            id: 0,
            isNew: true,
            name: '',
            taskID: '',
            reDownload: true,
            secret: '',
            arch: '',
            size: 0,
            freeSize: 0,
            interruptStep: '',
            status: '',
            message: '',
        });
        const handleClose = () => {
            open.value = false;
            ctx.emit('search');
        };
        const acceptParams = (params: DialogProps): void => {
            recoverReq.value = {
                id: params.id,
                isNew: params.isNew,
                name: params.name,
                taskID: params.taskID,
                reDownload: params.reDownload,
                secret: '',
                arch: params.arch,
                size: params.size,
                freeSize: params.freeSize,
                interruptStep: params.interruptStep,
                status: params.status,
                message: params.message,
            };
            open.value = true;
        };
        const isSizeOk = () => {
            if (recoverReq.value.size === 0 || recoverReq.value.freeSize === 0) {
                return false;
            }
            return recoverReq.value.size * 2 < recoverReq.value.freeSize;
        };
        const isArchOk = () => {
            if (recoverReq.value.arch.length === 0) {
                return false;
            }
            return recoverReq.value.name.indexOf(recoverReq.value.arch) !== -1;
        };
        const canRollback = () => {
            return (
                !recoverReq.value.isNew &&
                recoverReq.value.interruptStep !== '' &&
                recoverReq.value.interruptStep !== 'RecoverDownload' &&
                recoverReq.value.interruptStep !== 'RecoverDecompress' &&
                recoverReq.value.interruptStep !== 'BackupBeforeRecover'
            );
        };
        const submit = async () => {
            loading.value = true;
            let param = {
                id: recoverReq.value.id,
                taskID: newUUID(),
                isNew: recoverReq.value.isNew,
                reDownload: recoverReq.value.reDownload,
                secret: recoverReq.value.secret,
            };
            await rpc.snapshot
                .recover(param)
                .then(() => {
                    ctx.emit('search');
                    loading.value = false;
                    handleClose();
                    openTaskLog(recoverReq.value.taskID || param.taskID);
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const onRollback = async () => {
            ElMessageBox.confirm(i18n.global.t('setting.rollbackHelper'), i18n.global.t('setting.rollback'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                loading.value = true;
                await rpc.snapshot
                    .rollback({
                        id: recoverReq.value.id,
                        taskId: newUUID(),
                        isNew: false,
                        reDownload: false,
                        secret: '',
                    })
                    .then(() => {
                        ctx.emit('search');
                        handleClose();
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
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
                    title={$t('commons.button.recover')}
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
                                    {canRollback() ? (
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (onRollback as any)($event);
                                            }}
                                            disabled={unref(loading)}
                                        >
                                            {$t('setting.rollback')}
                                        </ElButton>
                                    ) : null}
                                    {!unref(recoverReq).isNew ? (
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                (submit as any)($event);
                                            }}
                                            disabled={unref(loading)}
                                        >
                                            {$t('commons.button.retry')}
                                        </ElButton>
                                    ) : null}
                                    {unref(recoverReq).isNew ? (
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                (submit as any)($event);
                                            }}
                                            disabled={unref(loading)}
                                        >
                                            {$t('commons.button.confirm')}
                                        </ElButton>
                                    ) : null}
                                </span>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm ref={recoverForm} label-position="top">
                            {unref(recoverReq).isNew ? (
                                <div style={'margin-left: 20px; line-height: 32px'}>
                                    {$t('setting.recoverHelper', [unref(recoverReq).name])}
                                    <div>
                                        <ElButton type="warning" link icon="WarningFilled" style={'margin-top: -4px'} />
                                        {$t('setting.recoverHelper1')}
                                    </div>
                                    <div>
                                        <ElButton type="warning" link icon="WarningFilled" style={'margin-top: -4px'} />
                                        {$t('setting.recoverHelper4')}
                                    </div>
                                    <div>
                                        <ElButton
                                            type={isSizeOk() ? 'success' : 'danger'}
                                            link
                                            icon={isSizeOk() ? 'CircleCheckFilled' : 'CircleCloseFilled'}
                                            style={'margin-top: -4px'}
                                        />
                                        {$t('setting.recoverHelper2', [
                                            computeSize(unref(recoverReq).size),
                                            computeSize(unref(recoverReq).freeSize),
                                        ])}
                                    </div>
                                    <div>
                                        <ElButton
                                            type={isArchOk() ? 'success' : 'danger'}
                                            link
                                            icon={isArchOk() ? 'CircleCheckFilled' : 'CircleCloseFilled'}
                                            style={'margin-top: -4px'}
                                        />
                                        {$t('setting.recoverHelper3', [unref(recoverReq).arch])}
                                    </div>
                                </div>
                            ) : null}
                            {!unref(recoverReq).isNew ? (
                                <ElFormItem label={$t('setting.recoverFailed')}>
                                    <span>{unref(recoverReq).message}</span>
                                </ElFormItem>
                            ) : null}
                            {!unref(recoverReq).isNew ? (
                                <ElFormItem label={$t('setting.snapshotLabel')}>
                                    <ElCheckbox
                                        modelValue={unref(recoverReq).reDownload}
                                        onUpdate:modelValue={($v) => {
                                            unref(recoverReq).reDownload = $v as any;
                                        }}
                                    >
                                        {$t('setting.reDownload')}
                                    </ElCheckbox>
                                </ElFormItem>
                            ) : null}
                            <ElFormItem label={$t('setting.compressPassword')}>
                                <ElInput
                                    modelValue={unref(recoverReq).secret}
                                    onUpdate:modelValue={($v) => {
                                        unref(recoverReq).secret = $v as any;
                                    }}
                                    placeholder={$t('setting.backupRecoverMessage')}
                                />
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DialogPro>
                <TaskLog
                    ref={taskLogRef}
                    width="70%"
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
