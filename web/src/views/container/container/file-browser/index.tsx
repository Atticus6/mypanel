import { $t } from '@/utils/i18n-t';
import { computed, nextTick, ref } from 'vue';
import {
    deleteContainerFile,
    downloadContainerFile,
    getContainerFileContent,
    getContainerFileSize,
    listContainerFiles,
} from '@/api/modules/container';
import { MsgError, MsgSuccess, MsgWarning } from '@/utils/message';
import i18n from '@/lang';
import { ElInput, ElMessageBox } from 'element-plus';
import FileUpload from '@/views/host/file-management/upload/index';
import { Document, FolderOpened, HomeFilled } from '@element-plus/icons-vue';
import { computeSize2 } from '@/utils/size';
interface DrawerProps {
    containerID: string;
    title: string;
    workingDir?: string;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElBreadcrumb } from 'element-plus';
import { ElBreadcrumbItem } from 'element-plus';
import { ElLink } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElAlert } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'file-browser',
    props: {},
    emits: emits,
    __scopeId: 'data-v-6990ab7e',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const visible = ref(false);
        const title = ref('');
        const containerID = ref('');
        const filePath = ref('/');
        const containerFiles = ref<any[]>([]);
        const uploadRef = ref<InstanceType<typeof FileUpload>>();
        const pathInputRef = ref<InstanceType<typeof ElInput>>();
        const previewVisible = ref(false);
        const previewTitle = ref('');
        const previewContent = ref('');
        const previewTruncated = ref(false);
        const selectedRows = ref<any[]>([]);
        const pathEditing = ref(false);
        const pathInput = ref('/');
        const pathSegments = computed(() => {
            const parts = filePath.value.split('/').filter((item) => item);
            return parts.map((name, index) => ({
                name,
                path: '/' + parts.slice(0, index + 1).join('/'),
            }));
        });
        const acceptParams = async (params: DrawerProps): Promise<void> => {
            visible.value = true;
            containerID.value = params.containerID;
            title.value = params.title;
            filePath.value = params.workingDir || '/';
            pathInput.value = filePath.value;
            pathEditing.value = false;
            await loadContainerFiles();
        };
        const fetchContainerFiles = async (path: string) => {
            if (!containerID.value || !path) {
                return false;
            }
            return await listContainerFiles({
                containerID: containerID.value,
                path,
            })
                .then((res) => {
                    containerFiles.value = (res.data || []).map((item) => ({
                        ...item,
                        sizeLoaded: !item.isDir,
                        sizeLoading: false,
                    }));
                    selectedRows.value = [];
                    return true;
                })
                .catch(() => {
                    containerFiles.value = [];
                    return false;
                });
        };
        const loadContainerFiles = async () => {
            await fetchContainerFiles(filePath.value);
        };
        const enterDir = async (path: string) => {
            filePath.value = path;
            await loadContainerFiles();
        };
        const navigateToPath = async (path: string) => {
            filePath.value = path || '/';
            pathInput.value = filePath.value;
            pathEditing.value = false;
            await loadContainerFiles();
        };
        const getParentPath = (path: string) => {
            if (!path || path === '/') {
                return '/';
            }
            const segments = path.split('/').filter((item) => item);
            if (segments.length <= 1) {
                return '/';
            }
            return '/' + segments.slice(0, -1).join('/');
        };
        const enablePathEditing = async () => {
            pathInput.value = filePath.value || '/';
            pathEditing.value = true;
            await nextTick();
            pathInputRef.value?.focus();
        };
        const cancelPathEditing = () => {
            pathEditing.value = false;
            pathInput.value = filePath.value || '/';
        };
        const submitPathInput = async () => {
            let targetPath = (pathInput.value || '').trim();
            if (!targetPath) {
                targetPath = '/';
            }
            if (!targetPath.startsWith('/')) {
                targetPath = '/' + targetPath;
            }
            let currentPath = targetPath;
            while (true) {
                const success = await fetchContainerFiles(currentPath);
                if (success) {
                    filePath.value = currentPath;
                    pathInput.value = currentPath;
                    pathEditing.value = false;
                    return;
                }
                if (currentPath === '/') {
                    filePath.value = '/';
                    pathInput.value = '/';
                    pathEditing.value = false;
                    return;
                }
                currentPath = getParentPath(currentPath);
            }
        };
        const onUpload = () => {
            uploadRef.value?.acceptParams({ path: filePath.value, containerID: containerID.value });
        };
        const onOpenFile = async (path: string) => {
            await getContainerFileContent({
                containerID: containerID.value,
                path,
            })
                .then((res) => {
                    if (res.data?.isBinary) {
                        MsgWarning(i18n.global.t('file.fileCanNotRead'));
                        return;
                    }
                    previewTitle.value = path;
                    previewContent.value = res.data?.content || '';
                    previewTruncated.value = !!res.data?.truncated;
                    previewVisible.value = true;
                })
                .catch((err) => {
                    MsgError(err?.message || i18n.global.t('commons.msg.operationFailed'));
                });
        };
        const onCalcDirSize = async (row: any) => {
            row.sizeLoading = true;
            await getContainerFileSize({
                containerID: containerID.value,
                path: row.path,
            })
                .then((res) => {
                    row.size = res.data || 0;
                    row.sizeLoaded = true;
                })
                .catch((err) => {
                    MsgError(err?.message || i18n.global.t('commons.msg.operationFailed'));
                })
                .finally(() => {
                    row.sizeLoading = false;
                });
        };
        const formatSize = (size: number) => {
            return computeSize2(size || 0);
        };
        const onDownloadFile = async (row: any) => {
            const blob = await downloadContainerFile({
                containerID: containerID.value,
                path: row.path,
            });
            const downloadUrl = window.URL.createObjectURL(new Blob([blob]));
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            const fileName = row.path.split('/').pop() || 'container-file';
            a.download = row.isDir ? `${fileName}.tar.gz` : fileName;
            a.dispatchEvent(new MouseEvent('click'));
        };
        const onDeleteFile = async (row: any) => {
            try {
                await ElMessageBox.confirm(
                    i18n.global.t('file.deleteHelper2'),
                    i18n.global.t('commons.button.delete'),
                    {
                        type: 'warning',
                    },
                );
            } catch {
                return;
            }
            await deleteContainerFile({
                containerID: containerID.value,
                paths: [row.path],
            })
                .then(async () => {
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    await loadContainerFiles();
                })
                .catch((err) => {
                    MsgError(err?.message || i18n.global.t('commons.msg.operationFailed'));
                });
        };
        const onBatchDelete = async () => {
            if (selectedRows.value.length === 0) {
                return;
            }
            try {
                await ElMessageBox.confirm(
                    i18n.global.t('file.deleteHelper2'),
                    i18n.global.t('commons.button.delete'),
                    {
                        type: 'warning',
                    },
                );
            } catch {
                return;
            }
            await deleteContainerFile({
                containerID: containerID.value,
                paths: selectedRows.value.map((item) => item.path),
            })
                .then(async () => {
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    selectedRows.value = [];
                    await loadContainerFiles();
                })
                .catch((err) => {
                    MsgError(err?.message || i18n.global.t('commons.msg.operationFailed'));
                });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(visible)}
                    onUpdate:modelValue={($v) => {
                        visible.value = $v as any;
                    }}
                    header={$t('home.dir')}
                    resource={unref(title)}
                    size="large"
                    fullScreen={true}
                    onClose={($event?: any) => {
                        visible.value = false;
                    }}
                    v-slots={{
                        content: () => (
                            <>
                                <ElForm
                                    label-position="top"
                                    onSubmit={($event?: any) => {
                                        $event.preventDefault();
                                    }}
                                >
                                    <ElFormItem>
                                        {!unref(pathEditing) ? (
                                            <div
                                                onClick={($event?: any) => {
                                                    (enablePathEditing as any)($event);
                                                }}
                                                class={'path-breadcrumb'}
                                            >
                                                <ElBreadcrumb separator="/">
                                                    <ElBreadcrumbItem>
                                                        <ElLink
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                $event.stopPropagation();
                                                                navigateToPath('/');
                                                            }}
                                                        >
                                                            <ElIcon>
                                                                <HomeFilled />
                                                            </ElIcon>
                                                        </ElLink>
                                                    </ElBreadcrumbItem>
                                                    {(unref(pathSegments) || []).map((item) => (
                                                        <ElBreadcrumbItem key={item.path}>
                                                            <ElLink
                                                                type="primary"
                                                                onClick={($event?: any) => {
                                                                    $event.stopPropagation();
                                                                    navigateToPath(item.path);
                                                                }}
                                                            >
                                                                {item.name}
                                                            </ElLink>
                                                        </ElBreadcrumbItem>
                                                    ))}
                                                </ElBreadcrumb>
                                            </div>
                                        ) : (
                                            <ElInput
                                                ref={pathInputRef}
                                                modelValue={unref(pathInput)}
                                                onUpdate:modelValue={($v) => {
                                                    pathInput.value = $v as any;
                                                }}
                                                onBlur={($event?: any) => {
                                                    (cancelPathEditing as any)($event);
                                                }}
                                                onKeyup={($event?: any) => {
                                                    $event.preventDefault();
                                                    if (!($event.key === 'Enter')) return;
                                                    (submitPathInput as any)($event);
                                                }}
                                                class={'path-breadcrumb path-input'}
                                            />
                                        )}
                                        <ElButton
                                            type="primary"
                                            plain
                                            onClick={($event?: any) => {
                                                (onUpload as any)($event);
                                            }}
                                            class={'mt-2'}
                                        >
                                            {$t('commons.button.upload')}
                                        </ElButton>
                                        <ElButton
                                            plain
                                            disabled={unref(selectedRows).length === 0}
                                            onClick={($event?: any) => {
                                                (onBatchDelete as any)($event);
                                            }}
                                            class={'mt-2 ml-3'}
                                        >
                                            {$t('commons.button.delete')}
                                        </ElButton>
                                        <ElButton
                                            plain
                                            onClick={($event?: any) => {
                                                (loadContainerFiles as any)($event);
                                            }}
                                            class={'mt-2'}
                                        >
                                            {$t('commons.button.refresh')}
                                        </ElButton>
                                    </ElFormItem>
                                    <ComplexTable
                                        data={unref(containerFiles)}
                                        size="small"
                                        max-height="calc(100vh - 240px)"
                                        selects={unref(selectedRows)}
                                        onUpdate:selects={($v) => {
                                            selectedRows.value = $v as any;
                                        }}
                                    >
                                        <ElTableColumn type="selection" width="48" />
                                        <ElTableColumn
                                            label={$t('commons.table.name')}
                                            min-width="260"
                                            show-overflow-tooltip
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <div class={'name-cell'}>
                                                            <ElIcon>
                                                                {row.isDir ? <FolderOpened /> : <Document />}
                                                            </ElIcon>
                                                            {row.isDir ? (
                                                                <ElLink
                                                                    type="primary"
                                                                    onClick={($event?: any) => {
                                                                        enterDir(row.path);
                                                                    }}
                                                                >
                                                                    {row.name}
                                                                </ElLink>
                                                            ) : (
                                                                <ElLink
                                                                    type="primary"
                                                                    onClick={($event?: any) => {
                                                                        onOpenFile(row.path);
                                                                    }}
                                                                >
                                                                    {row.name}
                                                                </ElLink>
                                                            )}
                                                            {row.isLink && row.linkTo ? (
                                                                <span class={'symlink-target'}>
                                                                    {'-> '}
                                                                    {row.linkTo}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('file.size')}
                                            width="130"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {!row.isDir ? (
                                                            <span>{formatSize(row.size)}</span>
                                                        ) : !row.sizeLoaded ? (
                                                            <ElButton
                                                                link
                                                                type="primary"
                                                                loading={row.sizeLoading}
                                                                onClick={($event?: any) => {
                                                                    onCalcDirSize(row);
                                                                }}
                                                            >
                                                                {$t('file.calculate')}
                                                            </ElButton>
                                                        ) : (
                                                            <span>{formatSize(row.size)}</span>
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.operate')}
                                            width="220"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                onDownloadFile(row);
                                                            }}
                                                        >
                                                            {$t('commons.button.download')}
                                                        </ElButton>
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                onDeleteFile(row);
                                                            }}
                                                        >
                                                            {$t('commons.button.delete')}
                                                        </ElButton>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </ComplexTable>
                                </ElForm>
                            </>
                        ),
                    }}
                />
                <FileUpload
                    ref={uploadRef}
                    onClose={($event?: any) => {
                        (loadContainerFiles as any)($event);
                    }}
                />
                <DialogPro
                    modelValue={unref(previewVisible)}
                    onUpdate:modelValue={($v) => {
                        previewVisible.value = $v as any;
                    }}
                    title={unref(previewTitle)}
                    size="w-70"
                    close-on-click-modal={true}
                >
                    {unref(previewTruncated) ? (
                        <ElAlert
                            title={$t('file.previewTruncated')}
                            type="warning"
                            closable={false}
                            show-icon
                            class={'mb-2'}
                        />
                    ) : null}
                    <pre class={'preview-content'}>{unref(previewContent)}</pre>
                </DialogPro>
            </>
        );
    },
    options,
);
