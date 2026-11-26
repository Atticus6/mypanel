import { $t } from '@/utils/i18n-t';
import FileList from '@/components/file-list/index';
import TaskLog from '@/components/log/task/index';
import i18n from '@/lang';
import { imageLoad } from '@/api/modules/container';
import { stopChunkUpload } from '@/api/modules/files';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { MsgError, MsgSuccess } from '@/utils/message';
import { computeSize } from '@/utils/size';
import { newUUID } from '@/utils/id';
import { CHUNK_SIZE, uploadChunkWithRetry } from '@/utils/chunk-upload';
import DrawerPro from '@/components/drawer-pro/index';
import { UploadFilled } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'load',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const loading = ref(false);
        const uploading = ref(false);
        const busy = computed(() => loading.value || uploading.value);
        const fileRef = ref();
        const taskLogRef = ref();
        const uploadRef = ref<UploadInstance>();
        const loadVisible = ref(false);
        const source = ref<'server' | 'local'>('local');
        const operateNode = ref('');
        const form = reactive({ path: '', paths: [] as string[] });
        const localFile = ref<UploadRawFile>();
        const uploadPercent = ref(0);
        const uploadFailed = ref(false);
        const uploadedPath = ref('');
        const submittedTaskID = ref('');
        let uploadID = '';
        let uploadController: AbortController | undefined;
        let disposed = false;
        const acceptParams = () => {
            if (busy.value) return;
            operateNode.value = currentNode.value;
            source.value = 'local';
            form.path = '';
            form.paths = [];
            localFile.value = undefined;
            uploadedPath.value = '';
            uploadPercent.value = 0;
            uploadFailed.value = false;
            submittedTaskID.value = '';
            uploadRef.value?.clearFiles();
            loadVisible.value = true;
        };
        const beforeClose = (done: () => void) => {
            if (!busy.value) done();
        };
        const onServerSelect = () => {
            if (busy.value) return;
            source.value = 'server';
            fileRef.value.acceptParams({ dir: false, multiple: true });
        };
        const onFileChange = (file: UploadFile) => {
            if (!file.raw || busy.value) return;
            if (file.raw.size === 0) {
                MsgError(i18n.global.t('container.imageUploadEmpty'));
                uploadRef.value?.clearFiles();
                return;
            }
            localFile.value = file.raw;
            uploadedPath.value = '';
            submittedTaskID.value = '';
            void uploadLocalFile();
        };
        const onFileExceed: UploadProps['onExceed'] = (files) => {
            if (busy.value || !files.length) return;
            uploadRef.value?.clearFiles();
            const file = files[0] as UploadRawFile;
            file.uid = genFileId();
            uploadRef.value?.handleStart(file);
        };
        const uploadLocalFile = async () => {
            const file = localFile.value;
            if (!file || busy.value) return;
            uploading.value = true;
            uploadFailed.value = false;
            uploadPercent.value = 0;
            const node = operateNode.value;
            const id = newUUID();
            uploadID = id;
            const controller = new AbortController();
            uploadController = controller;
            try {
                const { path: baseDir } = await rpc.agentSetting.getBaseDir({});
                controller.signal.throwIfAborted();
                const directory = `${baseDir}/uploads/image/${id}`;
                const count = Math.ceil(file.size / CHUNK_SIZE);
                for (let index = 0; index < count; index++) {
                    const data = new FormData();
                    data.append('filename', file.name);
                    data.append('path', directory);
                    data.append('uploadID', id);
                    data.append('chunk', file.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
                    data.append('chunkIndex', String(index));
                    data.append('chunkCount', String(count));
                    data.append('offset', String(index * CHUNK_SIZE));
                    data.append('fileSize', String(file.size));
                    await uploadChunkWithRetry(
                        data,
                        {
                            headers: { CurrentNode: node },
                            signal: controller.signal,
                            skipErrorMessage: true,
                            timeout: 0,
                            onUploadProgress: (event: { total?: number; loaded: number }) => {
                                const fraction = event.total ? Math.min(1, event.loaded / event.total) : 0;
                                uploadPercent.value = Math.min(99, Math.floor(((index + fraction) * 100) / count));
                            },
                        },
                        controller.signal,
                    );
                }
                controller.signal.throwIfAborted();
                uploadedPath.value = `${directory}/${file.name}`;
                uploadPercent.value = 100;
            } catch {
                if (!controller.signal.aborted) uploadFailed.value = true;
                await stopChunkUpload(id, node).catch(() => {});
                return;
            } finally {
                uploading.value = false;
                uploadController = undefined;
                uploadID = '';
            }
            if (!disposed && currentNode.value === node) await onSubmit();
        };
        const openTaskLog = () => {
            taskLogRef.value.openWithTaskID(submittedTaskID.value, true, operateNode.value);
        };
        const onSubmit = async () => {
            const paths = source.value === 'local' ? [uploadedPath.value].filter(Boolean) : [...form.paths];
            if (busy.value || submittedTaskID.value || !paths.length) return;
            loading.value = true;
            const taskID = newUUID();
            const node = operateNode.value;
            submittedTaskID.value = taskID;
            try {
                await imageLoad({ paths, taskID }, node);
                if (disposed || currentNode.value !== node) return;
                loadVisible.value = false;
                openTaskLog();
                MsgSuccess(i18n.global.t('container.imageImportSubmitted'));
            } catch {
                return;
            } finally {
                loading.value = false;
            }
        };
        const handlePathChange = () => {
            submittedTaskID.value = '';
            form.paths = [
                ...new Set(
                    form.path
                        .split(';')
                        .map((path) => path.trim())
                        .filter(Boolean),
                ),
            ];
        };
        const loadLoadDir = (paths: string | string[]) => {
            if (currentNode.value !== operateNode.value) return;
            source.value = 'server';
            submittedTaskID.value = '';
            form.paths = [...new Set(Array.isArray(paths) ? paths : [paths])];
            form.path = form.paths.join('; ');
        };
        watch(currentNode, () => {
            loadVisible.value = false;
            uploadController?.abort();
        });
        onBeforeUnmount(() => {
            disposed = true;
            uploadController?.abort();
            if (uploadID) void stopChunkUpload(uploadID, operateNode.value).catch(() => {});
        });
        ctx.expose({ acceptParams });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(loadVisible)}
                    onUpdate:modelValue={($v) => {
                        loadVisible.value = $v as any;
                    }}
                    header={$t('container.importImage')}
                    auto-close={!unref(busy)}
                    confirm-before-close={true}
                    onBeforeClose={($event?: any) => {
                        (beforeClose as any)($event);
                    }}
                    size="small"
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    disabled={unref(busy)}
                                    onClick={($event?: any) => {
                                        loadVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {unref(source) === 'server' ? (
                                    <ElButton
                                        disabled={unref(busy) || !!unref(submittedTaskID) || !form.paths.length}
                                        loading={unref(loading)}
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (onSubmit as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.import')}
                                    </ElButton>
                                ) : null}
                            </>
                        ),
                    }}
                >
                    <ElForm
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        label-position="top"
                    >
                        <div class={'mb-5 flex items-center gap-3'}>
                            <ElButton
                                disabled={unref(busy)}
                                onClick={($event?: any) => {
                                    source.value = 'local';
                                }}
                            >
                                {$t('database.localUpload')}
                            </ElButton>
                            <ElButton
                                disabled={unref(busy)}
                                onClick={($event?: any) => {
                                    (onServerSelect as any)($event);
                                }}
                            >
                                {$t('database.hostSelect')}
                            </ElButton>
                        </div>
                        {unref(source) === 'server' ? (
                            <ElFormItem label={$t('container.path')}>
                                <ElInput
                                    modelValue={form.path}
                                    onUpdate:modelValue={($v) => {
                                        form.path = $v as any;
                                    }}
                                    disabled={unref(busy)}
                                    onInput={($event?: any) => {
                                        (handlePathChange as any)($event);
                                    }}
                                />
                            </ElFormItem>
                        ) : (
                            <>
                                <ElUpload
                                    ref={uploadRef}
                                    drag
                                    limit={1}
                                    auto-upload={false}
                                    show-file-list={false}
                                    disabled={unref(busy)}
                                    on-change={onFileChange}
                                    on-exceed={onFileExceed}
                                >
                                    <ElIcon class={'el-icon--upload'}>
                                        <UploadFilled />
                                    </ElIcon>
                                    <div class={'el-upload__text'}>{$t('container.imageUploadDrop')}</div>
                                </ElUpload>
                                <p class={'input-help'}>{$t('container.imageUploadHelper')}</p>
                                {unref(localFile) ? (
                                    <>
                                        <p class={'break-all'}>
                                            {unref(localFile).name}
                                            {' ('}
                                            {computeSize(unref(localFile).size)}
                                            {')'}
                                        </p>
                                        <ElProgress
                                            percentage={unref(uploadPercent)}
                                            status={
                                                unref(uploadFailed)
                                                    ? 'exception'
                                                    : unref(uploadedPath)
                                                      ? 'success'
                                                      : undefined
                                            }
                                        />
                                        {unref(uploadedPath) ? (
                                            <p class={'input-help break-all'}>{unref(uploadedPath)}</p>
                                        ) : null}
                                        {unref(uploadFailed) ? (
                                            <ElButton
                                                disabled={unref(busy)}
                                                onClick={($event?: any) => {
                                                    (uploadLocalFile as any)($event);
                                                }}
                                            >
                                                {$t('commons.button.retry')}
                                            </ElButton>
                                        ) : null}
                                    </>
                                ) : null}
                            </>
                        )}
                        {unref(submittedTaskID) ? (
                            <ElButton
                                link
                                type="primary"
                                onClick={($event?: any) => {
                                    (openTaskLog as any)($event);
                                }}
                            >
                                {$t('commons.button.log')}
                            </ElButton>
                        ) : null}
                    </ElForm>
                </DrawerPro>
                {unref(loadVisible) ? (
                    <FileList
                        ref={fileRef}
                        onChoose={($event?: any) => {
                            (loadLoadDir as any)($event);
                        }}
                    />
                ) : null}
                <TaskLog
                    ref={taskLogRef}
                    width="70%"
                    onClose={($event?: any) => {
                        ctx.emit('search');
                    }}
                />
            </>
        );
    },
    options,
);
