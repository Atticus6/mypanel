import { UploadFilled } from '@element-plus/icons-vue';
import { $t } from '@/utils/i18n-t';
import { uploadContainerFile } from '@/api/modules/container';
import { stopChunkUpload, uploadFileData } from '@/api/modules/files';
import { rpc } from '@/lib/rpc';
import { CHUNK_SIZE, uploadChunkWithRetry } from '@/utils/chunk-upload';
import i18n from '@/lang';
import { MsgError, MsgSuccess, MsgWarning } from '@/utils/message';
import { Close, Document } from '@element-plus/icons-vue';
import ExistFileDialog from '@/components/exist-file/index';
import { newUUID } from '@/utils/id';
import { getErrorMessage } from '@/utils/misc';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface UploadFileProps {
    path: string;
    isAppendOnly?: boolean;
    containerID?: string;
}
type DrawerCloseDone = () => void;
import './index.styles.css';
import { cn } from '@/utils/cn';
import DrawerPro from '@/components/drawer-pro/index';
import { Select } from '@element-plus/icons-vue';
interface CodemodProps {
    [key: string]: any;
}
const emits = {
    close: (...args: unknown[]) => true,
};
const options = {
    name: 'upload',
    props: {},
    emits: emits,
    __scopeId: 'data-v-0996e684',
};
export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const uploadRef = ref<UploadInstance>();
        const upLoading = ref(false);
        const canceling = ref(false);
        const uploadLocked = computed(() => upLoading.value || canceling.value);
        let uploadPercent = ref(0);
        const uploadTotalCount = ref(0);
        const uploadCurrentIndex = ref(0);
        const uploadOverallPercent = computed(() => {
            const total = uploadTotalCount.value;
            if (!upLoading.value || total === 0) {
                return 0;
            }
            const raw = (uploadCurrentIndex.value * 100 + uploadPercent.value) / total;
            return Math.min(100, Math.round(raw));
        });
        const open = ref(false);
        const isAppendOnly = ref(false);
        const path = ref();
        const containerID = ref('');
        const targetNode = ref('');
        let uploadHelper = ref('');
        const dialogExistFileRef = ref();
        const abortController = ref<AbortController | null>(null);
        const activeChunkUpload = ref<{ uploadID: string; node: string } | null>(null);
        const { currentNode } = useGlobalStore();
        const finishClose = (done?: DrawerCloseDone) => {
            closePage();
            done?.();
        };
        const requestClose = async (done?: DrawerCloseDone) => {
            if (canceling.value) {
                return;
            }
            if (!upLoading.value) {
                finishClose(done);
                return;
            }
            canceling.value = true;
            try {
                try {
                    await ElMessageBox.confirm(
                        i18n.global.t('file.cancelUploadHelper'),
                        i18n.global.t('file.cancelUpload'),
                        {
                            confirmButtonText: i18n.global.t('commons.button.confirm'),
                            cancelButtonText: i18n.global.t('commons.button.cancel'),
                            type: 'info',
                        },
                    );
                } catch {
                    return;
                }
                if (!upLoading.value) {
                    finishClose(done);
                    return;
                }
                const controller = abortController.value;
                controller?.abort();
                await cleanupActiveChunkUpload();
                if (abortController.value === controller) {
                    abortController.value = null;
                }
                finishClose(done);
            } finally {
                canceling.value = false;
            }
        };
        const closePage = () => {
            open.value = false;
            upLoading.value = false;
            uploadTotalCount.value = 0;
            uploadCurrentIndex.value = 0;
            clearFiles();
            ctx.emit('close', false);
        };
        const uploaderFiles = ref<UploadFiles>([]);
        const hoverIndex = ref<number | null>(null);
        const tmpFiles = ref<UploadFiles>([]);
        const breakFlag = ref(false);
        const upload = (command: string) => {
            if (uploadLocked.value) {
                return;
            }
            const input = uploadRef.value?.$el.querySelector('input[type=file]') as HTMLInputElement | null;
            if (!input) return;
            input.webkitdirectory = command === 'dir';
            input.value = '';
            input.click();
        };
        const removeFile = (index: number) => {
            if (uploadLocked.value) {
                return;
            }
            uploaderFiles.value.splice(index, 1);
        };
        const handleDragover = (event: DragEvent) => {
            event.preventDefault();
        };
        const initTempFiles = () => {
            tmpFiles.value = [];
            breakFlag.value = false;
        };
        const handleDrop = async (event: DragEvent) => {
            event.preventDefault();
            if (uploadLocked.value) {
                return;
            }
            initTempFiles();
            const items = event.dataTransfer?.items;
            if (items) {
                const entries = Array.from(items).map((item) => item.webkitGetAsEntry());
                await Promise.all(entries.map((entry) => traverseFileTree(entry)));
                if (!breakFlag.value) {
                    uploaderFiles.value = uploaderFiles.value.concat(tmpFiles.value);
                } else {
                    MsgWarning(i18n.global.t('file.uploadOverLimit'));
                }
                initTempFiles();
            }
        };
        const convertFileToUploadFile = (file: File, path: string): UploadFile => {
            const uid = genFileId();
            const uploadRawFile: UploadRawFile = new File([file], file.name, {
                type: file.type,
                lastModified: file.lastModified,
            }) as UploadRawFile;
            uploadRawFile.uid = uid;
            let fileName = file.name;
            if (path != '') {
                fileName = path + file.name;
            }
            return {
                name: fileName,
                size: file.size,
                status: 'ready',
                uid: uid,
                raw: uploadRawFile,
            };
        };
        const traverseFileTree = async (item: any, path = '') => {
            path = path || '';
            if (!item) {
                return;
            }
            if (item.isFile) {
                if (uploaderFiles.value.length + tmpFiles.value.length >= 1000) {
                    breakFlag.value = true;
                    return;
                }
                await new Promise<void>((resolve) => {
                    item.file((file: File) => {
                        if (uploaderFiles.value.length + tmpFiles.value.length >= 1000) {
                            breakFlag.value = true;
                        }
                        if (!breakFlag.value) {
                            tmpFiles.value.push(convertFileToUploadFile(file, path));
                        }
                        resolve();
                    });
                });
            } else if (item.isDirectory) {
                const dirReader = item.createReader();
                const readEntries = async () => {
                    const entries = await new Promise<any[]>((resolve) => {
                        dirReader.readEntries((entries: any[] | PromiseLike<any[]>) => {
                            resolve(entries);
                        });
                    });
                    if (entries.length === 0) {
                        return;
                    }
                    for (const element of entries) {
                        await traverseFileTree(element, path + item.name + '/');
                        if (breakFlag.value) {
                            return;
                        }
                    }
                    await readEntries();
                };
                await readEntries();
            }
        };
        const handleDragleave = (event: { preventDefault: () => void }) => {
            event.preventDefault();
        };
        const fileOnChange = (_uploadFile: UploadFile, uploadFiles: UploadFiles) => {
            if (_uploadFile.size == 64 || _uploadFile.size == 0) {
                uploaderFiles.value = uploadFiles;
                const reader = new FileReader();
                reader.readAsDataURL(_uploadFile.raw);
                reader.onload = async () => {};
                reader.onerror = () => {
                    uploaderFiles.value = uploaderFiles.value.filter((file) => file.uid !== _uploadFile.uid);
                    MsgError(i18n.global.t('file.typeErrOrEmpty', [_uploadFile.name]));
                };
            } else {
                uploaderFiles.value = uploadFiles;
            }
        };
        const clearFiles = () => {
            uploadRef.value?.clearFiles();
            uploaderFiles.value = [];
        };
        const handleExceed: UploadProps['onExceed'] = () => {
            clearFiles();
            MsgWarning(i18n.global.t('file.uploadOverLimit'));
        };
        const handleSuccess: UploadProps['onSuccess'] = (res, file) => {
            file.status = 'success';
        };
        const submit = async () => {
            if (uploadLocked.value) return;
            const files = containerID.value
                ? uploaderFiles.value.filter((file) => file.status !== 'success')
                : uploaderFiles.value.slice();
            if (containerID.value) {
                await uploadFile(files, false);
                return;
            }
            const fileNamesWithPath = Array.from(
                new Set(files.map((file) => `${path.value}/${file.raw.webkitRelativePath || file.name}`)),
            );
            const existFiles = (await rpc.file.batchCheckFiles({ paths: fileNamesWithPath })).items;
            if (existFiles.length > 0) {
                const fileSizeMap = new Map(
                    files.map((file) => [`${path.value}/${file.raw.webkitRelativePath || file.name}`, file.size]),
                );
                const existPaths = existFiles.map((file) => ({
                    name: file.name,
                    path: file.path,
                    modTime: file.modTime,
                    isDir: file.isDir,
                    // proto 的 size 是 int64（bigint），展示层按 number 计算。
                    size: Number(file.size),
                    uploadSize: fileSizeMap.get(file.path) ?? 0,
                }));
                dialogExistFileRef.value.acceptParams({
                    paths: existPaths,
                    onConfirm: handleFileUpload,
                });
            } else {
                await uploadFile(files, false);
            }
        };
        const handleFileUpload = (action: 'skip' | 'overwrite', skippedPaths: string[] = []) => {
            const files = uploaderFiles.value.slice();
            if (action === 'skip') {
                const filteredFiles = files.filter(
                    (file) => !skippedPaths.includes(`${path.value}/${file.raw.webkitRelativePath || file.name}`),
                );
                uploaderFiles.value = filteredFiles;
                uploadFile(filteredFiles, false);
            } else if (action === 'overwrite') {
                uploadFile(files, true);
            }
        };
        const uploadFile = async (files: any[], overwrite: boolean) => {
            if (files.length == 0) {
                clearFiles();
                return;
            }
            upLoading.value = true;
            uploadTotalCount.value = files.length;
            const controller = new AbortController();
            const uploadNode = containerID.value ? targetNode.value : currentNode.value;
            const uploadContainerID = containerID.value;
            abortController.value = controller;
            let successCount = 0;
            try {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    uploadCurrentIndex.value = i;
                    uploadPercent.value = 0;
                    uploadHelper.value = i18n.global.t('file.fileUploadStart', [file.name]);
                    if (controller.signal.aborted) {
                        break;
                    }
                    let isSuccess = false;
                    try {
                        if (uploadContainerID) {
                            const data = new FormData();
                            data.append('containerID', uploadContainerID);
                            data.append('path', getUploadPath(file));
                            data.append(
                                'file',
                                file.raw,
                                getFilenameFromPath(file.raw.webkitRelativePath || file.name),
                            );
                            await uploadContainerFile(data, {
                                headers: { CurrentNode: uploadNode },
                                signal: controller.signal,
                                skipErrorMessage: true,
                                timeout: 0,
                                onUploadProgress: ({ loaded, total }) => {
                                    uploadPercent.value = total ? Math.round((loaded / total) * 100) : 0;
                                },
                            });
                            isSuccess = true;
                        } else {
                            isSuccess =
                                Number(file.size) === 0
                                    ? await uploadEmptyFile(file, controller, uploadNode, overwrite)
                                    : await uploadChunkedFile(file, controller, uploadNode, overwrite);
                        }
                    } catch (error) {
                        if (!controller.signal.aborted) {
                            MsgError(getErrorMessage(error));
                        }
                    }
                    if (isSuccess) {
                        successCount++;
                        file.status = 'success';
                    } else {
                        file.status = 'fail';
                    }
                }
                if (successCount === files.length && !controller.signal.aborted) {
                    clearFiles();
                    MsgSuccess(i18n.global.t('file.uploadSuccess'));
                }
            } finally {
                upLoading.value = false;
                uploadTotalCount.value = 0;
                uploadCurrentIndex.value = 0;
                uploadHelper.value = '';
                if (abortController.value === controller) {
                    abortController.value = null;
                }
            }
        };
        const uploadEmptyFile = async (
            file: { raw: string | Blob },
            controller: AbortController,
            node: string,
            overwrite: boolean,
        ) => {
            const formData = new FormData();
            formData.append('file', file.raw);
            formData.append('path', getUploadPath(file));
            formData.append('overwrite', overwrite.toString());
            uploadPercent.value = 0;
            await uploadFileData(formData, {
                onUploadProgress: (progressEvent) => {
                    uploadPercent.value = progressEvent.total
                        ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
                        : 0;
                },
                headers: { CurrentNode: node },
                skipErrorMessage: true,
                timeout: 0,
                signal: controller.signal,
            });
            return true;
        };
        const cleanupActiveChunkUpload = async () => {
            const active = activeChunkUpload.value;
            if (!active) {
                return;
            }
            activeChunkUpload.value = null;
            try {
                await stopChunkUpload(active.uploadID, active.node);
            } catch (error) {
                console.error(error);
            }
        };
        const uploadChunkedFile = async (
            file: { size: number; raw: Blob; name: string },
            controller: AbortController,
            node: string,
            overwrite: boolean,
        ) => {
            const fileSize = file.size;
            const chunkCount = Math.ceil(fileSize / CHUNK_SIZE);
            const uploadID = newUUID();
            const uploadPath = getUploadPath(file);
            const filename = getFilenameFromPath(file.name);
            let uploadedChunkCount = 0;
            activeChunkUpload.value = { uploadID, node };
            try {
                for (let c = 0; c < chunkCount; c++) {
                    if (controller.signal.aborted) {
                        return false;
                    }
                    const start = c * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, fileSize);
                    const chunk = file.raw.slice(start, end);
                    const formData = new FormData();
                    formData.append('uploadID', uploadID);
                    formData.append('filename', filename);
                    formData.append('path', uploadPath);
                    formData.append('chunk', chunk);
                    formData.append('chunkIndex', c.toString());
                    formData.append('chunkCount', chunkCount.toString());
                    formData.append('offset', start.toString());
                    formData.append('fileSize', fileSize.toString());
                    formData.append('overwrite', overwrite.toString());
                    await uploadChunkWithRetry(
                        formData,
                        {
                            headers: { CurrentNode: node },
                            skipErrorMessage: true,
                            timeout: 0,
                            signal: controller.signal,
                            onUploadProgress: (progressEvent) => {
                                const chunkProgress = progressEvent.total
                                    ? progressEvent.loaded / progressEvent.total
                                    : 0;
                                uploadPercent.value = Math.round(
                                    ((uploadedChunkCount + chunkProgress) * 100) / chunkCount,
                                );
                            },
                        },
                        controller.signal,
                    );
                    uploadedChunkCount++;
                }
                return uploadedChunkCount === chunkCount;
            } catch (error) {
                await cleanupActiveChunkUpload();
                throw error;
            } finally {
                if (activeChunkUpload.value?.uploadID === uploadID) {
                    if (controller.signal.aborted) {
                        await cleanupActiveChunkUpload();
                    } else {
                        activeChunkUpload.value = null;
                    }
                }
            }
        };
        const getUploadPath = (file) => {
            return `${path.value}/${getPathWithoutFilename(file.raw.webkitRelativePath || file.name)}`;
        };
        const getPathWithoutFilename = (path: string) => {
            return path ? path.split('/').slice(0, -1).join('/') : path;
        };
        const getFilenameFromPath = (path: string) => {
            return path ? path.split('/').pop() : path;
        };
        const acceptParams = (__panelSetupProps: UploadFileProps) => {
            if (uploadLocked.value) return;
            containerID.value = __panelSetupProps.containerID || '';
            targetNode.value = currentNode.value;
            path.value = __panelSetupProps.path;
            isAppendOnly.value = Boolean(__panelSetupProps.isAppendOnly);
            open.value = true;
            uploadPercent.value = 0;
            uploadTotalCount.value = 0;
            uploadCurrentIndex.value = 0;
            uploadHelper.value = '';
            canceling.value = false;
        };
        const beforeUnload = (event: BeforeUnloadEvent) => {
            if (upLoading.value) {
                event.preventDefault();
                event.returnValue = i18n.global.t('file.cancelUploadHelper');
            }
        };
        onMounted(() => window.addEventListener('beforeunload', beforeUnload));
        onBeforeUnmount(() => {
            window.removeEventListener('beforeunload', beforeUnload);
            abortController.value?.abort();
            void cleanupActiveChunkUpload();
        });
        ctx.expose({ acceptParams, handleDrop, open });
        return () => (
            <>
                <DrawerPro
                    v-model={open.value}
                    header={$t('commons.button.upload')}
                    onBeforeClose={($event?: any) => {
                        (requestClose as any)($event);
                    }}
                    size="normal"
                    confirmBeforeClose={true}
                    v-slots={{
                        content: () => (
                            <>
                                {unref(isAppendOnly) ? (
                                    <ElAlert
                                        type="warning"
                                        title={$t('xpack.tamper.tamperCreateHint')}
                                        closable={false}
                                        class={'mb-4'}
                                    />
                                ) : null}
                                <div
                                    class={
                                        'upload-button flex flex-wrap items-center justify-between gap-4 pb-4 md:flex-nowrap'
                                    }
                                >
                                    <div class={'flex flex-wrap gap-4'}>
                                        <ElButton
                                            type="primary"
                                            disabled={unref(uploadLocked)}
                                            onClick={($event?: any) => {
                                                upload('file');
                                            }}
                                        >
                                            {$t('commons.button.upload')}
                                            {$t('menu.files')}
                                        </ElButton>
                                        <ElButton
                                            type="primary"
                                            disabled={unref(uploadLocked)}
                                            onClick={($event?: any) => {
                                                upload('dir');
                                            }}
                                        >
                                            {$t('commons.button.upload')}
                                            {$t('file.dir')}
                                        </ElButton>
                                    </div>
                                    <ElButton
                                        disabled={unref(uploadLocked)}
                                        onClick={($event?: any) => {
                                            (clearFiles as any)($event);
                                        }}
                                    >
                                        {$t('file.clearList')}
                                    </ElButton>
                                </div>
                                <div>
                                    <div
                                        onDragover={($event?: any) => {
                                            (handleDragover as any)($event);
                                        }}
                                        onDrop={($event?: any) => {
                                            (handleDrop as any)($event);
                                        }}
                                        onDragleave={($event?: any) => {
                                            (handleDragleave as any)($event);
                                        }}
                                        class={cn('el-upload-dragger', {
                                            'upload-dragger-disabled': unref(uploadLocked),
                                        })}
                                    >
                                        <div class={'flex h-52 items-center justify-center'}>
                                            <div>
                                                <ElIcon class={'el-icon--upload'}>
                                                    <UploadFilled />
                                                </ElIcon>
                                                <div class={'el-upload__text'}>{$t('file.dropHelper')}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <ElUpload
                                    action="#"
                                    auto-upload={false}
                                    ref={uploadRef}
                                    on-change={fileOnChange}
                                    on-exceed={handleExceed}
                                    on-success={handleSuccess}
                                    show-file-list={false}
                                    multiple
                                    disabled={unref(uploadLocked)}
                                    file-list={unref(uploaderFiles)}
                                    onUpdate:file-list={($v) => {
                                        uploaderFiles.value = $v as any;
                                    }}
                                    limit={1000}
                                    v-slots={{
                                        tip: () => (
                                            <>
                                                <ElText>{unref(uploadHelper)}</ElText>
                                                {unref(upLoading) && unref(uploadTotalCount) > 1 ? (
                                                    <div class={'mt-3 space-y-1'}>
                                                        <div class={'flex justify-between text-sm text-gray-500'}>
                                                            <span>{$t('file.uploadOverallProgress')}</span>
                                                            <span>
                                                                {unref(uploadCurrentIndex) + 1}
                                                                {' / '}
                                                                {unref(uploadTotalCount)}
                                                            </span>
                                                        </div>
                                                        <ElProgress
                                                            stroke-width={20}
                                                            percentage={unref(uploadOverallPercent)}
                                                        />
                                                    </div>
                                                ) : null}
                                                {unref(upLoading) ? (
                                                    <div
                                                        class={cn('space-y-1', {
                                                            'mt-3': unref(upLoading) && unref(uploadTotalCount) > 1,
                                                        })}
                                                    >
                                                        {unref(uploadTotalCount) > 1 ? (
                                                            <div class={'text-sm text-gray-500'}>
                                                                {$t('file.uploadCurrentFileProgress')}
                                                            </div>
                                                        ) : null}
                                                        <ElProgress
                                                            text-inside
                                                            stroke-width={16}
                                                            percentage={unref(uploadPercent)}
                                                        />
                                                    </div>
                                                ) : null}
                                            </>
                                        ),
                                    }}
                                />
                                <div>
                                    {(unref(uploaderFiles) || []).map((item, index) => (
                                        <p
                                            onMouseover={($event?: any) => {
                                                hoverIndex.value = index;
                                            }}
                                            onMouseout={($event?: any) => {
                                                hoverIndex.value = null;
                                            }}
                                            class={'file-item'}
                                            key={index}
                                        >
                                            <ElIcon class={'file-icon'}>
                                                <Document />
                                            </ElIcon>
                                            {item.raw.webkitRelativePath != '' ? (
                                                <span>{item.raw.webkitRelativePath}</span>
                                            ) : (
                                                <span>{item.name}</span>
                                            )}
                                            {item.status === 'success' ? (
                                                <span class={'success-icon'}>
                                                    <ElIcon>
                                                        <Select />
                                                    </ElIcon>
                                                </span>
                                            ) : (
                                                <span>
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            removeFile(index);
                                                        }}
                                                        disabled={unref(uploadLocked)}
                                                        icon={Close}
                                                        class={'delete-button'}
                                                    />
                                                </span>
                                            )}
                                        </p>
                                    ))}
                                </div>
                            </>
                        ),
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        type="default"
                                        loading={unref(canceling)}
                                        onClick={($event?: any) => {
                                            requestClose();
                                        }}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit();
                                        }}
                                        disabled={unref(uploadLocked) || unref(uploaderFiles).length == 0}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                />
                <ExistFileDialog ref={dialogExistFileRef} />
            </>
        );
    },
    options,
);
