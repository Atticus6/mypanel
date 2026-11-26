import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { Rules } from '@/global/form-rules';
import { rpc } from '@/lib/rpc';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'custom',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const rewriteForm = ref<FormInstance>();
        const open = ref(false);
        const loading = ref(false);
        const req = ref({
            name: '',
            operate: 'create',
            content: '',
        });
        const rules = ref({
            name: [Rules.requiredInput],
        });
        const handleClose = () => {
            rewriteForm.value?.resetFields();
            open.value = false;
            ctx.emit('close', false);
        };
        const acceptParams = async (conetnt: string) => {
            req.value.content = conetnt;
            open.value = true;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;
                rpc.website
                    .operateCustomRewrite(req.value as any)
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                        handleClose();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={$t('website.saveCustom')}
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
                                            submit(unref(rewriteForm));
                                        }}
                                        disabled={unref(loading)}
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
                <ElForm ref={rewriteForm} label-position="top" model={unref(req)} rules={unref(rules)}>
                    <ElFormItem label={$t('commons.table.name')} prop="name">
                        <ElInput v-model={unref(req).name} />
                    </ElFormItem>
                </ElForm>
            </DrawerPro>
        );
    },
    options,
);
