import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { Container } from '@/types/container';
import { MsgSuccess } from '@/utils/message';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    title: string;
    rowData?: Container.TemplateInfo;
    getTableList?: () => Promise<any>;
}
type FormInstance = InstanceType<typeof ElForm>;
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'operator',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const title = ref<string>('');
        const drawerVisible = ref(false);
        const dialogData = ref<DialogProps>({
            title: '',
        });
        const acceptParams = (params: DialogProps): void => {
            dialogData.value = params;
            title.value = i18n.global.t('commons.button.' + dialogData.value.title);
            drawerVisible.value = true;
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const rules = reactive({
            name: [Rules.requiredInput, Rules.name],
            content: [Rules.requiredInput],
        });
        const formRef = ref<FormInstance>();
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                if (dialogData.value.title === 'create') {
                    await rpc.container
                        .createTemplate(dialogData.value.rowData! as any)
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            ctx.emit('search');
                            drawerVisible.value = false;
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                    return;
                }
                await rpc.container
                    .updateTemplate(dialogData.value.rowData! as any)
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        ctx.emit('search');
                        drawerVisible.value = false;
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
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('container.composeTemplate')}
                resource={unref(dialogData).title === 'create' ? '' : unref(dialogData).rowData?.name}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                autoClose={false}
                fullScreen={true}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        onSubmit(unref(formRef));
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
                    <ElForm
                        label-position="top"
                        ref={formRef}
                        model={unref(dialogData).rowData}
                        rules={rules}
                        label-width="80px"
                    >
                        <ElFormItem label={$t('commons.table.name')} prop="name">
                            <ElInput
                                disabled={unref(dialogData).title === 'edit'}
                                modelValue={unref(dialogData).rowData!.name}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.name = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.description')}>
                            <ElInput
                                modelValue={unref(dialogData).rowData!.description}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.description = $v as any;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem>
                            <CodemirrorPro
                                placeholder="#Define or paste the content of your docker-compose file here"
                                modelValue={unref(dialogData).rowData!.content}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.content = $v as any;
                                }}
                                mode="yaml"
                                heightDiff={400}
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
