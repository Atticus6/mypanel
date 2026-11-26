import { $t } from '@/utils/i18n-t';
import { readCachedPageSize } from '@/utils/panel-cache';
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, reactive, ref } from 'vue';
import { dateFormatSimpleWithSecond } from '@/utils/date';
import { computeSize } from '@/utils/size';
import { MsgError, MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import type { FileHistoryEntry } from '@/gen/panel/agent/v1/file_pb';
import { Setting } from '@/types/setting';
import { loadMonacoLanguageSupport, setupMonacoEnvironment } from '@/utils/monaco';
import { ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Languages } from '@/global/mimetype';
import i18n from '@/lang';
import ComplexTable from '@/components/table/complex/ComplexTable';
type MonacoEditorApi = typeof import('monaco-editor/editor');
interface HistoryDrawerProps {
    path: string;
    content: string;
    language: string;
    extension: string;
    dirty: boolean;
    scope?: 'current' | 'all';
}
type HistoryRow = FileHistoryEntry & {
    sourcePath?: string;
    targetPath?: string;
    currentContent?: string;
};
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import { vLoading } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElCard } from 'element-plus';
import { ElCollapse } from 'element-plus';
import { ElCollapseItem } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSwitch } from 'element-plus';
import { ElInputNumber } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElTabs } from 'element-plus';
import { ElTabPane } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElSpace } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    restored: (...args: unknown[]) => true,
};

