import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { Container } from '@/types/container';
import TaskLog from '@/components/log/task/index';
import { MsgSuccess } from '@/utils/message';
import { newUUID } from '@/utils/id';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    repos: Array<Container.RepoOptions>;
    imageName?: string;
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
    name: 'pull',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref(false);
        const form = reactive({
            taskID: '',
            fromRepo: true,
            repoID: null as number,
            imageName: [] as string[],
        });
        const verifyImage = (rule: any, value: any, callback: any) => {
            if (!value || value.length === 0) {
                callback(new Error(i18n.global.t('commons.rule.requiredInput')));
                return;
            }
            for (const item of value) {
                if (item === '' || typeof item === 'undefined' || item == null) {
                    callback(new Error(i18n.global.t('commons.rule.imageName')));
                } else {
                    const reg = /^[a-zA-Z0-9]{1}[a-z:@A-Z0-9_/.-]{0,255}$/;
                    if (!reg.test(item) && item !== '') {
                        callback(new Error(i18n.global.t('commons.rule.imageName')));
                        return;
                    }
                }
            }
            callback();
        };
        const rules = reactive({
            imageName: [{ validator: verifyImage, trigger: 'blur', required: true }],
            repoID: Rules.requiredSelect,
        });
        const taskLogRef = ref();
        const repos = ref();
        const acceptParams = async (params: DialogProps): Promise<void> => {
            drawerVisible.value = true;
            form.fromRepo = true;
            form.imageName = params.imageName ? [params.imageName] : [];
            repos.value = params.repos || [];
            form.repoID = params.imageName ? null : 1;
            for (const item of repos.value) {
                if (item.name === 'Docker Hub' && item.downloadUrl === 'docker.io') {
                    form.repoID = item.id;
                    break;
                }
            }
            if (params.imageName && form.repoID === null) {
                form.fromRepo = false;
                form.imageName = [`docker.io/${params.imageName}`];
            }
        };
        const formRef = ref<FormInstance>();
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                if (!form.fromRepo) {
                    form.repoID = 0;
                }
                form.taskID = newUUID();
                await rpc.container.pullImages(form);
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
            for (const item of repos.value) {
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
                    modelValue={unref(drawerVisible)}
                    onUpdate:modelValue={($v) => {
                        drawerVisible.value = $v as any;
                    }}
                    header={$t('container.imagePull')}
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
                                        {$t('container.pull')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    <ElForm ref={formRef} label-position="top" model={form} rules={rules}>
                        <ElFormItem label={$t('app.source')}>
                            <ElCheckbox
                                modelValue={form.fromRepo}
                                onUpdate:modelValue={($v) => {
                                    form.fromRepo = $v as any;
                                }}
                            >
                                {$t('container.imageRepo')}
                            </ElCheckbox>
                        </ElFormItem>
                        {form.fromRepo ? (
                            <ElFormItem label={$t('container.repoName')} prop="repoID">
                                <ElSelect
                                    clearable
                                    filterable
                                    modelValue={form.repoID}
                                    onUpdate:modelValue={($v) => {
                                        form.repoID = $v as any;
                                    }}
                                    style={'width: 100%'}
                                >
                                    {(unref(repos) || []).map((item) => (
                                        <ElOption value={item.id} label={item.name} key={item.id} />
                                    ))}
                                </ElSelect>
                            </ElFormItem>
                        ) : null}
                        <ElFormItem label={$t('container.imageName')} prop="imageName">
                            {form.fromRepo ? (
                                <ElInputTag
                                    modelValue={form.imageName}
                                    onUpdate:modelValue={($v) => {
                                        form.imageName = $v as any;
                                    }}
                                    v-slots={{
                                        prefix: () => (
                                            <>
                                                {loadDetailInfo(form.repoID)}
                                                {'/'}
                                            </>
                                        ),
                                    }}
                                />
                            ) : (
                                <ElInputTag
                                    modelValue={form.imageName}
                                    onUpdate:modelValue={($v) => {
                                        form.imageName = $v as any;
                                    }}
                                />
                            )}
                            <span class={'input-help'}>{$t('container.imagePullHelper')}</span>
                        </ElFormItem>
                    </ElForm>
                </DrawerPro>
                <TaskLog ref={taskLogRef} width="70%" />
            </>
        );
    },
    options,
);
