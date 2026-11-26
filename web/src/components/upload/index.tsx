import { $t } from '@/utils/i18n-t';
import { computeSize } from '@/utils/size';
import { newUUID } from '@/utils/id';
import { transferTimeToSecond } from '@/utils/validate';
import i18n from '@/lang';
import { File } from '@/types/file';
import { chunkUploadFileData } from '@/api/modules/files';
import { rpc } from '@/lib/rpc';
import { MsgError, MsgSuccess } from '@/utils/message';
import TaskLog from '@/components/log/task/index';
interface DialogProps {
    type: string;
    name: string;
    detailName: string;
    remark: string;
    node?: string;
}
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';
import DialogPro from '@/components/dialog-pro/index';
import OpDialog from '@/components/del-dialog/index';
import FileList from '@/components/file-list/index';

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
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const fileRef = ref();
        const isUpload = ref();
        const uploadPercent = ref<number>(0);
        const selects = ref<any>([]);
        const baseDir = ref();
        const opRef = ref();
        const currentRow = ref();
        const data = ref();
        const title = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 10,
            total: 0,
        });
        const uploadOpen = ref(false);
        const type = ref('mysql');
        const name = ref();
        const detailName = ref();
        const remark = ref();
        const secret = ref();
        const timeoutItem = ref(30);
        const timeoutUnit = ref('m');
        const taskLogRef = ref();
        const node = ref();
        const recoverDialog = ref();
        const acceptParams = async (params: DialogProps): Promise<void> => {
            type.value = params.type;
            name.value = params.name;
            detailName.value = params.detailName;
            remark.value = params.remark;
            node.value = params.node;

            const pathRes = await rpc.agentSetting.getBaseDir({});
            switch (type.value) {
                case 'mysql':
                case 'mariadb':
                case 'postgresql':
                case 'mysql-cluster':
                case 'postgresql-cluster':
                case 'mongodb':
                    title.value = name.value + ' [ ' + detailName.value + ' ]';
                    if (detailName.value) {
                        baseDir.value = `${pathRes.path}/uploads/database/${type.value}/${name.value}/${detailName.value}/`;
                    } else {
                        baseDir.value = `${pathRes.path}/uploads/database/${type.value}/${name.value}/`;
                    }
                    break;
                case 'website':
                    title.value = name.value;
                    baseDir.value = `${pathRes.path}/uploads/website/${type.value}/${detailName.value}/`;
                    break;
                case 'app':
                    title.value = name.value;
                    baseDir.value = `${pathRes.path}/uploads/app/${type.value}/${name.value}/`;
                    break;
                case 'container':
                    title.value = name.value || i18n.global.t('menu.container');
                    if (name.value) {
                        baseDir.value = `${pathRes.path}/uploads/container/${name.value}/`;
                    } else {
                        baseDir.value = `${pathRes.path}/uploads/container/import/`;
                    }
                    break;
                case 'compose':
                    title.value = name.value || i18n.global.t('container.compose');
                    if (name.value) {
                        baseDir.value = `${pathRes.path}/uploads/compose/${name.value}/`;
                    } else {
                        baseDir.value = `${pathRes.path}/uploads/compose/import/`;
                    }
                    break;
            }
            uploadOpen.value = true;
            search();
        };
        const search = async () => {
            let params = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                path: baseDir.value,
            };
            const res = await rpc.file.searchUpload(params);
            data.value = (res.items || []).map((item) => ({ ...item, size: Number(item.size) }));
            paginationConfig.total = Number(res.total);
        };
        const beforeUpload = (fileName: string) => {
            const itemName = fileName.toLowerCase();
            let reg = /^[a-zA-Z0-9\u4e00-\u9fa5]{1}[a-z:A-Z0-9_.\u4e00-\u9fa5-]{0,256}$/;
            if (!reg.test(itemName)) {
                MsgError(i18n.global.t('commons.msg.fileNameErr'));
                return false;
            }
            if (isDb()) {
                const allowedExtensions = type.value === 'mongodb' ? ['.gz'] : ['.sql', '.sql.gz', '.tar.gz', '.zip'];
                const isValidFile = allowedExtensions.some((ext) => itemName.endsWith(ext));
                if (!isValidFile) {
                    MsgError(
                        type.value === 'mongodb'
                            ? i18n.global.t('commons.msg.unSupportType')
                            : i18n.global.t('database.supportUpType'),
                    );
                    return false;
                }
                return true;
            }
            const allowedExtensions = ['.tar.gz'];
            const isValidFile = allowedExtensions.some((ext) => itemName.endsWith(ext));
            if (!isValidFile) {
                if (type.value === 'compose') {
                    MsgError(i18n.global.t('container.importComposeBackupTip'));
                    return false;
                }
                if (type.value === 'container') {
                    MsgError(i18n.global.t('container.importContainerBackupTip'));
                    return false;
                }
                MsgError(i18n.global.t('website.supportUpType'));
                return false;
            }
            return true;
        };
        const loadFile = async (path: string) => {
            let filaName = path.split('/').pop();
            if (!filaName) {
                MsgError(i18n.global.t('commons.msg.fileNameErr'));
                return;
            }
            if (!beforeUpload(filaName)) {
                return;
            }
            ElMessageBox.confirm(i18n.global.t('database.selectHelper', [path]), i18n.global.t('database.loadBackup'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                rpc.backup
                    .uploadForRecover({ filePath: path, targetDir: baseDir.value })
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        search();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID, true, node.value);
        };
        const onHandleRecover = async () => {
            let params = {
                downloadAccountId: 1,
                type: type.value,
                name: name.value,
                detailName: detailName.value,
                file: baseDir.value + currentRow.value.name,
                secret: secret.value,
                taskId: newUUID(),
                timeout: timeoutItem.value === -1 ? -1 : transferTimeToSecond(timeoutItem.value + timeoutUnit.value),
            };
            loading.value = true;
            await rpc.backup
                .recoverByUpload(params)
                .then(() => {
                    loading.value = false;
                    handleUploadClose();
                    handleRecoverClose();
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    search();
                    openTaskLog(params.taskId);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onRecover = async (row: File.File) => {
            currentRow.value = row;
            secret.value = '';
            recoverDialog.value = true;
        };
        const isDb = () => {
            return (
                type.value === 'mongodb' ||
                type.value === 'mysql' ||
                type.value === 'mariadb' ||
                type.value === 'postgresql' ||
                type.value === 'mysql-cluster' ||
                type.value === 'postgresql-cluster'
            );
        };
        const uploadAccept = computed(() => {
            return type.value === 'mongodb' ? '.gz' : '.tar.gz,.sql,.gz,.zip';
        });
        const uploaderFiles = ref<UploadFiles>([]);
        const uploadRef = ref<UploadInstance>();
        const fileOnChange = (_uploadFile: UploadFile, uploadFiles: UploadFiles) => {
            uploaderFiles.value = uploadFiles;
            if (uploaderFiles.value.length !== 1) {
                return;
            }
            const file = uploaderFiles.value[0];
            if (!file.raw.name) {
                MsgError(i18n.global.t('commons.msg.fileNameErr'));
                return;
            }
            if (!beforeUpload(file.raw.name)) {
                return;
            }
            ElMessageBox.confirm(
                i18n.global.t('database.selectHelper', [file.raw.name]),
                i18n.global.t('database.loadBackup'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                },
            ).then(async () => {
                onSubmit();
            });
        };
        const handleUploadClose = () => {
            uploaderFiles.value = [];
            uploadRef.value!.clearFiles();
            uploadOpen.value = false;
            ctx.emit('close');
        };
        const handleTaskLogClose = () => {
            ctx.emit('close');
        };
        const handleRecoverClose = () => {
            recoverDialog.value = false;
        };
        const handleExceed: UploadProps['onExceed'] = (files) => {
            uploadRef.value!.clearFiles();
            const file = files[0] as UploadRawFile;
            file.uid = genFileId();
            uploadRef.value!.handleStart(file);
        };
        const onSubmit = async () => {
            const file = uploaderFiles.value[0];
            let reg = /^[a-zA-Z0-9\u4e00-\u9fa5]{1}[a-z:A-Z0-9_.\u4e00-\u9fa5-]{0,256}$/;
            if (!reg.test(file.raw.name)) {
                MsgError(i18n.global.t('commons.msg.fileNameErr'));
                return;
            }
            const res = await rpc.file.checkFile({ path: baseDir.value + file.raw.name, withInit: false });
            if (res.exists) {
                MsgError(i18n.global.t('commons.msg.fileExist'));
                return;
            }
            submitUpload(file);
        };
        const submitUpload = async (file: any) => {
            isUpload.value = true;
            const CHUNK_SIZE = 1024 * 1024;
            const fileSize = file.size;
            const chunkCount = Math.ceil(fileSize / CHUNK_SIZE);
            let uploadedChunkCount = 0;

            for (let i = 0; i < chunkCount; i++) {
                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, fileSize);
                const chunk = file.raw.slice(start, end);

                const formData = new FormData();

                formData.append('filename', file.name);
                formData.append('path', baseDir.value);
                formData.append('chunk', chunk);
                formData.append('chunkIndex', i.toString());
                formData.append('chunkCount', chunkCount.toString());

                try {
                    await chunkUploadFileData(formData, {
                        onUploadProgress: (progressEvent) => {
                            const progress = Math.round(
                                ((uploadedChunkCount + progressEvent.loaded / progressEvent.total) * 100) / chunkCount,
                            );
                            uploadPercent.value = progress;
                        },
                    });
                    uploadedChunkCount++;
                } catch (error) {
                    isUpload.value = false;
                    break;
                }
                if (uploadedChunkCount == chunkCount) {
                    isUpload.value = false;
                    uploadRef.value?.clearFiles();
                    uploaderFiles.value = [];
                    MsgSuccess(i18n.global.t('file.uploadSuccess'));
                    search();
                }
            }
        };
        const onBatchDelete = async (row: File.File | null) => {
            let files: Array<string> = [];
            let names: Array<string> = [];
            if (row) {
                files.push(baseDir.value + row.name);
                names.push(row.name);
            } else {
                selects.value.forEach((item: File.File) => {
                    files.push(baseDir.value + item.name);
                    names.push(item.name);
                });
            }
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('commons.button.import'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: rpc.file.batchDeleteFiles,
                params: { paths: files, isDir: false },
            });
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.recover'),
                click: (row: File.File) => {
                    onRecover(row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                click: (row: File.File) => {
                    onBatchDelete(row);
                },
            },
        ];
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div>
                <DrawerPro
                    modelValue={unref(uploadOpen)}
                    onUpdate:modelValue={($v) => {
                        uploadOpen.value = $v as any;
                    }}
                    header={$t('commons.button.import')}
                    resource={unref(title)}
                    onClose={($event?: any) => {
                        (handleUploadClose as any)($event);
                    }}
                    size="large"
                    v-slots={{
                        content: () => (
                            <>
                                {withDirectives(
                                    <div>
                                        {unref(type) !== 'mongodb' ? (
                                            <div>
                                                <ElAlert
                                                    closable={false}
                                                    type="warning"
                                                    v-slots={{
                                                        default: () => (
                                                            <>
                                                                <ul>
                                                                    {unref(type) === 'mysql' ||
                                                                    unref(type) === 'mariadb' ||
                                                                    unref(type) === 'mysql-cluster' ? (
                                                                        <li>
                                                                            {$t('database.formatHelper', [
                                                                                unref(remark),
                                                                            ])}
                                                                        </li>
                                                                    ) : null}
                                                                    {isDb() && unref(type) !== 'mongodb' ? (
                                                                        <li>{$t('database.supportUpType')}</li>
                                                                    ) : null}
                                                                    {unref(type) === 'website' ||
                                                                    unref(type) === 'app' ? (
                                                                        <li>{$t('website.websiteBackupWarn')}</li>
                                                                    ) : null}
                                                                    {unref(type) === 'container' ? (
                                                                        <li>
                                                                            {$t('container.importContainerBackupTip')}
                                                                        </li>
                                                                    ) : unref(type) === 'compose' ? (
                                                                        <li>
                                                                            {$t('container.importComposeBackupTip')}
                                                                        </li>
                                                                    ) : !isDb() ? (
                                                                        <li>
                                                                            {$t('website.supportUpType', [unref(type)])}
                                                                        </li>
                                                                    ) : null}
                                                                </ul>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            </div>
                                        ) : null}
                                        <ComplexTable
                                            pagination-config={paginationConfig}
                                            onSearch={($event?: any) => {
                                                (search as any)($event);
                                            }}
                                            selects={unref(selects)}
                                            onUpdate:selects={($v) => {
                                                selects.value = $v as any;
                                            }}
                                            data={unref(data)}
                                            class={'mt-5'}
                                            v-slots={{
                                                toolbar: () => (
                                                    <>
                                                        <ElUpload
                                                            limit={1}
                                                            ref={uploadRef}
                                                            accept={unref(uploadAccept)}
                                                            show-file-list={false}
                                                            on-exceed={handleExceed}
                                                            on-change={fileOnChange}
                                                            auto-upload={false}
                                                            class={'float-left'}
                                                        >
                                                            <ElButton class={'float-left'}>
                                                                {$t('database.localUpload')}
                                                            </ElButton>
                                                        </ElUpload>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                unref(fileRef).acceptParams({ dir: false });
                                                            }}
                                                            class={'float-left ml-3'}
                                                        >
                                                            {$t('database.hostSelect')}
                                                        </ElButton>
                                                        <ElButton
                                                            disabled={unref(selects).length === 0}
                                                            onClick={($event?: any) => {
                                                                onBatchDelete(null);
                                                            }}
                                                        >
                                                            {$t('commons.button.delete')}
                                                        </ElButton>
                                                        {unref(isUpload) ? (
                                                            <ElProgress
                                                                text-inside
                                                                stroke-width={12}
                                                                percentage={unref(uploadPercent)}
                                                            />
                                                        ) : null}
                                                    </>
                                                ),
                                            }}
                                        >
                                            <ElTableColumn type="selection" fix />
                                            <ElTableColumn
                                                label={$t('commons.table.name')}
                                                show-overflow-tooltip
                                                prop="name"
                                            />
                                            <ElTableColumn
                                                label={$t('file.size')}
                                                prop="size"
                                                v-slots={{ default: ({ row }) => <>{computeSize(row.size)}</> }}
                                            />
                                            <ElTableColumn
                                                show-overflow-tooltip
                                                label={$t('commons.table.createdAt')}
                                                min-width="90"
                                                fix
                                                v-slots={{ default: ({ row }) => <>{row.createdAt}</> }}
                                            />
                                            <FuTableOperations
                                                width="150px"
                                                buttons={buttons}
                                                ellipsis={10}
                                                label={$t('commons.table.operate')}
                                                fix
                                            />
                                        </ComplexTable>
                                    </div>,
                                    [[vLoading, unref(loading)]],
                                )}
                            </>
                        ),
                    }}
                />
                <DialogPro
                    modelValue={unref(recoverDialog)}
                    onUpdate:modelValue={($v) => {
                        recoverDialog.value = $v as any;
                    }}
                    title={
                        unref(title)
                            ? $t('commons.button.recover') + ' - ' + unref(title)
                            : $t('commons.button.recover')
                    }
                    onClose={($event?: any) => {
                        (handleRecoverClose as any)($event);
                    }}
                    size="small"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (handleRecoverClose as any)($event);
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (onHandleRecover as any)($event);
                                        }}
                                        disabled={unref(loading)}
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
                            ref="backupForm"
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                            label-position="top"
                        >
                            <ElFormItem label={$t('setting.compressPassword')}>
                                <ElInput
                                    modelValue={unref(secret)}
                                    onUpdate:modelValue={($v) => {
                                        secret.value = $v as any;
                                    }}
                                    placeholder={$t('setting.backupRecoverMessage')}
                                />
                            </ElFormItem>
                            {unref(type) !== 'app' && unref(type) !== 'website' ? (
                                <ElFormItem label={$t('cronjob.timeout')} prop="timeoutItem">
                                    <ElInput
                                        type="number"
                                        modelValue={unref(timeoutItem)}
                                        onUpdate:modelValue={($v) => {
                                            timeoutItem.value = $v === '' ? $v : Number($v);
                                        }}
                                        class={'selectClass'}
                                        v-slots={{
                                            append: () => (
                                                <>
                                                    <ElSelect
                                                        modelValue={unref(timeoutUnit)}
                                                        onUpdate:modelValue={($v) => {
                                                            timeoutUnit.value = $v as any;
                                                        }}
                                                        style={'width: 80px'}
                                                    >
                                                        <ElOption label={$t('commons.units.second')} value="s" />
                                                        <ElOption label={$t('commons.units.minute')} value="m" />
                                                        <ElOption label={$t('commons.units.hour')} value="h" />
                                                    </ElSelect>
                                                </>
                                            ),
                                        }}
                                    />
                                    <span class={'input-help'}>{$t('database.recoverTimeoutHelper')}</span>
                                </ElFormItem>
                            ) : null}
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DialogPro>
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (loadFile as any)($event);
                    }}
                />
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (handleTaskLogClose as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
