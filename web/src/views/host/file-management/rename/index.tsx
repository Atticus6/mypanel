import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import { File } from '@/types/file';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
interface RenameProps {
    path: string;
    oldName: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'rename',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const fileForm = ref<FormInstance>();
        const loading = ref(false);
        const open = ref(false);
        const oldName = ref('');
        const addForm = reactive({
            newName: '',
            path: '',
        });
        const rules = reactive<FormRules>({
            newName: [Rules.requiredInput],
        });
        const handleClose = () => {
            open.value = false;
            if (fileForm.value) {
                fileForm.value.resetFields();
            }
            ctx.emit('close', false);
        };
        const getPath = (path: string, name: string) => {
            return path + '/' + name;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }

                let addItem = {};
                Object.assign(addItem, addForm);
                addItem['oldName'] = getPath(addForm.path, oldName.value);
                addItem['newName'] = getPath(addForm.path, addForm.newName);
                loading.value = true;
                rpc.file
                    .changeName(addItem as { oldName: string; newName: string })
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        handleClose();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const acceptParams = (__panelSetupProps: RenameProps) => {
            oldName.value = __panelSetupProps.oldName;
            addForm.newName = __panelSetupProps.oldName;
            addForm.path = __panelSetupProps.path;
            open.value = true;
        };
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('file.rename')}
                resource={unref(oldName)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="normal"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit(unref(fileForm));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm ref={fileForm} label-position="top" model={addForm} label-width="100px" rules={rules}>
                        <ElFormItem label={$t('file.path')} prop="path">
                            <ElInput
                                modelValue={addForm.path}
                                onUpdate:modelValue={($v) => {
                                    addForm.path = $v as any;
                                }}
                                disabled
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.name')} prop="newName">
                            <ElInput
                                modelValue={addForm.newName}
                                onUpdate:modelValue={($v) => {
                                    addForm.newName = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
