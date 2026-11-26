import { $t } from '@/utils/i18n-t';
import { ref } from 'vue';
import { Setting } from '@/types/setting';
import { ElMessageBox } from 'element-plus';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import SnapRecover from '@/views/setting/snapshot/recover/index';
import { newUUID } from '@/utils/id';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    snapInfo: Setting.SnapshotInfo;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElDivider } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElCard } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElTag } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: (...args: unknown[]) => true,
};

const options = {
    name: 'status',
    props: {},
    emits: emits,
    __scopeId: 'data-v-092105ea',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref(false);
        const snapInfo = ref();
        const loading = ref();
        const recoverRef = ref();
        const acceptParams = (params: DialogProps): void => {
            snapInfo.value = params.snapInfo;
            drawerVisible.value = true;
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const recoverSnapshot = async (isNew: boolean) => {
            loading.value = true;
            await rpc.dashboard
                .getOsInfo({})
                .then((res) => {
                    loading.value = false;
                    let params = {
                        id: snapInfo.value.id,
                        isNew: isNew,
                        name: snapInfo.value.name,
                        reDownload: false,
                        secret: snapInfo.value.secret,

                        arch: res.kernelArch,
                        size: snapInfo.value.size,
                        freeSize: Number(res.diskSize),
                    };
                    recoverRef.value.acceptParams(params);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const rollbackSnapshot = async () => {
            ElMessageBox.confirm(i18n.global.t('setting.rollbackHelper'), i18n.global.t('setting.rollback'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                loading.value = true;
                let taskID = newUUID();
                await rpc.snapshot
                    .rollback({ id: snapInfo.value.id, isNew: false, reDownload: false, secret: '', taskId: taskID })
                    .then(() => {
                        ctx.emit('search');
                        loading.value = false;
                        drawerVisible.value = false;
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
                <DrawerPro
                    modelValue={unref(drawerVisible)}
                    onUpdate:modelValue={($v) => {
                        drawerVisible.value = $v as any;
                    }}
                    header={$t('setting.recoverDetail')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="small"
                >
                    {withDirectives(
                        <ElForm label-position="top">
                            <span class={'card-title'}>{$t('commons.button.recover')}</span>
                            <ElDivider class={'divider'} />
                            {!unref(snapInfo).recoverStatus && !unref(snapInfo).lastRecoveredAt ? (
                                <div>
                                    <ElAlert center closable={false} class={'alert'} style={'height: 257px'}>
                                        <ElButton
                                            size="large"
                                            round
                                            plain
                                            type="primary"
                                            onClick={($event?: any) => {
                                                recoverSnapshot(true);
                                            }}
                                        >
                                            {$t('commons.button.recover')}
                                        </ElButton>
                                    </ElAlert>
                                </div>
                            ) : (
                                <ElCard class={'mini-border-card'}>
                                    {!unref(snapInfo).recoverStatus ? (
                                        <div class={'mini-border-card'}>
                                            {unref(snapInfo).lastRecoveredAt ? (
                                                <div>
                                                    <ElFormItem label={$t('commons.table.status')}>
                                                        <ElTag type="success">{$t('commons.status.success')}</ElTag>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                recoverSnapshot(true);
                                                            }}
                                                            type="primary"
                                                            style={'margin-left: 10px'}
                                                        >
                                                            {$t('commons.button.recover')}
                                                        </ElButton>
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('setting.lastRecoverAt')}>
                                                        {unref(snapInfo).lastRecoveredAt}
                                                    </ElFormItem>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div>
                                            <ElFormItem label={$t('commons.table.status')}>
                                                {unref(snapInfo).recoverStatus === 'Failed' ? (
                                                    <ElTag type="danger">{$t('commons.status.failed')}</ElTag>
                                                ) : null}
                                                {unref(snapInfo).recoverStatus === 'Success' ? (
                                                    <ElTag type="success">{$t('commons.status.success')}</ElTag>
                                                ) : null}
                                                {unref(snapInfo).recoverStatus === 'Waiting' ? (
                                                    <ElTag type="info">{$t('commons.status.waiting')}</ElTag>
                                                ) : null}
                                            </ElFormItem>
                                            {unref(snapInfo).recoverStatus !== 'Waiting' ? (
                                                <ElFormItem label={$t('setting.lastRecoverAt')}>
                                                    {unref(snapInfo).lastRecoveredAt}
                                                </ElFormItem>
                                            ) : null}
                                            {unref(snapInfo).recoverStatus === 'Failed' ? (
                                                <div>
                                                    <ElFormItem label={$t('commons.button.log')}>
                                                        <span
                                                            style={
                                                                'word-break: break-all; flex-wrap: wrap; word-wrap: break-word'
                                                            }
                                                        >
                                                            {unref(snapInfo).recoverMessage}
                                                        </span>
                                                    </ElFormItem>
                                                    <ElFormItem>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                recoverSnapshot(false);
                                                            }}
                                                            type="primary"
                                                        >
                                                            {$t('commons.button.retry')}
                                                        </ElButton>
                                                    </ElFormItem>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </ElCard>
                            )}
                            {unref(snapInfo).recoverStatus === 'Failed' ? (
                                <div>
                                    <span class={'card-title'}>{$t('setting.rollback')}</span>
                                    <ElDivider class={'divider'} />
                                    {!unref(snapInfo).rollbackStatus && !unref(snapInfo).lastRollbackedAt ? (
                                        <div>
                                            <ElAlert center closable={false} class={'alert'} style={'height: 257px'}>
                                                <ElButton
                                                    size="large"
                                                    round
                                                    plain
                                                    type="primary"
                                                    onClick={($event?: any) => {
                                                        rollbackSnapshot();
                                                    }}
                                                >
                                                    {$t('setting.rollback')}
                                                </ElButton>
                                            </ElAlert>
                                        </div>
                                    ) : null}
                                    {!unref(snapInfo).rollbackStatus ? (
                                        <div>
                                            {unref(snapInfo).lastRollbackedAt ? (
                                                <div>
                                                    <ElFormItem label={$t('commons.table.status')}>
                                                        <ElTag type="success">{$t('commons.status.success')}</ElTag>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                (rollbackSnapshot as any)($event);
                                                            }}
                                                            type="primary"
                                                            style={'margin-left: 10px'}
                                                        >
                                                            {$t('setting.rollback')}
                                                        </ElButton>
                                                    </ElFormItem>
                                                    <ElFormItem label={$t('setting.lastRollbackAt')}>
                                                        {unref(snapInfo).lastRollbackedAt}
                                                    </ElFormItem>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <div>
                                            <ElFormItem label={$t('commons.table.status')}>
                                                {unref(snapInfo).rollbackStatus === 'Success' ? (
                                                    <ElTag type="success">{$t('commons.status.success')}</ElTag>
                                                ) : null}
                                                {unref(snapInfo).rollbackStatus === 'Failed' ? (
                                                    <ElTag type="danger">{$t('commons.status.failed')}</ElTag>
                                                ) : null}
                                                {unref(snapInfo).rollbackStatus === 'Waiting' ? (
                                                    <ElTag type="info">{$t('commons.status.waiting')}</ElTag>
                                                ) : null}
                                                <ElButton
                                                    disabled={unref(snapInfo).rollbackStatus !== 'Success'}
                                                    onClick={($event?: any) => {
                                                        (rollbackSnapshot as any)($event);
                                                    }}
                                                    style={'margin-left: 15px'}
                                                >
                                                    {$t('setting.rollback')}
                                                </ElButton>
                                            </ElFormItem>
                                            {unref(snapInfo).rollbackStatus !== 'Waiting' ? (
                                                <ElFormItem label={$t('setting.lastRollbackAt')}>
                                                    {unref(snapInfo).lastRollbackedAt}
                                                </ElFormItem>
                                            ) : null}
                                            {unref(snapInfo).rollbackStatus === 'Failed' ? (
                                                <div>
                                                    <ElFormItem label={$t('commons.button.log')}>
                                                        <span
                                                            style={
                                                                'word-break: break-all; flex-wrap: wrap; word-wrap: break-word'
                                                            }
                                                        >
                                                            {unref(snapInfo).rollbackMessage}
                                                        </span>
                                                    </ElFormItem>
                                                    <ElFormItem>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                rollbackSnapshot();
                                                            }}
                                                            type="primary"
                                                        >
                                                            {$t('commons.button.retry')}
                                                        </ElButton>
                                                    </ElFormItem>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
                <SnapRecover ref={recoverRef} />
            </>
        );
    },
    options,
);
