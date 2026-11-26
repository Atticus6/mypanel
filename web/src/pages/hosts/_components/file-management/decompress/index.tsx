import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { File } from '@/types/file';
import { Log } from '@/types/log';
import { Rules } from '@/global/form-rules';
import { rpc } from '@/lib/rpc';
import FileList from '@/components/file-list/index';
import TaskLog from '@/components/log/task/index';
import { MsgError } from '@/utils/message';
import { getErrorMessage } from '@/utils/misc';
import { newUUID } from '@/utils/id';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DecompressProps {
    dst: string;
    name: string;
    path: string;
    type: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (arg0?: boolean) => true,
    'task-change': (arg0?: { taskID: string; status: string }) => true,
};

const options = {
    name: 'decompress',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const rules = reactive<FormRules>({
            dst: [Rules.requiredInput],
        });
        const fileForm = ref<FormInstance>();
        const loading = ref(false);
        const canceling = ref(false);
        const stopping = ref(false);
        const abortController = ref<AbortController | null>(null);
        const form = ref<File.FileDeCompress>({ type: 'zip', dst: '', path: '', secret: '' });
        const open = ref(false);
        const title = ref('');
        const fileRef = ref();
        const taskLogRef = ref<InstanceType<typeof TaskLog> | null>(null);
        const currentTaskID = ref('');
        const taskInfo = ref<Log.Task | null>(null);
        let taskTimer: ReturnType<typeof setInterval> | null = null;
        const decompressTaskKey = 'file-management-decompress-task';
        const name = ref('');
        const isTaskExecuting = computed(() => {
            return !!currentTaskID.value && (!taskInfo.value || taskInfo.value.status === 'Executing');
        });
        const showTaskStatus = computed(() =>
            Boolean(currentTaskID.value || loading.value || canceling.value || stopping.value),
        );
        const emitTaskChange = () => {
            const payload = {
                taskID: currentTaskID.value,
                status: taskInfo.value?.status || (currentTaskID.value || loading.value ? 'Executing' : ''),
            };
            if (payload.taskID && payload.status) {
                localStorage.setItem(decompressTaskKey, JSON.stringify(payload));
            } else {
                localStorage.removeItem(decompressTaskKey);
            }
            ctx.emit('task-change', payload);
        };
        const stopTaskPolling = () => {
            if (taskTimer) {
                clearInterval(taskTimer);
                taskTimer = null;
            }
        };
        const loadTaskInfo = async () => {
            if (!currentTaskID.value) {
                taskInfo.value = null;
                emitTaskChange();
                return;
            }
            try {
                const res = await rpc.task.search({
                    taskId: currentTaskID.value,
                    type: '',
                    status: '',
                    page: 1,
                    pageSize: 1,
                });
                const item = res.items?.[0];
                if (!item) {
                    return;
                }
                taskInfo.value = item as any;
                emitTaskChange();
                if (taskInfo.value.status !== 'Executing') {
                    stopTaskPolling();
                    resetDrawerState();
                    ctx.emit('close', false);
                }
            } catch (error) {
                console.error(error);
            }
        };
        const startTaskPolling = () => {
            stopTaskPolling();
            void loadTaskInfo();
            taskTimer = setInterval(() => {
                void loadTaskInfo();
            }, 1500);
        };
        const resetDrawerState = () => {
            if (fileForm.value) {
                fileForm.value.resetFields();
            }
            abortController.value = null;
            canceling.value = false;
            loading.value = false;
            taskInfo.value = null;
            currentTaskID.value = '';
            stopTaskPolling();
            emitTaskChange();
            open.value = false;
        };
        const closeDrawer = () => {
            if (currentTaskID.value && isTaskExecuting.value) {
                open.value = false;
                ctx.emit('close', false);
                return;
            }
            resetDrawerState();
            ctx.emit('close', false);
        };
        const resumeTask = () => {
            if (!currentTaskID.value) {
                return;
            }
            open.value = true;
        };
        const stopCurrentTask = async () => {
            if (stopping.value || (!loading.value && !currentTaskID.value)) {
                return;
            }
            stopping.value = true;
            try {
                if (loading.value) {
                    if (abortController.value) {
                        canceling.value = true;
                        abortController.value.abort();
                    }
                } else if (currentTaskID.value) {
                    await rpc.file.stopDecompress({ taskId: currentTaskID.value });
                }
                open.value = false;
                ctx.emit('close', false);
            } catch (err) {
                MsgError(getErrorMessage(err));
            } finally {
                stopping.value = false;
            }
        };
        const handleClose = () => {
            if (loading.value) {
                stopCurrentTask();
                return;
            }
            closeDrawer();
        };
        const openTaskLog = () => {
            if (!currentTaskID.value) {
                return;
            }
            taskLogRef.value?.openWithTaskID(currentTaskID.value, true, currentNode.value);
        };
        const getLinkPath = (path: string) => {
            form.value.dst = path;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                const taskID = newUUID();
                form.value.taskId = taskID;
                canceling.value = false;
                abortController.value = new AbortController();
                loading.value = true;
                rpc.file
                    .deCompress(form.value, {
                        signal: abortController.value?.signal,
                    })
                    .then(() => {
                        currentTaskID.value = taskID;
                        loading.value = false;
                        taskInfo.value = null;
                        emitTaskChange();
                        startTaskPolling();
                    })
                    .catch((error) => {
                        const message = getErrorMessage(error).toLowerCase();
                        if (canceling.value || message.includes('canceled') || message.includes('errshutdown')) {
                            currentTaskID.value = '';
                            emitTaskChange();
                            return;
                        }
                        currentTaskID.value = '';
                        emitTaskChange();
                        MsgError(getErrorMessage(error));
                    })
                    .finally(() => {
                        loading.value = false;
                        const wasCanceling = canceling.value;
                        abortController.value = null;
                        canceling.value = false;
                        if (wasCanceling) {
                            closeDrawer();
                        }
                    });
            });
        };
        const acceptParams = async (__panelSetupProps: DecompressProps) => {
            if (currentTaskID.value) {
                await loadTaskInfo();
                if (currentTaskID.value) {
                    open.value = true;
                    if (!taskTimer) {
                        startTaskPolling();
                    }
                    emitTaskChange();
                    return;
                }
            }

            form.value.type = __panelSetupProps.type;
            form.value.dst = __panelSetupProps.dst;
            form.value.path = __panelSetupProps.path;
            form.value.secret = '';
            name.value = __panelSetupProps.name;
            abortController.value = null;
            canceling.value = false;
            stopping.value = false;
            taskInfo.value = null;
            currentTaskID.value = '';
            emitTaskChange();
            stopTaskPolling();
            open.value = true;

            title.value = i18n.global.t('file.deCompress');
        };
        const restoreRunningTask = () => {
            const taskText = localStorage.getItem(decompressTaskKey);
            if (!taskText) {
                return;
            }
            try {
                const task = JSON.parse(taskText) as {
                    taskID?: string;
                    status?: string;
                };
                if (!task.taskID) {
                    localStorage.removeItem(decompressTaskKey);
                    return;
                }
                currentTaskID.value = task.taskID;
                if (task.status !== 'Executing') {
                    localStorage.removeItem(decompressTaskKey);
                }
            } catch {
                localStorage.removeItem(decompressTaskKey);
            }
        };
        onMounted(() => {
            restoreRunningTask();
            if (currentTaskID.value) {
                startTaskPolling();
            }
        });
        watch(open, (val) => {
            if (val && currentTaskID.value && !taskTimer) {
                startTaskPolling();
            }
        });
        onUnmounted(() => {
            stopTaskPolling();
        });
        ctx.expose({ acceptParams, resumeTask });
        return () => (
            <>
                <DrawerPro
                    v-model={open.value}
                    header={unref(title)}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    {!unref(currentTaskID) ? (
                                        <>
                                            <ElButton
                                                type={unref(loading) ? 'danger' : 'default'}
                                                loading={unref(canceling)}
                                                onClick={($event?: any) => {
                                                    (handleClose as any)($event);
                                                }}
                                            >
                                                {$t('commons.button.cancel')}
                                            </ElButton>
                                            {!unref(loading) ? (
                                                <ElButton
                                                    type="primary"
                                                    onClick={($event?: any) => {
                                                        submit(unref(fileForm));
                                                    }}
                                                >
                                                    {$t('commons.button.confirm')}
                                                </ElButton>
                                            ) : null}
                                        </>
                                    ) : (
                                        <>
                                            {unref(isTaskExecuting) || unref(loading) ? (
                                                <ElButton
                                                    type="danger"
                                                    loading={unref(stopping)}
                                                    onClick={($event?: any) => {
                                                        (stopCurrentTask as any)($event);
                                                    }}
                                                >
                                                    {$t('commons.button.cancel')}
                                                </ElButton>
                                            ) : null}
                                            {unref(currentTaskID) ? (
                                                <ElButton
                                                    onClick={($event?: any) => {
                                                        (openTaskLog as any)($event);
                                                    }}
                                                >
                                                    {$t('commons.button.log')}
                                                </ElButton>
                                            ) : null}
                                            <ElButton
                                                type="default"
                                                onClick={($event?: any) => {
                                                    (closeDrawer as any)($event);
                                                }}
                                            >
                                                {$t('commons.button.close')}
                                            </ElButton>
                                        </>
                                    )}
                                </span>
                            </>
                        ),
                    }}
                >
                    <div class={'space-y-4'}>
                        {unref(showTaskStatus) ? (
                            <div
                                class={
                                    'rounded-lg border border-[var(--el-border-color-light)] bg-[var(--el-fill-color-light)] px-4 py-3'
                                }
                            >
                                <div class={'flex items-center justify-between gap-3'}>
                                    <div class={'space-y-1'}>
                                        <div class={'text-sm font-medium text-[var(--el-text-color-secondary)]'}>
                                            {$t('commons.status.executing')}
                                        </div>
                                        <div class={'text-xs text-[var(--el-text-color-secondary)]'}>
                                            {unref(taskInfo)?.name || $t('file.deCompress')}
                                        </div>
                                    </div>
                                    <ElButton
                                        link
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (openTaskLog as any)($event);
                                        }}
                                        disabled={!unref(currentTaskID)}
                                    >
                                        {$t('commons.button.log')}
                                    </ElButton>
                                </div>
                                <ElProgress
                                    percentage={100}
                                    indeterminate={true}
                                    duration={1}
                                    stroke-width={8}
                                    show-text={false}
                                    class={'mt-3'}
                                />
                            </div>
                        ) : null}
                        {!unref(currentTaskID) ? (
                            <ElForm
                                ref={fileForm}
                                label-position="top"
                                model={unref(form)}
                                label-width="100px"
                                rules={rules}
                                v-loading={unref(loading)}
                            >
                                <ElFormItem label={$t('commons.table.name')}>
                                    <ElInput v-model={name.value} disabled />
                                </ElFormItem>
                                <ElFormItem label={$t('file.deCompressDst')} prop="dst">
                                    <ElInput
                                        v-model={unref(form).dst}
                                        v-slots={{
                                            prepend: () => (
                                                <>
                                                    <ElButton
                                                        icon="Folder"
                                                        onClick={($event?: any) => {
                                                            unref(fileRef).acceptParams({
                                                                path: unref(form).dst,
                                                                dir: true,
                                                            });
                                                        }}
                                                    />
                                                </>
                                            ),
                                        }}
                                    />
                                </ElFormItem>
                                {unref(name).includes('tar.gz') ? (
                                    <ElFormItem label={$t('setting.compressPassword')} prop="secret">
                                        <ElInput v-model={unref(form).secret} />
                                    </ElFormItem>
                                ) : null}
                            </ElForm>
                        ) : null}
                    </div>
                </DrawerPro>
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (getLinkPath as any)($event);
                    }}
                />
                <TaskLog ref={taskLogRef} />
            </>
        );
    },
    options,
);
