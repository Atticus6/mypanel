import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    name: string;
    path: string;
}
import './index.styles.css';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'delete',
    props: {},
    emits: emits,
    __scopeId: 'data-v-0dd324ed',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        let open = ref(false);
        let loading = ref(false);
        let deleteInfo = ref('');
        const deleteFile = ref();
        const force = ref();
        const composeName = ref();
        const composePath = ref();
        const deleteForm = ref<FormInstance>();
        const acceptParams = async (prop: DialogProps) => {
            deleteFile.value = false;
            force.value = false;
            composeName.value = prop.name;
            composePath.value = prop.path;
            deleteInfo.value = '';
            open.value = true;
        };
        const submit = async () => {
            loading.value = true;
            let params = {
                name: composeName.value,
                path: composePath.value,
                operation: 'delete',
                withFile: deleteFile.value,
                force: force.value,
            };
            await rpc.container
                .operateCompose(params)
                .then(() => {
                    loading.value = false;
                    ctx.emit('search');
                    MsgSuccess(i18n.global.t('commons.msg.deleteSuccess'));
                    open.value = false;
                })
                .catch(() => {
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
                title={$t('commons.button.delete') + ' - ' + unref(composeName)}
                size="small"
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
                                        (submit as any)($event);
                                    }}
                                    disabled={unref(deleteInfo) != unref(composeName) || unref(loading)}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm ref={deleteForm}>
                        <ElFormItem>
                            <ElCheckbox
                                modelValue={unref(deleteFile)}
                                onUpdate:modelValue={($v) => {
                                    deleteFile.value = $v as any;
                                }}
                                label={$t('container.deleteFile')}
                            />
                            <span class={'input-help whitespace-break-spaces'}>
                                {$t('container.deleteComposeHelper')}
                            </span>
                        </ElFormItem>
                        <ElFormItem>
                            <ElCheckbox
                                modelValue={unref(force)}
                                onUpdate:modelValue={($v) => {
                                    force.value = $v as any;
                                }}
                                label={$t('website.forceDelete')}
                            />
                            <span class={'input-help'}>{$t('website.forceDeleteHelper')}</span>
                        </ElFormItem>
                        <ElFormItem>
                            <div class={'font'}>
                                <span>{$t('database.delete')}</span>
                                <span class={'warning'}>{unref(composeName)}</span>
                                <span>{$t('container.deleteCompose')}</span>
                            </div>
                            <ElInput
                                modelValue={unref(deleteInfo)}
                                onUpdate:modelValue={($v) => {
                                    deleteInfo.value = $v as any;
                                }}
                                placeholder={unref(composeName)}
                            />
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DialogPro>
        );
    },
    options,
);
