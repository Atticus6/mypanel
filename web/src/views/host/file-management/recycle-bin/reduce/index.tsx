import { $t } from '@/utils/i18n-t';
import { ref } from 'vue';
import { getIcon } from '@/utils/file';
import { rpc } from '@/lib/rpc';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { File } from '@/types/file';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElButton } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';
import SvgIcon from '@/components/svg-icon/svg-icon';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'reduce',
    props: {},
    emits: emits,
    __scopeId: 'data-v-1ef50079',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const files = ref();
        const loading = ref(false);
        const forceDelete = ref(false);
        const acceptParams = (__panelSetupProps: File.RecycleBin[]) => {
            files.value = __panelSetupProps;
            open.value = true;
            forceDelete.value = false;
        };
        const onConfirm = () => {
            const pros = [];
            for (const s of files.value) {
                pros.push(rpc.file.restoreRecycle({ from: s.from, rName: s.rName, name: s.name }));
            }
            loading.value = true;
            Promise.all(pros)
                .then(() => {
                    MsgSuccess(i18n.global.t('file.reduceSuccess'));
                    open.value = false;
                    ctx.emit('close');
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const getIconName = (extension: string) => {
            return getIcon(extension);
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
                title={$t('file.reduce')}
                size="w-60"
                class={'recycle-file-dialog'}
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
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (onConfirm as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[vLoading, unref(loading)]],
                                )}
                            </span>
                        </>
                    ),
                }}
            >
                <ElRow>
                    <ElCol span={20} offset={2}>
                        <ElAlert title={$t('file.confirmReduce')} show-icon type="error" closable={false} />
                        {(unref(files) || []).map((row, index) => (
                            <div class={'flx-align-center mt-1 mb-1'} key={index}>
                                <div>
                                    {row.isDir ? (
                                        <SvgIcon className="table-icon mr-1" iconName="p-file-folder" />
                                    ) : (
                                        <SvgIcon className="table-icon mr-1" iconName={getIconName(row.extension)} />
                                    )}
                                </div>
                                <span class={'dialog-object-name'}>{row.name}</span>
                            </div>
                        ))}
                    </ElCol>
                </ElRow>
            </DialogPro>
        );
    },
    options,
);