const options = {
    name: 'history',
    props: {},
    emits: emits,
    __scopeId: 'data-v-6a2dcafb',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref(false);
        const historyLoading = ref(false);
        const deleteLoading = ref(false);
        const settingSaving = ref(false);
        const restoreLoading = ref(false);
        const historySettingFormRef = ref<FormInstance>();
        const scope = ref<'current' | 'all'>('current');
        const operationFilter = ref('');
        const activeCollapse = ref([]);
        const paginationConfig = reactive({
            cacheSizeKey: 'file-history-page-size',
            currentPage: 1,
            pageSize: readCachedPageSize('file-history-page-size') || 20,
            total: 0,
            small: false,
        });
        const currentFile = ref<HistoryDrawerProps>({
            path: '',
            content: '',
            language: 'plaintext',
            extension: '',
            dirty: false,
        });
        const historySetting = ref<Setting.FileHistoryInfo>({
            enable: 'Enable',
            maxPerPath: 20,
            diskQuotaMB: 1024,
        });
        const historySettingRules = reactive<FormRules<Setting.FileHistoryInfo>>({
            enable: [
                {
                    required: true,
                    message: i18n.global.t('commons.rule.requiredInput'),
                    trigger: 'change',
                },
            ],
            maxPerPath: [
                {
                    required: true,
                    message: i18n.global.t('commons.rule.requiredInput'),
                    trigger: 'change',
                },
                {
                    validator: (_, value, callback) => {
                        const parsedValue = Number(value);
                        if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
                            callback(new Error(i18n.global.t('commons.rule.integer')));
                            return;
                        }
                        callback();
                    },
                    trigger: 'change',
                },
            ],
            diskQuotaMB: [
                {
                    required: true,
                    message: i18n.global.t('commons.rule.requiredInput'),
                    trigger: 'change',
                },
                {
                    validator: (_, value, callback) => {
                        const parsedValue = Number(value);
                        if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
                            callback(new Error(i18n.global.t('commons.rule.integer')));
                            return;
                        }
                        callback();
                    },
                    trigger: 'change',
                },
            ],
        });
        const historyItems = ref<HistoryRow[]>([]);
        const selected = ref<HistoryRow[]>([]);
        const selectedHistory = ref<HistoryRow | null>(null);
        const historyContent = ref('');
        const currentFileContent = ref('');
        const compareTargetPath = ref('');
        const windowWidth = ref(window.innerWidth);
        const operationMap = {
            '': i18n.global.t('app.all'),
            save: i18n.global.t('commons.button.save'),
            restore: i18n.global.t('commons.button.recover'),
            move: i18n.global.t('file.move'),
            rename: i18n.global.t('file.rename'),
        } as const;
        const operationOptions = Object.entries(operationMap).map(([value, label]) => ({
            label,
            value,
        }));
        const getOperationLabel = (operation: string) => {
            return operationMap[operation as keyof typeof operationMap] || operation;
        };
        const isVersionRecord = (operation: string) => operation === 'save' || operation === 'restore';
        const canRestoreSelected = computed(() => isVersionRecord(selectedHistory.value?.operation || ''));
        const isRestoringCurrentFile = computed(() => selectedHistory.value?.path === currentFile.value.path);
        const getCurrentTargetPath = (row: HistoryRow) => row.currentPath || row.path;
        const canSwitchToCurrentScope = computed(() => !!currentFile.value.path || historyItems.value.length > 0);
        const syncCurrentFileContext = (history?: HistoryRow | null) => {
            if (currentFile.value.path) {
                return;
            }
            const target = history || historyItems.value[0];
            if (!target) {
                return;
            }
            currentFile.value = {
                ...currentFile.value,
                path: target.currentPath || target.path || '',
                content: target.currentContent || currentFileContent.value || currentFile.value.content || '',
                extension: target.extension || currentFile.value.extension || '',
                language: currentFile.value.language || '',
                dirty: false,
                scope: 'current',
            };
        };
        const diffContainer = ref<HTMLElement | null>(null);
        let monacoApi: MonacoEditorApi | null = null;
        let diffEditor: ReturnType<MonacoEditorApi['editor']['createDiffEditor']> | null = null;
        let originalModel: ReturnType<MonacoEditorApi['editor']['createModel']> | null = null;
        let modifiedModel: ReturnType<MonacoEditorApi['editor']['createModel']> | null = null;
        const currentLanguage = computed(() => {
            const rawLanguage = currentFile.value.language || 'plaintext';
            if (rawLanguage) {
                return rawLanguage;
            }
            const extension = currentFile.value.extension?.replace('.', '') || '';
            const matched = Languages.find((item) => item.value.includes(extension));
            return matched?.label || 'plaintext';
        });
        const drawerSize = computed(() => {
            if (windowWidth.value >= 1600) {
                return '90%';
            }
            if (windowWidth.value >= 1280) {
                return '80%';
            }
            if (windowWidth.value >= 960) {
                return '100%';
            }
            return '100%';
        });
        const updateWindowWidth = () => {
            windowWidth.value = window.innerWidth;
        };
        const useWindowSize = () => {
            onMounted(() => window.addEventListener('resize', updateWindowWidth));
            onUnmounted(() => window.removeEventListener('resize', updateWindowWidth));
        };
        const ensureMonaco = async () => {
            if (monacoApi) {
                return monacoApi;
            }
            setupMonacoEnvironment();
            const [monacoModule] = await Promise.all([import('monaco-editor/editor'), loadMonacoLanguageSupport()]);
            monacoApi = monacoModule;
            return monacoApi;
        };
        const disposeDiffEditor = () => {
            if (diffEditor) {
                diffEditor.dispose();
                diffEditor = null;
            }
            originalModel?.dispose();
            modifiedModel?.dispose();
            originalModel = null;
            modifiedModel = null;
        };
        const renderDiff = async () => {
            if (!selectedHistory.value) {
                disposeDiffEditor();
                return;
            }
            const monaco = await ensureMonaco();
            await nextTick();
            if (!diffContainer.value) {
                disposeDiffEditor();
                return;
            }

            disposeDiffEditor();
            originalModel = monaco.editor.createModel(historyContent.value, currentLanguage.value);
            modifiedModel = monaco.editor.createModel(currentFileContent.value, currentLanguage.value);
            diffEditor = monaco.editor.createDiffEditor(diffContainer.value, {
                theme: 'vs-dark',
                readOnly: true,
                automaticLayout: true,
                folding: true,
                glyphMargin: true,
                roundedSelection: false,
                overviewRulerBorder: false,
                renderMarginRevertIcon: true,
                renderGutterMenu: false,
            });
            diffEditor.setModel({
                original: originalModel,
                modified: modifiedModel,
            });
        };
        const loadHistorySetting = async () => {
            const res = await rpc.agentSetting.getFileHistory({});
            historySetting.value = {
                enable: res.enable,
                maxPerPath: res.maxPerPath,
                diskQuotaMB: res.diskQuotaMb,
            };
        };
        const normalizeHistorySettingNumber = (value: number, defaultValue: number) => {
            const parsedValue = Number(value);
            return parsedValue > 0 ? parsedValue : defaultValue;
        };
        const saveHistorySetting = async () => {
            settingSaving.value = true;
            try {
                const valid = await historySettingFormRef.value?.validate().catch(() => false);
                if (!valid) {
                    return;
                }
                await rpc.agentSetting.updateFileHistory({
                    enable: historySetting.value.enable,
                    maxPerPath: normalizeHistorySettingNumber(historySetting.value.maxPerPath, 20),
                    diskQuotaMb: normalizeHistorySettingNumber(historySetting.value.diskQuotaMB, 1024),
                });
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            } catch (error) {
                MsgError(String(error));
            } finally {
                settingSaving.value = false;
            }
        };
        const loadHistoryList = async (resetPage = false) => {
            if (resetPage) {
                paginationConfig.currentPage = 1;
            }
            historyLoading.value = true;
            try {
                const currentScopePath =
                    currentFile.value.path ||
                    selectedHistory.value?.currentPath ||
                    selectedHistory.value?.path ||
                    historyItems.value[0]?.currentPath ||
                    historyItems.value[0]?.path ||
                    '';
                const res = await rpc.file.searchHistory({
                    page: paginationConfig.currentPage,
                    pageSize: paginationConfig.pageSize,
                    path: scope.value === 'current' ? currentScopePath : '',
                    scope: scope.value,
                    operation: operationFilter.value,
                });
                historyItems.value = res.items || [];
                paginationConfig.total = Number(res.total);
                if (historyItems.value.length > 0) {
                    const existSelected = selectedHistory.value
                        ? historyItems.value.find((item) => item.id === selectedHistory.value?.id)
                        : null;
                    try {
                        if (existSelected) {
                            await openHistoryRecord(existSelected);
                        } else {
                            await openHistoryRecord(historyItems.value[0]);
                        }
                    } catch (error) {
                        MsgError(String(error));
                    }
                } else {
                    selectedHistory.value = null;
                    historyContent.value = '';
                    currentFileContent.value = '';
                    compareTargetPath.value = '';
                    disposeDiffEditor();
                }
            } finally {
                historyLoading.value = false;
            }
        };
        const loadHistoryContent = async (historyId: number) => {
            return await rpc.file.getHistoryContent({ id: historyId });
        };
        const openHistoryRecord = async (row: HistoryRow) => {
            selectedHistory.value = row;
            try {
                const data = await loadHistoryContent(row.id);
                historyContent.value = data.content ?? '';
                currentFileContent.value = data.currentContent ?? data.content ?? currentFile.value.content ?? '';
                compareTargetPath.value = getCurrentTargetPath(row);
                await renderDiff();
            } catch (error) {
                MsgError(String(error));
                throw error;
            }
        };
        const handleSelectionChange = (rows: HistoryRow[]) => {
            selected.value = rows;
        };
        const deleteSelected = async (row: HistoryRow | null) => {
            const ids = selected.value.map((item) => item.id);
            const targetIds = row ? [row.id] : ids;
            if (!targetIds.length) return;
            try {
                await ElMessageBox.confirm(i18n.global.t('file.historyDeleteConfirm'), {
                    confirmButtonText: i18n.global.t('commons.button.delete'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'warning',
                });
            } catch {
                return;
            }
            deleteLoading.value = true;
            try {
                await rpc.file.deleteHistory({ ids: Array.from(targetIds) });
                MsgSuccess(i18n.global.t('commons.msg.deleteSuccess'));
                selected.value = [];
                await loadHistoryList(true);
            } finally {
                deleteLoading.value = false;
            }
        };
        const handleScopeChange = async () => {
            if (scope.value === 'current' && !canSwitchToCurrentScope.value) {
                scope.value = 'all';
                return;
            }
            if (scope.value === 'current') {
                syncCurrentFileContext(historyItems.value[0]);
            }
            await loadHistoryList(true);
        };
        const handleClose = () => {
            drawerVisible.value = false;
            disposeDiffEditor();
        };
        const confirmRestoreSelected = async () => {
            if (!selectedHistory.value) {
                return;
            }
            try {
                const confirmMessage = [
                    currentFile.value.dirty
                        ? i18n.global.t('file.historyRestoreDirtyConfirm')
                        : i18n.global.t('file.historyRestoreConfirm'),
                    '',
                    `${i18n.global.t('file.historyCompareTarget')}${i18n.global.t('commons.colon')}${selectedHistory.value.fileName}`,
                    `${i18n.global.t('file.historyCompareTargetPath')}${i18n.global.t('commons.colon')}${compareTargetPath.value || selectedHistory.value.path}`,
                    '',
                    currentFile.value.dirty ? i18n.global.t('file.historyDirtyHint') : '',
                ]
                    .filter(Boolean)
                    .join('\n');
                await ElMessageBox.confirm(confirmMessage, {
                    confirmButtonText: i18n.global.t('commons.button.recover'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'warning',
                    distinguishCancelAndClose: true,
                });
            } catch {
                return;
            }
            restoreLoading.value = true;
            try {
                const res = await rpc.file.restoreHistory({ id: selectedHistory.value.id });
                MsgSuccess(i18n.global.t('file.historyRestoreSuccess'));
                currentFile.value.content = res.content || currentFile.value.content;
                currentFile.value.dirty = false;
                ctx.emit('restored', res.path);
                await loadHistoryList(true);
            } catch (error) {
                MsgError(String(error));
            } finally {
                restoreLoading.value = false;
            }
        };
        const acceptParams = async (params: HistoryDrawerProps): Promise<void> => {
            currentFile.value = params;
            operationFilter.value = '';
            scope.value = params.scope || 'current';
            if (scope.value === 'current' && !params.path) {
                scope.value = 'all';
            }
            drawerVisible.value = true;
            if (scope.value === 'current') {
                syncCurrentFileContext();
            }
            await loadHistorySetting();
            await loadHistoryList(true);
        };
        useWindowSize();
        onBeforeUnmount(() => {
            disposeDiffEditor();
        });
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('file.history')}
                size={unref(drawerSize)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                destroy-on-close
            >
                <div class={'flex min-h-[60vh] flex-col gap-4'}>
                    <ElAlert type="info" closable={false} show-icon>
                        {$t('file.historyHint')}
                    </ElAlert>
                    {unref(isRestoringCurrentFile) && unref(currentFile).dirty ? (
                        <ElAlert type="warning" closable={false} show-icon>
                            {$t('file.historyDirtyHint')}
                        </ElAlert>
                    ) : null}
                    <ElCard shadow="never" class={'history-setting'}>
                        <ElCollapse
                            modelValue={unref(activeCollapse)}
                            onUpdate:modelValue={($v) => {
                                activeCollapse.value = $v as any;
                            }}
                            accordion={true}
                            class={'!border-0'}
                        >
                            <ElCollapseItem title={$t('file.historySettingTitle')} name="history" class={'!border-0'}>
                                <ElForm
                                    ref={historySettingFormRef}
                                    model={unref(historySetting)}
                                    rules={historySettingRules}
                                    label-position="top"
                                    class={'flex items-end gap-6'}
                                >
                                    <ElFormItem label={$t('file.historyEnable')} prop="enable">
                                        <ElSwitch
                                            modelValue={unref(historySetting).enable}
                                            onUpdate:modelValue={($v) => {
                                                unref(historySetting).enable = $v as any;
                                            }}
                                            active-value="Enable"
                                            inactive-value="Disable"
                                        />
                                    </ElFormItem>
                                    <ElFormItem label={$t('file.historyMaxPerPath')} prop="maxPerPath">
                                        <ElInputNumber
                                            modelValue={unref(historySetting).maxPerPath}
                                            onUpdate:modelValue={($v) => {
                                                unref(historySetting).maxPerPath = $v as any;
                                            }}
                                            min={1}
                                            max={1000}
                                            class={'!w-52'}
                                        />
                                    </ElFormItem>
                                    <ElFormItem label={$t('file.historyDiskQuota')} prop="diskQuotaMB">
                                        <ElInputNumber
                                            modelValue={unref(historySetting).diskQuotaMB}
                                            onUpdate:modelValue={($v) => {
                                                unref(historySetting).diskQuotaMB = $v as any;
                                            }}
                                            min={1}
                                            max={1048576}
                                            class={'!w-52'}
                                        />
                                    </ElFormItem>
                                    <ElFormItem class={'ml-auto'}>
                                        <ElButton
                                            type="primary"
                                            loading={unref(settingSaving)}
                                            onClick={($event?: any) => {
                                                (saveHistorySetting as any)($event);
                                            }}
                                        >
                                            {$t('commons.button.save')}
                                        </ElButton>
                                    </ElFormItem>
                                </ElForm>
                            </ElCollapseItem>
                        </ElCollapse>
                    </ElCard>
                    <div class={'history-workspace'}>
                        <ElCard
                            shadow="never"
                            class={'history-list-card min-h-0'}
                            v-slots={{
                                header: () => (
                                    <>
                                        <div
                                            class={'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'}
                                        >
                                            <ElTabs
                                                modelValue={unref(scope)}
                                                onUpdate:modelValue={($v) => {
                                                    scope.value = $v as any;
                                                }}
                                                type="card"
                                                onTabChange={($event?: any) => {
                                                    (handleScopeChange as any)($event);
                                                }}
                                                class={'flex-1'}
                                            >
                                                <ElTabPane
                                                    label={$t('file.historyCurrentScope')}
                                                    name="current"
                                                    disabled={!unref(canSwitchToCurrentScope)}
                                                />
                                                <ElTabPane label={$t('file.historyAllScope')} name="all" />
                                            </ElTabs>
                                            <div class={'flex flex-wrap items-center gap-2'}>
                                                <ElSelect
                                                    modelValue={unref(operationFilter)}
                                                    onUpdate:modelValue={($v) => {
                                                        operationFilter.value = $v as any;
                                                    }}
                                                    clearable
                                                    placeholder={$t('commons.table.type')}
                                                    onChange={($event?: any) => {
                                                        loadHistoryList(true);
                                                    }}
                                                    class={'w-full sm:!w-36'}
                                                >
                                                    {(operationOptions || []).map((item) => (
                                                        <ElOption
                                                            label={item.label}
                                                            value={item.value}
                                                            key={item.value}
                                                        />
                                                    ))}
                                                </ElSelect>
                                                <ElButton
                                                    loading={unref(historyLoading)}
                                                    onClick={($event?: any) => {
                                                        loadHistoryList(true);
                                                    }}
                                                    class={'w-full sm:w-auto'}
                                                >
                                                    {$t('commons.button.refresh')}
                                                </ElButton>
                                                {withDirectives(
                                                    <ElButton
                                                        disabled={unref(selected).length === 0}
                                                        loading={unref(deleteLoading)}
                                                        onClick={($event?: any) => {
                                                            deleteSelected(null);
                                                        }}
                                                        class={'!ml-0 w-full sm:w-auto'}
                                                    >
                                                        {$t('commons.button.delete')}
                                                    </ElButton>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ),
                            }}
                        >
                            <div class={'history-table-box'}>
                                <div class={'history-table-wrap'}>
                                    {withDirectives(
                                        <ComplexTable
                                            pagination-config={paginationConfig}
                                            data={unref(historyItems)}
                                            onSearch={($event?: any) => {
                                                loadHistoryList();
                                            }}
                                            onRowClick={($event?: any) => {
                                                (openHistoryRecord as any)($event);
                                            }}
                                            onSelectionChange={($event?: any) => {
                                                (handleSelectionChange as any)($event);
                                            }}
                                            class={'history-table'}
                                        >
                                            <ElTableColumn type="selection" width="46" />
                                            <ElTableColumn
                                                label={$t('commons.table.date')}
                                                min-width="180"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>{dateFormatSimpleWithSecond(row.createdAt)}</>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('file.fileName')}
                                                prop="fileName"
                                                min-width="160"
                                                show-overflow-tooltip
                                            />
                                            <ElTableColumn
                                                label={$t('file.path')}
                                                prop="path"
                                                min-width="260"
                                                show-overflow-tooltip
                                            />
                                            <ElTableColumn
                                                label={$t('commons.table.type')}
                                                min-width="110"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <div class={'flex flex-wrap items-center gap-2'}>
                                                                <ElTag size="small" effect="plain">
                                                                    {getOperationLabel(row.operation)}
                                                                </ElTag>
                                                            </div>
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('file.size')}
                                                min-width="110"
                                                v-slots={{
                                                    default: ({ row }) => <>{computeSize(Number(row.contentSize))}</>,
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('commons.table.operate')}
                                                min-width="150"
                                                fixed="right"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <ElButton
                                                                link
                                                                type="primary"
                                                                onClick={($event?: any) => {
                                                                    $event.stopPropagation();
                                                                    openHistoryRecord(row);
                                                                }}
                                                            >
                                                                {$t('commons.button.view')}
                                                            </ElButton>
                                                            {withDirectives(
                                                                <ElButton
                                                                    link
                                                                    type="primary"
                                                                    onClick={($event?: any) => {
                                                                        $event.stopPropagation();
                                                                        deleteSelected(row);
                                                                    }}
                                                                >
                                                                    {$t('commons.button.delete')}
                                                                </ElButton>,
                                                                [
                                                                    [permissionDirective, true],
                                                                    [nodeAdminDirective, true],
                                                                ],
                                                            )}
                                                        </>
                                                    ),
                                                }}
                                            />
                                        </ComplexTable>,
                                        [[vLoading, unref(historyLoading)]],
                                    )}
                                </div>
                            </div>
                        </ElCard>
                        {unref(selectedHistory) ? (
                            <ElCard
                                shadow="never"
                                class={'history-preview-card min-h-0'}
                                v-slots={{
                                    header: () => (
                                        <>
                                            <div
                                                class={
                                                    'flex flex-col gap-1 lg:flex-row lg:items-center lg:justify-between'
                                                }
                                            >
                                                <div class={'min-w-0'}>
                                                    <div class={'truncate font-medium'}>
                                                        {unref(selectedHistory).fileName}
                                                    </div>
                                                    <div
                                                        class={'truncate text-xs text-[var(--el-text-color-secondary)]'}
                                                    >
                                                        {unref(selectedHistory).path}
                                                    </div>
                                                    {unref(selectedHistory).sourcePath ||
                                                    unref(selectedHistory).targetPath ? (
                                                        <div
                                                            class={
                                                                'truncate text-xs text-[var(--el-text-color-secondary)]'
                                                            }
                                                        >
                                                            {unref(selectedHistory).sourcePath ||
                                                                unref(selectedHistory).path}
                                                            {unref(selectedHistory).targetPath ? (
                                                                <span>
                                                                    {'→ '}
                                                                    {unref(selectedHistory).targetPath}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    ) : null}
                                                </div>
                                                <ElSpace>
                                                    <ElTag effect="plain">
                                                        {getOperationLabel(unref(selectedHistory).operation)}
                                                    </ElTag>
                                                    <ElTag effect="plain">
                                                        {computeSize(Number(unref(selectedHistory).contentSize))}
                                                    </ElTag>
                                                    {unref(canRestoreSelected)
                                                        ? withDirectives(
                                                              <ElButton
                                                                  type="primary"
                                                                  loading={unref(restoreLoading)}
                                                                  onClick={($event?: any) => {
                                                                      (confirmRestoreSelected as any)($event);
                                                                  }}
                                                              >
                                                                  {$t('file.historyRestore')}
                                                              </ElButton>,
                                                              [
                                                                  [permissionDirective, true],
                                                                  [nodeAdminDirective, true],
                                                              ],
                                                          )
                                                        : null}
                                                </ElSpace>
                                            </div>
                                        </>
                                    ),
                                }}
                            >
                                <div class={'pb-2 text-xs text-[var(--el-text-color-secondary)]'}>
                                    {$t('file.historyDiffHintCurrent')}
                                </div>
                                {unref(compareTargetPath) ? (
                                    <div class={'pb-2 text-xs text-[var(--el-text-color-secondary)]'}>
                                        {$t('file.historyCompareTargetPath')}
                                        {$t('commons.colon')}
                                        {unref(compareTargetPath)}
                                    </div>
                                ) : null}
                                {unref(selectedHistory) && !isVersionRecord(unref(selectedHistory).operation) ? (
                                    <ElAlert type="info" closable={false} show-icon>
                                        {$t('file.historyOperationOnlyHint')}
                                    </ElAlert>
                                ) : (
                                    <div ref={diffContainer} class={'history-diff'} />
                                )}
                            </ElCard>
                        ) : null}
                    </div>
                </div>
            </DrawerPro>
        );
    },
    options,
);
