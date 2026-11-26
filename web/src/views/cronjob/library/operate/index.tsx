import { $t } from '@/utils/i18n-t';
interface ScriptInfo {
    id: number;
    name: string;
    script: string;
    groups: string;
    isInteractive: boolean;
    groupList: Array<number>;
    groupBelong: Array<string>;
    description: string;
    createdAt: Date;
}
import { reactive, ref } from 'vue';
import i18n from '@/lang';
import { ElForm } from 'element-plus';
import { MsgSuccess } from '@/utils/message';
import { Rules } from '@/global/form-rules';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    title: string;
    rowData?: ScriptInfo;
    getTableList?: () => Promise<any>;
}
type FormInstance = InstanceType<typeof ElForm>;
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import CodemirrorPro from '@/components/codemirror-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'operate',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const title = ref<string>('');
        const drawerVisible = ref(false);
        const dialogData = ref<DialogProps>({
            title: '',
        });
        const loading = ref();
        const groupOptions = ref();
        const acceptParams = (params: DialogProps): void => {
            dialogData.value = params;
            title.value = i18n.global.t('commons.button.' + dialogData.value.title);
            loadGroupOptions();
            drawerVisible.value = true;
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const rules = reactive({
            name: [Rules.requiredInput],
            script: [Rules.requiredInput],
        });
        const formRef = ref<FormInstance>();
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                if (dialogData.value.rowData.groupList?.length !== 0) {
                    dialogData.value.rowData.groups = dialogData.value.rowData.groupList?.join(',');
                }
                if (dialogData.value.title === 'create' || dialogData.value.title === 'clone') {
                    await rpc.core.script
                        .create(dialogData.value.rowData as any)
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

                await rpc.core.script
                    .update(dialogData.value.rowData as any)
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
        const loadGroupOptions = async () => {
            const res = await rpc.core.group.list({ type: 'script' });
            groupOptions.value = (res.items as any) || [];
            if (dialogData.value.title !== 'create') {
                return;
            }
            for (const group of groupOptions.value) {
                if (group.isDefault) {
                    dialogData.value.rowData.groupList = [group.id];
                    break;
                }
            }
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
                header={unref(title)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                resource={unref(dialogData).title !== 'edit' ? '' : unref(dialogData).rowData?.name}
                size="large"
                autoClose={false}
                fullScreen={true}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
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
                    <ElForm ref={formRef} label-position="top" model={unref(dialogData).rowData} rules={rules}>
                        <ElFormItem label={$t('commons.table.name')} prop="name">
                            {unref(dialogData).title === 'edit' ? (
                                <ElTag>{unref(dialogData).rowData!.name}</ElTag>
                            ) : (
                                <ElInput
                                    modelValue={unref(dialogData).rowData!.name}
                                    onUpdate:modelValue={($v) => {
                                        unref(dialogData).rowData!.name = $v as any;
                                    }}
                                />
                            )}
                        </ElFormItem>
                        <ElFormItem prop="isInteractive">
                            <ElCheckbox
                                modelValue={unref(dialogData).rowData!.isInteractive}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.isInteractive = $v as any;
                                }}
                            >
                                {$t('cronjob.library.interactive')}
                            </ElCheckbox>
                            <span class={'input-help'}>{$t('cronjob.library.interactiveHelper')}</span>
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.group')} prop="groupList">
                            <ElSelect
                                filterable
                                modelValue={unref(dialogData).rowData!.groupList}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.groupList = $v as any;
                                }}
                                multiple
                            >
                                {(unref(groupOptions) || []).map((item) => (
                                    <ElOption label={item.name} value={item.id} key={item.id} />
                                ))}
                            </ElSelect>
                            <span class={'input-help'}>{$t('cronjob.library.groupHelper')}</span>
                        </ElFormItem>
                        <ElFormItem label={$t('cronjob.shellContent')} prop="script" class={'mt-5'}>
                            <CodemirrorPro
                                modelValue={unref(dialogData).rowData!.script}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.script = $v as any;
                                }}
                                placeholder="#Define or paste the content of your script file here"
                                mode="javascript"
                                heightDiff={400}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.description')} prop="description">
                            <ElInput
                                clearable
                                modelValue={unref(dialogData).rowData!.description}
                                onUpdate:modelValue={($v) => {
                                    unref(dialogData).rowData!.description = $v as any;
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
