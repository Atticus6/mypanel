import { $t } from '@/utils/i18n-t';
import FileList from '@/components/file-list/index';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { imageSave } from '@/api/modules/container';
import { Container } from '@/types/container';
import TaskLog from '@/components/log/task/index';
import { MsgSuccess } from '@/utils/message';
import { newUUID } from '@/utils/id';
interface DialogProps {
    repos: Array<Container.RepoOptions>;
    tags: Array<string>;
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
    name: 'save',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const fileRef = ref();
        const taskLogRef = ref();
        const drawerVisible = ref(false);
        const form = reactive({
            taskID: '',
            tags: [] as Array<string>,
            tagName: '',
            path: '',
            name: '',
        });
        const dialogData = ref<DialogProps>({
            repos: [] as Array<Container.RepoOptions>,
            tags: [] as Array<string>,
        });
        const acceptParams = async (params: DialogProps): Promise<void> => {
            drawerVisible.value = true;
            form.tags = params.tags;
            form.tagName = form.tags.length !== 0 ? form.tags[0] : '';
            form.path = '';
            form.name = '';
            dialogData.value.repos = params.repos;
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const formRef = ref<FormInstance>();
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                form.taskID = newUUID();
                await imageSave(form)
                    .then(() => {
                        loading.value = false;
                        drawerVisible.value = false;
                        ctx.emit('search');
                        openTaskLog(form.taskID);
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const loadSaveDir = async (path: string) => {
            form.path = path;
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
                    header={$t('container.exportImage')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="small"
                    v-slots={{
                        footer: () => (
                            <>
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
                                    {$t('container.export')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm label-position="top" ref={formRef} model={form} label-width="80px">
                            <ElFormItem label={$t('container.tag')} rules={Rules.requiredSelect} prop="tagName">
                                <ElSelect
                                    filterable
                                    modelValue={form.tagName}
                                    onUpdate:modelValue={($v) => {
                                        form.tagName = $v as any;
                                    }}
                                >
                                    {(form.tags || []).map((item) => (
                                        <ElOption
                                            disabled={item.indexOf(':<none>') !== -1}
                                            value={item}
                                            label={item}
                                            key={item}
                                        />
                                    ))}
                                </ElSelect>
                            </ElFormItem>
                            <ElFormItem label={$t('container.path')} rules={Rules.requiredInput} prop="path">
                                <ElInput
                                    modelValue={form.path}
                                    onUpdate:modelValue={($v) => {
                                        form.path = $v as any;
                                    }}
                                    v-slots={{
                                        prepend: () => (
                                            <>
                                                <ElButton
                                                    icon="Folder"
                                                    onClick={($event?: any) => {
                                                        unref(fileRef).acceptParams({ dir: true });
                                                    }}
                                                />
                                            </>
                                        ),
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('container.fileName')} rules={Rules.requiredInput} prop="name">
                                <ElInput
                                    modelValue={form.name}
                                    onUpdate:modelValue={($v) => {
                                        form.name = $v as any;
                                    }}
                                    v-slots={{ append: () => <>{'.tar'}</> }}
                                />
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (loadSaveDir as any)($event);
                    }}
                />
                <TaskLog ref={taskLogRef} width="70%" />
            </>
        );
    },
    options,
);
