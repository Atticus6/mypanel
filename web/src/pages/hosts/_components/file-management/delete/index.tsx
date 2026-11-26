import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { File } from '@/types/file';
import { getIcon } from '@/utils/file';
import { rpc } from '@/lib/rpc';
import { MsgSuccess, MsgWarning } from '@/utils/message';
import './index.styles.css';
import DialogPro from '@/components/dialog-pro/index';
import SvgIcon from '@/components/svg-icon/svg-icon';

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
    __scopeId: 'data-v-3f72e292',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const files = ref();
        const loading = ref(false);
        const forceDelete = ref(false);
        const recycleStatus = ref('Enable');
        const acceptParams = (__panelSetupProps: File.File[]) => {
            getStatus();
            files.value = __panelSetupProps;
            open.value = true;
            forceDelete.value = false;
        };
        const getStatus = async () => {
            loading.value = true;
            try {
                recycleStatus.value = (await rpc.file.getRecycleStatus({})).status;
                if (recycleStatus.value === 'Disable') {
                    forceDelete.value = true;
                }
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const onConfirm = async () => {
            loading.value = true;
            try {
                const pros = [];
                let baseDir = '';
                if (files.value.some((item) => item['isDir'])) {
                    const pathRes = await rpc.agentSetting.getBaseDir({});
                    baseDir = pathRes.path;
                }
                for (const s of files.value) {
                    if (s['isDir']) {
                        if (s['path'].indexOf('.1panel_clash') > -1) {
                            MsgWarning(i18n.global.t('file.clashDeleteAlert'));
                            return;
                        }
                        if (s['path'] === baseDir) {
                            MsgWarning(i18n.global.t('file.panelInstallDir'));
                            return;
                        }
                    }
                    // 单进程下不再区分节点，直接走 RPC 删除。
                    pros.push(
                        rpc.file.delete({
                            path: s['path'],
                            isDir: s['isDir'],
                            forceDelete: forceDelete.value,
                        }),
                    );
                }
                await Promise.all(pros);
                MsgSuccess(i18n.global.t('commons.msg.deleteSuccess'));
                open.value = false;
                ctx.emit('close');
            } finally {
                loading.value = false;
            }
        };
        const getIconName = (extension: string) => {
            return getIcon(extension);
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DialogPro
                v-model={open.value}
                title={$t('commons.button.delete')}
                size="w-60"
                class={'file-delete-dialog'}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        open.value = false;
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (onConfirm as any)($event);
                                    }}
                                    loading={unref(loading)}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {
                    <div v-loading={unref(loading)}>
                        <ElRow>
                            <ElCol span={22} offset={1}>
                                <ElAlert
                                    show-icon={true}
                                    type={unref(recycleStatus) === 'Enable' ? 'warning' : 'error'}
                                    closable={false}
                                    class={'mt-2'}
                                >
                                    <div class={'delete-warn'}>
                                        {unref(recycleStatus) === 'Enable' ? (
                                            <span>{$t('file.deleteHelper')}</span>
                                        ) : (
                                            <span>{$t('file.deleteHelper2')}</span>
                                        )}
                                    </div>
                                </ElAlert>
                                {unref(recycleStatus) === 'Enable' ? (
                                    <div class={'mt-4'}>
                                        <ElCheckbox v-model={forceDelete.value} class={'force-delete'}>
                                            <span>{$t('file.forceDeleteHelper')}</span>
                                        </ElCheckbox>
                                    </div>
                                ) : null}
                                <div class={'file-list'}>
                                    {(unref(files) || []).map((row, index) => (
                                        <div class={'flx-align-center mb-1'} key={index}>
                                            <div>
                                                {row.isDir ? (
                                                    <SvgIcon className="table-icon mr-1" iconName="p-file-folder" />
                                                ) : (
                                                    <SvgIcon
                                                        className="table-icon mr-1"
                                                        iconName={getIconName(row.extension)}
                                                    />
                                                )}
                                            </div>
                                            <span class={'dialog-object-name'}>{row.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </ElCol>
                        </ElRow>
                    </div>
                }
            </DialogPro>
        );
    },
    options,
);
