import { $t } from '@/utils/i18n-t';
import FileList from '@/components/file-list/index';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import TaskLog from '@/components/log/task/index';
import { newUUID } from '@/utils/id';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
type FormInstance = InstanceType<typeof ElForm>;
import DrawerPro from '@/components/drawer-pro/index';
import CodemirrorPro from '@/components/codemirror-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'build',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref(false);
        const taskLogRef = ref();
        const fileRef = ref();
        const form = reactive({
            taskID: '',
            from: 'path',
            dockerfile: '',
            name: '',
            tagStr: '',
            tags: [] as Array<string>,
            argStr: '',
            args: [] as Array<string>,
        });
        const rules = reactive({
            name: [Rules.requiredInput, Rules.imageName],
            from: [Rules.requiredSelect],
            dockerfile: [Rules.requiredInput],
        });
        const acceptParams = async () => {
            drawerVisible.value = true;
            form.from = 'path';
            form.dockerfile = '';
            form.tagStr = '';
            form.argStr = '';
            form.name = '';
        };
        const handleClose = () => {
            drawerVisible.value = false;
            ctx.emit('search');
        };
        const formRef = ref<FormInstance>();
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                if (form.tagStr !== '') {
                    form.tags = form.tagStr.split('\n');
                }
                if (form.argStr !== '') {
                    form.args = form.argStr.split('\n');
                }
                form.taskID = newUUID();
                await rpc.container.buildImage(form);
                openTaskLog(form.taskID);
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const loadBuildDir = async (path: string) => {
            form.dockerfile = path;
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
                    header={$t('container.imageBuild')}
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
                    <ElForm ref={formRef} label-position="top" model={form} label-width="80px" rules={rules}>
                        <ElFormItem label={$t('commons.table.name')} prop="name">
                            <ElInput
                                placeholder={$t('container.imageNameHelper')}
                                modelValue={form.name}
                                onUpdate:modelValue={($v) => {
                                    form.name = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                                clearable
                            />
                        </ElFormItem>
                        <ElFormItem label="Dockerfile" prop="from">
                            <ElRadioGroup
                                modelValue={form.from}
                                onUpdate:modelValue={($v) => {
                                    form.from = $v as any;
                                }}
                            >
                                <ElRadio value="edit">{$t('commons.button.edit')}</ElRadio>
                                <ElRadio value="path">{$t('container.pathSelect')}</ElRadio>
                            </ElRadioGroup>
                        </ElFormItem>
                        {form.from === 'edit' ? (
                            <ElFormItem rules={Rules.requiredInput}>
                                <CodemirrorPro
                                    modelValue={form.dockerfile}
                                    onUpdate:modelValue={($v) => {
                                        form.dockerfile = $v as any;
                                    }}
                                    mode="dockerfile"
                                    placeholder="#Define or paste the content of your Dockerfile here"
                                />
                            </ElFormItem>
                        ) : (
                            <ElFormItem rules={Rules.requiredSelect} prop="dockerfile">
                                <ElInput
                                    clearable
                                    modelValue={form.dockerfile}
                                    onUpdate:modelValue={($v) => {
                                        form.dockerfile = $v as any;
                                    }}
                                    v-slots={{
                                        prepend: () => (
                                            <>
                                                <ElButton
                                                    icon="Folder"
                                                    onClick={($event?: any) => {
                                                        unref(fileRef).acceptParams({});
                                                    }}
                                                />
                                            </>
                                        ),
                                    }}
                                />
                            </ElFormItem>
                        )}
                        <ElFormItem label={$t('container.buildArgs')}>
                            <ElInput
                                placeholder={$t('container.tagHelper')}
                                type="textarea"
                                rows={3}
                                modelValue={form.argStr}
                                onUpdate:modelValue={($v) => {
                                    form.argStr = $v as any;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('container.tag')}>
                            <ElInput
                                placeholder={$t('container.tagHelper')}
                                type="textarea"
                                rows={3}
                                modelValue={form.tagStr}
                                onUpdate:modelValue={($v) => {
                                    form.tagStr = $v as any;
                                }}
                            />
                        </ElFormItem>
                    </ElForm>
                </DrawerPro>
                <TaskLog ref={taskLogRef} width="70%" />
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (loadBuildDir as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
