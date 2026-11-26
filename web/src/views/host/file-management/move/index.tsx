import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { Log } from '@/types/log';
import TaskLog from '@/components/log/task/index';
import FileList from '@/components/file-list/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { FormInstance, FormRules } from 'element-plus';
import { ref, reactive, computed, ComputedRef, onMounted, onUnmounted } from 'vue';
import { MsgError, MsgSuccess } from '@/utils/message';
import { getDateStr } from '@/utils/date';
import { getErrorMessage } from '@/utils/misc';
import { newUUID } from '@/utils/id';
interface MoveProps {
    oldPaths: Array<string>;
    allNames: Array<string>;
    type: string;
    path: string;
    name: string;
    isDir: boolean;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElProgress } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadio } from 'element-plus';
import { ElTransfer } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
    loading: (...args: unknown[]) => true,
};

const options = {
    name: 'move',
    props: {},
    emits: emits,
    __scopeId: 'data-v-bf313e61',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const fileForm = ref<FormInstance>();
        const loading = ref(false);
        const open = ref(false);
        const type = ref('cut');
        const changeName = ref(false);
        const oldName = ref('');
        const existFiles = ref<{ name: string; isDir: boolean }[]>([]);
        const skipFiles = ref([]);
        const transferData = ref([]);
        const fileRef = ref();
        const taskLogRef = ref<InstanceType<typeof TaskLog> | null>(null);
        const currentTaskID = ref('');
        const currentTaskNode = ref('');
        const taskInfo = ref<Log.Task | null>(null);
        const stopping = ref(false);
        const canceling = ref(false);
        let taskTimer: ReturnType<typeof setInterval> | null = null;
        const moveTaskKey = 'file-management-move-task';
        const { currentNode } = useGlobalStore();
        const getMoveTaskKey = (node: string) => `${moveTaskKey}:${node}`;
        const title = computed(() => {
            if (type.value === 'cut') {
                return i18n.global.t('file.move');
            } else {
                return i18n.global.t('commons.button.copy');
            }
        });
        const addForm = reactive({
            oldPaths: [] as string[],
            newPath: '',
            type: '',
            name: '',
            allNames: [] as string[],
            isDir: false,
            cover: false,
            coverPaths: [] as string[],
        });
        const rules = reactive<FormRules>({
            newPath: [Rules.requiredInput],
            name: [Rules.requiredInput],
        });
        const isTaskExecuting = computed(() => {
            return !!currentTaskID.value && (!taskInfo.value || taskInfo.value.status === 'Executing');
        });
        const showTaskStatus = computed(() => {
            return !!currentTaskID.value && (loading.value || isTaskExecuting.value);
        });
        const syncTaskStorage = () => {
            const status = taskInfo.value?.status || (currentTaskID.value || loading.value ? 'Executing' : '');
            const node = currentTaskNode.value || currentNode.value;
            const storageKey = getMoveTaskKey(node);
            if (currentTaskID.value && status === 'Executing') {
                localStorage.setItem(
                    storageKey,
                    JSON.stringify({ taskId: currentTaskID.value, status, type: type.value, node }),
                );
                return;
            }
            localStorage.removeItem(storageKey);
        };
        const stopTaskPolling = () => {
            if (taskTimer) {
                clearInterval(taskTimer);
                taskTimer = null;
            }
        };
        const clearCurrentTask = () => {
            stopTaskPolling();
            localStorage.removeItem(getMoveTaskKey(currentTaskNode.value || currentNode.value));
            currentTaskID.value = '';
            currentTaskNode.value = '';
            taskInfo.value = null;
            loading.value = false;
            stopping.value = false;
            canceling.value = false;
        };
        const resetDrawerState = () => {
            if (fileForm.value) {
                fileForm.value.resetFields();
            }
            changeName.value = false;
            oldName.value = '';
            existFiles.value = [];
            skipFiles.value = [];
            transferData.value = [];
            addForm.oldPaths = [];
            addForm.newPath = '';
            addForm.type = '';
            addForm.name = '';
            addForm.allNames = [];
            addForm.isDir = false;
            addForm.cover = false;
            addForm.coverPaths = [];
            clearCurrentTask();
            open.value = false;
        };
        const closeDrawer = () => {
            if (isTaskExecuting.value) {
                open.value = false;
                return;
            }
            resetDrawerState();
            ctx.emit('close', false);
        };
        const handleClose = () => {
            if (loading.value) {
                void stopCurrentTask();
                return;
            }
            closeDrawer();
        };
        const loadTaskInfo = async () => {
            if (!currentTaskID.value) {
                return;
            }
            const taskID = currentTaskID.value;
            const taskNode = currentTaskNode.value || currentNode.value;
            try {
                const res = await rpc.task.search({
                    taskId: taskID,
                    type: '',
                    status: '',
                    page: 1,
                    pageSize: 1,
                });
                if (currentTaskID.value !== taskID || currentTaskNode.value !== taskNode) {
                    return;
                }
                const item = res.items?.[0];
                if (!item) {
                    return;
                }
                taskInfo.value = item as any;
                syncTaskStorage();
                if (item.status === 'Executing') {
                    return;
                }
                stopTaskPolling();
                if (item.status === 'Success') {
                    if (type.value === 'cut') {
                        MsgSuccess(i18n.global.t('file.moveSuccess'));
                    } else {
                        MsgSuccess(i18n.global.t('file.copySuccess'));
                    }
                    resetDrawerState();
                    ctx.emit('close', true);
                    return;
                }
                if (item.status === 'Canceled') {
                    resetDrawerState();
                    ctx.emit('close', true);
                    return;
                }
                const errorMessage = item.errorMsg || i18n.global.t('commons.msg.operationFailed');
                clearCurrentTask();
                MsgError(errorMessage);
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
        const openTaskLog = () => {
            if (!currentTaskID.value) {
                return;
            }
            taskLogRef.value?.openWithTaskID(currentTaskID.value, true, currentTaskNode.value || currentNode.value);
        };
        const stopCurrentTask = async () => {
            if (!currentTaskID.value || stopping.value) {
                return;
            }
            if (loading.value) {
                canceling.value = true;
                return;
            }
            stopping.value = true;
            try {
                await rpc.file.stopMove({ taskId: currentTaskID.value });
            } catch (error) {
                MsgError(getErrorMessage(error));
            } finally {
                stopping.value = false;
            }
        };
        const getFileName = (filePath: string) => {
            if (filePath.endsWith('/')) {
                filePath = filePath.slice(0, -1);
            }

            return filePath.split('/').pop();
        };
        const coverFiles: ComputedRef<string[]> = computed(() => {
            const existingNames = new Set(
                existFiles.value
                    .filter((item) => !skipFiles.value.includes(item.name) && item.isDir)
                    .map((item) => item.name),
            );
            return addForm.oldPaths.filter((path) => existingNames.has(getFileName(path)));
        });
        const mvFiles: ComputedRef<string[]> = computed(() => {
            const skipSet = new Set(skipFiles.value);
            const coverSet = new Set(coverFiles.value.map(getFileName));

            return addForm.oldPaths.filter((path) => {
                const name = getFileName(path);
                return !skipSet.has(name) && !coverSet.has(name);
            });
        });
        const getPath = (path: string) => {
            addForm.newPath = path;
        };
        const changeType = () => {
            if (addForm.cover) {
                addForm.name = oldName.value;
            } else {
                addForm.name = renameFileWithSuffix(oldName.value, addForm.isDir);
            }
        };
        const mvFile = () => {
            const taskID = newUUID();
            currentTaskID.value = taskID;
            currentTaskNode.value = currentNode.value;
            taskInfo.value = null;
            open.value = true;
            loading.value = true;
            ctx.emit('loading', true);
            syncTaskStorage();
            rpc.file
                .moveFiles({
                    type: addForm.type,
                    oldPaths: addForm.oldPaths,
                    newPath: addForm.newPath,
                    name: addForm.name,
                    cover: addForm.cover,
                    coverPaths: addForm.coverPaths,
                    taskId: taskID,
                })
                .then(async () => {
                    loading.value = false;
                    if (canceling.value) {
                        stopping.value = true;
                        try {
                            await rpc.file.stopMove({ taskId: taskID });
                        } catch (error) {
                            MsgError(getErrorMessage(error));
                        } finally {
                            stopping.value = false;
                        }
                    }
                    startTaskPolling();
                })
                .catch((error) => {
                    clearCurrentTask();
                    MsgError(getErrorMessage(error));
                })
                .finally(() => {
                    loading.value = false;
                    ctx.emit('loading', false);
                });
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                addForm.coverPaths = coverFiles.value;
                addForm.oldPaths = mvFiles.value;
                mvFile();
            });
        };
        const getCompleteExtension = (filename: string): string => {
            const compoundExtensions = [
                '.tar.gz',
                '.tar.bz2',
                '.tar.xz',
                '.tar.lzma',
                '.tar.Z',
                '.tar.zst',
                '.tar.lzo',
                '.tar.sz',
                '.tgz',
                '.tbz2',
                '.txz',
                '.tzst',
            ];
            const foundExtension = compoundExtensions.find((ext) => filename.endsWith(ext));
            if (foundExtension) {
                return foundExtension;
            }
            const match = filename.match(/\.[a-zA-Z0-9]+$/);
            return match ? match[0] : '';
        };
        const renameFileWithSuffix = (fileName: string, isDir: boolean): string => {
            const insertStr = '-' + getDateStr();
            const completeExt = isDir ? '' : getCompleteExtension(fileName);
            if (!completeExt) {
                return `${fileName}${insertStr}`;
            } else {
                const baseName = fileName.slice(0, fileName.length - completeExt.length);
                return `${baseName}${insertStr}${completeExt}`;
            }
        };
        const handleFilePaths = async (fileNames: string[], newPath: string) => {
            const uniqueFiles = [...new Set(fileNames)];
            const fileNamesWithPath = uniqueFiles.map((file) => newPath + '/' + file);
            const existData = (await rpc.file.batchCheckFiles({ paths: fileNamesWithPath })).items;
            existFiles.value = existData;
            transferData.value = existData.map((file) => ({
                key: file.name,
                label: file.name,
            }));
        };
        const acceptParams = async (__panelSetupProps: MoveProps) => {
            if (currentTaskID.value) {
                if (isTaskExecuting.value) {
                    open.value = true;
                    if (!taskTimer) {
                        startTaskPolling();
                    }
                    return;
                }
                resetDrawerState();
            }
            changeName.value = false;
            addForm.oldPaths = __panelSetupProps.oldPaths;
            addForm.type = __panelSetupProps.type;
            addForm.newPath = __panelSetupProps.path;
            addForm.isDir = __panelSetupProps.isDir;
            addForm.name = '';
            addForm.allNames = __panelSetupProps.allNames;
            type.value = __panelSetupProps.type;
            existFiles.value = [];
            addForm.coverPaths = [];
            if (__panelSetupProps.name && __panelSetupProps.name != '') {
                oldName.value = __panelSetupProps.name;
                const exists = (
                    await rpc.file.checkFile({
                        path: __panelSetupProps.path + '/' + __panelSetupProps.name,
                        withInit: false,
                    })
                ).exists;
                if (exists) {
                    changeName.value = true;
                    addForm.cover = false;
                    addForm.name = renameFileWithSuffix(__panelSetupProps.name, addForm.isDir);
                    open.value = true;
                } else {
                    mvFile();
                }
            } else if (__panelSetupProps.allNames && __panelSetupProps.allNames.length > 0) {
                await handleFilePaths(addForm.allNames, addForm.newPath);
                if (existFiles.value.length > 0) {
                    changeName.value = false;
                    open.value = true;
                } else {
                    mvFile();
                }
            } else {
                mvFile();
            }
        };
        const restoreTask = () => {
            const node = currentNode.value;
            const storageKey = getMoveTaskKey(node);
            const taskText = localStorage.getItem(storageKey);
            if (!taskText) {
                return;
            }
            try {
                const task = JSON.parse(taskText) as { taskID?: string; status?: string; type?: string; node?: string };
                if (!task.taskID || task.status !== 'Executing' || task.node !== node) {
                    localStorage.removeItem(storageKey);
                    return;
                }
                currentTaskID.value = task.taskID;
                currentTaskNode.value = node;
                if (task.type === 'copy' || task.type === 'cut') {
                    type.value = task.type;
                }
                taskInfo.value = null;
                startTaskPolling();
            } catch {
                localStorage.removeItem(storageKey);
            }
        };
        onMounted(() => {
            restoreTask();
        });
        onUnmounted(() => {
            stopTaskPolling();
        });
        ctx.expose({ acceptParams });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={unref(title)}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="690"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    {!unref(currentTaskID) ? (
                                        <>
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    (handleClose as any)($event);
                                                }}
                                                disabled={unref(loading)}
                                            >
                                                {$t('commons.button.cancel')}
                                            </ElButton>
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    submit(unref(fileForm));
                                                }}
                                                disabled={unref(loading)}
                                            >
                                                {$t('commons.button.confirm')}
                                            </ElButton>
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
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    (openTaskLog as any)($event);
                                                }}
                                            >
                                                {$t('commons.button.log')}
                                            </ElButton>
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
                                            {unref(taskInfo)?.name || unref(title)}
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
                        {!unref(currentTaskID)
                            ? withDirectives(
                                  <ElForm
                                      onSubmit={($event?: any) => {
                                          $event.preventDefault();
                                      }}
                                      ref={fileForm}
                                      label-position="top"
                                      model={addForm}
                                      rules={rules}
                                  >
                                      {unref(type) == 'cut' &&
                                      unref(existFiles)?.length == 0 &&
                                      addForm.cover &&
                                      unref(changeName) ? (
                                          <ElAlert
                                              show-icon
                                              type="warning"
                                              closable={false}
                                              v-slots={{
                                                  title: () => (
                                                      <>
                                                          <span class={'whitespace-break-spaces'}>
                                                              {$t('file.coverDirHelper')}
                                                          </span>
                                                      </>
                                                  ),
                                              }}
                                          />
                                      ) : null}
                                      <ElFormItem label={$t('file.path')} prop="newPath">
                                          <ElInput
                                              modelValue={addForm.newPath}
                                              onUpdate:modelValue={($v) => {
                                                  addForm.newPath = $v as any;
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
                                      {unref(changeName) ? (
                                          <div>
                                              <ElFormItem label={$t('commons.table.name')} prop="name">
                                                  <ElInput
                                                      modelValue={addForm.name}
                                                      onUpdate:modelValue={($v) => {
                                                          addForm.name = $v as any;
                                                      }}
                                                      disabled={addForm.cover}
                                                  />
                                              </ElFormItem>
                                              <ElRadioGroup
                                                  modelValue={addForm.cover}
                                                  onUpdate:modelValue={($v) => {
                                                      addForm.cover = $v as any;
                                                  }}
                                                  onChange={($event?: any) => {
                                                      (changeType as any)($event);
                                                  }}
                                              >
                                                  <ElRadio value={true} size="large">
                                                      {$t('file.replace')}
                                                  </ElRadio>
                                                  <ElRadio value={false} size="large">
                                                      {$t('file.rename')}
                                                  </ElRadio>
                                              </ElRadioGroup>
                                          </div>
                                      ) : null}
                                      {unref(existFiles).length > 0 && !unref(changeName) ? (
                                          <div class={'text-center'}>
                                              <ElAlert
                                                  show-icon
                                                  type="warning"
                                                  closable={false}
                                                  v-slots={{
                                                      title: () => (
                                                          <>
                                                              <span class={'whitespace-break-spaces'}>
                                                                  {$t('file.existFileDirHelper') +
                                                                      $t('file.coverDirHelper')}
                                                              </span>
                                                          </>
                                                      ),
                                                  }}
                                              />
                                              <ElTransfer
                                                  modelValue={unref(skipFiles)}
                                                  onUpdate:modelValue={($v) => {
                                                      skipFiles.value = $v as any;
                                                  }}
                                                  titles={[$t('commons.button.cover'), $t('commons.button.skip')]}
                                                  format={{
                                                      noChecked: '${total}',
                                                      hasChecked: '${checked}/${total}',
                                                  }}
                                                  data={unref(transferData)}
                                                  class={'text-left inline-block mt-4'}
                                              />
                                          </div>
                                      ) : null}
                                  </ElForm>,
                                  [[vLoading, unref(loading)]],
                              )
                            : null}
                    </div>
                </DrawerPro>
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (getPath as any)($event);
                    }}
                />
                <TaskLog ref={taskLogRef} />
            </>
        );
    },
    options,
);
