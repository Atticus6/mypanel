import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { readCachedPageSize } from '@/utils/panel-cache';
import i18n from '@/lang';
import { reactive, ref } from 'vue';
import { File } from '@/types/file';
import FileList from '@/components/file-list/index';
import { Plus } from '@element-plus/icons-vue';
import { MsgWarning, MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { getFileType, isConvertible } from '@/utils/file';
import { v4 as uuidv4 } from 'uuid';
import TaskLog from '@/components/log/task/index';
import { TabsPaneContext } from 'element-plus';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    files: File.ConvertFile[];
    outputPath: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElTabs } from 'element-plus';
import { ElTabPane } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElBreadcrumbItem } from 'element-plus';
import { ElBreadcrumb } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElTooltip } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'convert',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const activeName = ref('convert');
        const open = ref(false);
        const loading = ref(false);
        const deleteSource = ref(false);
        const handleOutputFile = ref('png');
        const chooseFileRef = ref();
        const outputPath = ref('');
        const data = ref<File.ConvertFile[]>([]);
        let selects = ref<any>([]);
        const taskLogRef = ref();
        const logs = ref([]);
        const CONVERT_KEY = 'convert-files:' + currentNode.value;
        const handleClose = () => {
            open.value = false;
            handleOutputFile.value = 'png';
            activeName.value = 'convert';
            ctx.emit('close', false);
        };
        const options = [
            { value: 'png', label: 'png', type: 'image' },
            { value: 'jpg', label: 'jpg', type: 'image' },
            { value: 'webp', label: 'webp', type: 'image' },
            { value: 'gif', label: 'gif', type: 'image' },
            { value: 'jpeg', label: 'jpeg', type: 'image' },
            { value: 'bmp', label: 'bmp', type: 'image' },
            { value: 'tiff', label: 'tiff', type: 'image' },

            { value: 'mp4', label: 'mp4', type: 'video' },
            { value: 'avi', label: 'avi', type: 'video' },
            { value: 'mov', label: 'mov', type: 'video' },
            { value: 'mkv', label: 'mkv', type: 'video' },

            { value: 'mp3', label: 'mp3', type: 'audio' },
            { value: 'wav', label: 'wav', type: 'audio' },
            { value: 'flac', label: 'flac', type: 'audio' },
            { value: 'aac', label: 'aac', type: 'audio' },
        ];
        let req = reactive({
            name: '',
            page: 1,
            pageSize: 10,
            orderBy: 'favorite',
            order: 'descending',
        });
        const getOptionsByType = (type: string) => {
            return options.filter((opt) => opt.type === type);
        };
        const initTableData = () => {
            data.value.map((row) => {
                const matchedOption = getOptionsByType(row.type).find((item) => row.extension.concat(item.value));
                const defaultOption = getOptionsByType(row.type)[0]?.value;
                row.outputFormat = matchedOption?.value || defaultOption;
            });
        };
        const handleHeaderSelectChange = (value: string) => {
            if (value && data.value.length) {
                data.value.forEach((row) => {
                    const isValid = getOptionsByType(row.type).some((item) => item.value === value);
                    row.outputFormat = isValid ? value : row.outputFormat;
                });
            }
        };
        const addFile = () => {
            chooseFileRef.value?.acceptParams({ dir: false });
        };
        const paginationConfig = reactive({
            cacheSizeKey: 'file-convert-log-page-size',
            currentPage: 1,
            pageSize: readCachedPageSize('file-convert-log-page-size') || 20,
            total: 0,
        });
        const search = async () => {
            req.page = paginationConfig.currentPage;
            req.pageSize = paginationConfig.pageSize;
            loading.value = true;
            data.value = [];
            await rpc.file
                .searchConvertLogs(req)
                .then((res) => {
                    logs.value = res.items;
                    paginationConfig.total = Number(res.total);
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const chooseFile = async (path: string) => {
            await rpc.file.getFile({ path }).then((res) => {
                if (!isConvertible(res.extension, res.mimeType)) {
                    MsgWarning(i18n.global.t('file.fileCanNotConvert'));
                    return;
                }
                updateFiles([
                    {
                        type: getFileType(res.extension),
                        inputFile: res.name,
                        extension: res.extension,
                        path: getDirPath(res.path, res.name),
                        outputFormat: res.extension.slice(1),
                    },
                ]);
            });
        };
        const getDirPath = (fullPath: string, fileName: string): string => {
            if (!fullPath || !fileName) return fullPath;
            if (fullPath.endsWith(fileName)) {
                const dir = fullPath.slice(0, fullPath.length - fileName.length);
                return dir.replace(/\/$/, '');
            }
            return fullPath;
        };
        const delFile = async (path: string, name: string) => {
            ElMessageBox.confirm(i18n.global.t('file.deleteHelper2'), i18n.global.t('commons.msg.remove'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                try {
                    loading.value = true;
                    removeByPathAndName(path, name);
                } catch (error) {
                } finally {
                    loading.value = false;
                }
            });
        };
        const removeByPathAndName = (path: string, name: string) => {
            const fullPath = `${path}/${name}`;
            data.value = data.value.filter((item) => `${item.path}/${item.inputFile}` !== fullPath);
            saveFiles();
        };
        const convert = async () => {
            if (selects.value.length > 0) {
                ElMessageBox.confirm(i18n.global.t('file.convertHelper'), i18n.global.t('file.convert'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                }).then(async () => {
                    loading.value = true;
                    const reqFiles = selects.value;
                    const output = outputPath.value;
                    const deleteSrc = deleteSource.value;
                    const taskID = uuidv4();
                    const singleReq = {
                        files: reqFiles,
                        outputPath: output,
                        deleteSource: deleteSrc,
                        taskId: taskID,
                    };
                    await rpc.file
                        .convertFiles(singleReq)
                        .then(() => {
                            removeSelected();
                            deleteSource.value = false;
                            MsgSuccess(i18n.global.t('file.execConvert'));
                            openTaskLog(taskID);
                        })
                        .finally(() => {
                            loading.value = false;
                        });
                });
            } else {
                MsgWarning(i18n.global.t('file.convertHelper1'));
            }
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.delete'),
                click: (row: any) => {
                    delFile(row.path, row.inputFile);
                },
            },
        ];
        const loadFiles = () => {
            const stored = localStorage.getItem(CONVERT_KEY);
            if (stored) {
                try {
                    data.value = JSON.parse(stored);
                } catch {
                    data.value = [];
                }
            } else {
                data.value = [];
            }
        };
        const saveFiles = () => {
            localStorage.setItem(CONVERT_KEY, JSON.stringify(data.value));
        };
        const updateFiles = (newFiles: File.ConvertFile[]) => {
            const stored = localStorage.getItem(CONVERT_KEY);
            if (stored) {
                try {
                    const oldFiles: File.ConvertFile[] = JSON.parse(stored);
                    const merged = [...oldFiles];
                    for (const file of newFiles) {
                        if (!merged.some((item) => item.path === file.path && item.inputFile === file.inputFile)) {
                            merged.push(file);
                        }
                    }
                    data.value = merged;
                } catch {
                    data.value = [...newFiles];
                }
            } else {
                data.value = [...newFiles];
            }
            saveFiles();
        };
        const handleClick = (tab: TabsPaneContext) => {
            if (tab.paneName == 'log') {
                search();
            } else {
                loadFiles();
            }
        };
        const removeSelected = () => {
            const selectedKeys = new Set(selects.value.map((s) => `${s.path}/${s.inputFile}`));
            data.value = data.value.filter((d) => !selectedKeys.has(`${d.path}/${d.inputFile}`));
            saveFiles();
        };
        const acceptParams = (param: DialogProps): void => {
            open.value = true;
            outputPath.value = param.outputPath;
            loadFiles();
            updateFiles(param.files);
            initTableData();
        };
        ctx.expose({ acceptParams });
        return () => (
            <div>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    header={$t('file.formatConvert')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="60%"
                    v-slots={{
                        content: () => (
                            <>
                                <ElTabs
                                    modelValue={unref(activeName)}
                                    onUpdate:modelValue={($v) => {
                                        activeName.value = $v as any;
                                    }}
                                    type="card"
                                    onTabClick={($event?: any) => {
                                        (handleClick as any)($event);
                                    }}
                                >
                                    <ElTabPane label={$t('file.formatConvert')} name="convert">
                                        {withDirectives(
                                            <ElForm>
                                                <div class={'flex-row items-center justify-start'}>
                                                    <ElButton
                                                        type="primary"
                                                        plain
                                                        icon={Plus}
                                                        onClick={($event?: any) => {
                                                            (addFile as any)($event);
                                                        }}
                                                    />
                                                </div>
                                                <ComplexTable
                                                    selects={unref(selects)}
                                                    onUpdate:selects={($v) => {
                                                        selects.value = $v as any;
                                                    }}
                                                    data={unref(data)}
                                                >
                                                    <ElTableColumn fixed type="selection" width="30" />
                                                    <ElTableColumn
                                                        label={$t('file.sourceFile')}
                                                        show-overflow-tooltip
                                                        prop="inputFile"
                                                        min-width="150"
                                                    />
                                                    <ElTableColumn
                                                        label={$t('file.sourceFormat')}
                                                        show-overflow-tooltip
                                                        prop="extension"
                                                        width="90"
                                                    />
                                                    <ElTableColumn
                                                        prop="outputFile"
                                                        width="160"
                                                        v-slots={{
                                                            header: () => (
                                                                <>
                                                                    <div
                                                                        class={
                                                                            'flex items-center justify-start gap-x-1'
                                                                        }
                                                                    >
                                                                        <span>{$t('file.converting')}</span>
                                                                        <ElSelect
                                                                            modelValue={unref(handleOutputFile)}
                                                                            onUpdate:modelValue={($v) => {
                                                                                handleOutputFile.value = $v as any;
                                                                            }}
                                                                            placeholder="Select"
                                                                            size="small"
                                                                            onChange={($event?: any) => {
                                                                                (handleHeaderSelectChange as any)(
                                                                                    $event,
                                                                                );
                                                                            }}
                                                                            class={'font-normal'}
                                                                            style={'width: 90px'}
                                                                        >
                                                                            {(options || []).map((item) => (
                                                                                <ElOption
                                                                                    label={item.label}
                                                                                    value={item.value}
                                                                                    key={item.value}
                                                                                />
                                                                            ))}
                                                                        </ElSelect>
                                                                    </div>
                                                                </>
                                                            ),
                                                            default: ({ row }) => (
                                                                <>
                                                                    <ElSelect
                                                                        modelValue={row.outputFormat}
                                                                        onUpdate:modelValue={($v) => {
                                                                            row.outputFormat = $v as any;
                                                                        }}
                                                                        value={
                                                                            row.outputFormat ||
                                                                            getOptionsByType(row.type)[0]?.value
                                                                        }
                                                                        style={'width: 135px'}
                                                                    >
                                                                        {(getOptionsByType(row.type) || []).map(
                                                                            (item) => (
                                                                                <ElOption
                                                                                    label={item.label}
                                                                                    value={item.value}
                                                                                    key={item.value}
                                                                                />
                                                                            ),
                                                                        )}
                                                                    </ElSelect>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <FuTableOperations
                                                        buttons={buttons}
                                                        label={$t('commons.table.operate')}
                                                        fix
                                                        width="100"
                                                    />
                                                </ComplexTable>
                                                <div class={'flex-row items-center justify-start pt-6'}>
                                                    <div class={'flex items-center justify-start'}>
                                                        <ElBreadcrumbItem>{$t('file.saveDir') + ':'}</ElBreadcrumbItem>
                                                        <ElBreadcrumb separator="/">
                                                            <ElBreadcrumbItem>{unref(outputPath)}</ElBreadcrumbItem>
                                                        </ElBreadcrumb>
                                                    </div>
                                                    <ElCheckbox
                                                        modelValue={unref(deleteSource)}
                                                        onUpdate:modelValue={($v) => {
                                                            deleteSource.value = $v as any;
                                                        }}
                                                        label={$t('file.deleteSourceFile')}
                                                        size="large"
                                                    />
                                                </div>
                                            </ElForm>,
                                            [[vLoading, unref(loading)]],
                                        )}
                                    </ElTabPane>
                                    <ElTabPane label={$t('file.convertLogs')} name="log">
                                        <ComplexTable
                                            pagination-config={paginationConfig}
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                            data={unref(logs)}
                                        >
                                            <ElTableColumn
                                                label={$t('commons.table.date')}
                                                show-overflow-tooltip
                                                prop="date"
                                                width="160"
                                            />
                                            <ElTableColumn
                                                label={$t('commons.table.type')}
                                                show-overflow-tooltip
                                                prop="type"
                                                width="70"
                                            />
                                            <ElTableColumn
                                                label={$t('commons.button.log')}
                                                prop="log"
                                                min-width="160"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <ElTooltip content={row.log} {...TABLE_TOOLTIP_OPTIONS}>
                                                                {row.log}
                                                            </ElTooltip>
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('commons.table.message')}
                                                prop="status"
                                                width="100"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {row.status === 'FAILED' ? (
                                                                <ElTooltip
                                                                    content={row.message}
                                                                    {...TABLE_TOOLTIP_OPTIONS}
                                                                >
                                                                    <ElButton type="danger" link>
                                                                        {$t(
                                                                            'commons.status.' +
                                                                                row.status.toLowerCase(),
                                                                        )}
                                                                    </ElButton>
                                                                </ElTooltip>
                                                            ) : (
                                                                <ElButton
                                                                    type={
                                                                        row.status === 'SUCCESS' ? 'success' : 'default'
                                                                    }
                                                                    link
                                                                >
                                                                    {$t('commons.status.' + row.status.toLowerCase())}
                                                                </ElButton>
                                                            )}
                                                        </>
                                                    ),
                                                }}
                                            />
                                        </ComplexTable>
                                    </ElTabPane>
                                </ElTabs>
                            </>
                        ),
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (removeSelected as any)($event);
                                        }}
                                        disabled={unref(selects).length === 0}
                                    >
                                        {$t('commons.button.delete')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (convert as any)($event);
                                        }}
                                        disabled={unref(selects).length === 0}
                                    >
                                        {$t('commons.button.handle')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                />
                <FileList
                    ref={chooseFileRef}
                    onChoose={($event?: any) => {
                        (chooseFile as any)($event);
                    }}
                />
                <TaskLog ref={taskLogRef} />
            </div>
        );
    },
    options,
);
