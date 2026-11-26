import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { Container } from '@/types/container';
import { MsgSuccess } from '@/utils/message';
import TaskLog from '@/components/log/task/index';
import { newUUID } from '@/utils/id';
import { rpc } from '@/lib/rpc';
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
    name: 'push',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref(false);
        const taskLogRef = ref();
        const form = reactive({
            taskID: '',
            tags: [] as Array<string>,
            tagName: '',
            repoID: 1,
            name: '',
        });
        const dialogData = ref<DialogProps>({
            repos: [] as Array<Container.RepoOptions>,
            tags: [] as Array<string>,
        });
        const acceptParams = async (params: DialogProps): Promise<void> => {
            drawerVisible.value = true;
            form.tags = params.tags;
            form.repoID = 1;
            form.tagName = form.tags.length !== 0 ? form.tags[0] : '';
            form.name = form.tags.length !== 0 ? form.tags[0] : '';
            dialogData.value.repos = params.repos;
        };
        const formRef = ref<FormInstance>();
        const handleChange = () => {
            let repoURL = loadDetailInfo(form.repoID);
            form.name =
                form.tagName.indexOf(repoURL) !== -1 ? form.tagName.replaceAll(repoURL + '/', '') : form.tagName;
        };
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                form.taskID = newUUID();
                await rpc.container.pushImage(form);
                openTaskLog(form.taskID);
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const onCloseLog = async () => {
            ctx.emit('search');
            drawerVisible.value = false;
        };
        function loadDetailInfo(id: number) {
            for (const item of dialogData.value.repos) {
                if (item.id === id) {
                    return item.downloadUrl;
                }
            }
            return '';
        }
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    v-model={drawerVisible.value}
                    header={$t('container.imagePush')}
                    onClose={($event?: any) => {
                        (onCloseLog as any)($event);
                    }}
                    size="large"
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
                                        {$t('container.push')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    <ElForm ref={formRef} label-position="top" model={form} label-width="80px">
                        <ElFormItem label={$t('container.tag')} rules={Rules.requiredSelect} prop="tagName">
                            <ElSelect
                                filterable
                                v-model={form.tagName}
                                onChange={($event?: any) => {
                                    (handleChange as any)($event);
                                }}
                            >
                                {(form.tags || []).map((item) => (
                                    <ElOption value={item} label={item} key={item} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('container.repoName')} rules={Rules.requiredSelect} prop="repoID">
                            <ElSelect
                                clearable
                                filterable
                                v-model={form.repoID}
                                onChange={($event?: any) => {
                                    (handleChange as any)($event);
                                }}
                                class={'w-full'}
                            >
                                {(unref(dialogData).repos || []).map((item) => (
                                    <ElOption value={item.id} label={item.name} key={item.id} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('container.image')} rules={Rules.imageName} prop="name">
                            <ElInput
                                modelValue={form.name}
                                onUpdate:modelValue={($v) => {
                                    form.name = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                                v-slots={{
                                    prepend: () => (
                                        <>
                                            {loadDetailInfo(form.repoID)}
                                            {'/'}
                                        </>
                                    ),
                                }}
                            />
                            {form.tags?.length !== 1 ? (
                                <span class={'input-help'}>
                                    {$t('container.imagePushHelper', [loadDetailInfo(form.repoID) + '/' + form.name])}
                                </span>
                            ) : null}
                        </ElFormItem>
                    </ElForm>
                </DrawerPro>
                <TaskLog ref={taskLogRef} width="70%" />
            </>
        );
    },
    options,
);
