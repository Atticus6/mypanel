import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import { FormInstance, FormRules } from 'element-plus';
import { reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
interface OwnerProps {
    path: string;
    user: string;
    group: string;
    isDir: boolean;
    name: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'chown',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const fileForm = ref<FormInstance>();
        const loading = ref(false);
        const open = ref(false);
        const isDir = ref(false);
        const name = ref('');
        const addForm = reactive({
            path: '',
            user: '',
            group: '',
            sub: false,
        });
        const rules = reactive<FormRules>({
            user: [Rules.requiredInput],
            group: [Rules.requiredInput],
        });
        const handleClose = () => {
            open.value = false;
            if (fileForm.value) {
                fileForm.value.resetFields();
            }
            ctx.emit('close', false);
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;
                rpc.file
                    .changeOwner(addForm)
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        handleClose();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const acceptParams = (__panelSetupProps: OwnerProps) => {
            addForm.user = __panelSetupProps.user;
            addForm.path = __panelSetupProps.path;
            addForm.group = __panelSetupProps.group;
            isDir.value = __panelSetupProps.isDir;
            name.value = __panelSetupProps.name;
            open.value = true;
        };
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('file.setRole')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                resource={unref(name)}
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
                <ElAlert title={$t('file.ownerHelper')} type="info" closable={false} class={'common-prompt'} />
                {withDirectives(
                    <ElForm ref={fileForm} label-position="top" model={addForm} label-width="100px" rules={rules}>
                        <ElFormItem label={$t('commons.table.user')} prop="user">
                            <ElInput
                                modelValue={addForm.user}
                                onUpdate:modelValue={($v) => {
                                    addForm.user = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('file.group')} prop="group">
                            <ElInput
                                modelValue={addForm.group}
                                onUpdate:modelValue={($v) => {
                                    addForm.group = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        {unref(isDir) ? (
                            <ElFormItem>
                                <ElCheckbox
                                    modelValue={addForm.sub}
                                    onUpdate:modelValue={($v) => {
                                        addForm.sub = $v as any;
                                    }}
                                >
                                    {$t('file.containSub')}
                                </ElCheckbox>
                            </ElFormItem>
                        ) : null}
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
