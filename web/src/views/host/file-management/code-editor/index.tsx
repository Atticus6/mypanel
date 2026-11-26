import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgError, MsgSuccess, MsgWarning } from '@/utils/message';
import { loadMonacoLanguageSupport, setupMonacoEnvironment } from '@/utils/monaco';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { Languages } from '@/global/mimetype';
import { resolveEditorLanguage } from '@/utils/file';
import { hasManagePermissionAccess } from '@/utils/permission';
import type { TabPaneName } from 'element-plus';
import { ElMessageBox, ElTreeV2 } from 'element-plus';
import { copyText } from '@/utils/clipboard';
import { getIcon } from '@/utils/file';
import { newUUID } from '@/utils/id';
import { TreeNodeData } from 'element-plus/es/components/tree-v2/src/types';
import { CopyDocument, Delete, Edit, MoreFilled, Refresh, Top } from '@element-plus/icons-vue';
import { rpc } from '@/lib/rpc';
import type { FileTreeNode, FileTreeResponse } from '@/gen/panel/agent/v1/file_pb';
import CodeTabs from './tabs/index';
import FileHistoryDrawer from './history/index';
import noUpdateImage from '@/assets/images/no_update_app.svg';
import { useGlobalStore } from '@/composables/useGlobalStore';
import {
    CodeEditorTheme,
    codeEditorThemeStorageKey,
    getDefaultCodeEditorTheme,
    resolveCodeEditorTheme,
} from '@/utils/code-editor-theme';
type MonacoEditorApi = typeof import('monaco-editor/editor');
interface EditProps {
    language: string;
    content: string;
    path: string;
    name: string;
    extension: string;
    initialLine?: number;
}
interface EditorConfig {
    theme: CodeEditorTheme;
    language: string;
    eol: number;
    wordWrap: WordWrapOptions;
    minimap: boolean;
}
type WordWrapOptions = 'off' | 'on' | 'wordWrapColumn' | 'bounded';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import { vLoading } from 'element-plus';
import { cn } from '@/utils/cn';
import { ElTooltip } from 'element-plus';
import { ElSpace } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElDivider } from 'element-plus';
import { ElText } from 'element-plus';
import { ElDropdown } from 'element-plus';
import { ElDropdownMenu } from 'element-plus';
import { ElDropdownItem } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElSplitter } from 'element-plus';
import { ElSplitterPanel } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElEmpty } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';
import CopyButton from '@/components/copy-button/index';
import { Check } from '@element-plus/icons-vue';
import { ArrowDown } from '@element-plus/icons-vue';
import FuDropdownItem from '@/components/fu/FuDropdownItem';
import SvgIcon from '@/components/svg-icon/svg-icon';
import { Close } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'code-editor',
    props: {},
    emits: emits,
    __scopeId: 'data-v-5548977f',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isDarkTheme, isMobile } = useGlobalStore();
        let monacoApi: MonacoEditorApi | null = null;
        let monacoThemeInitialized = false;
        let editor: ReturnType<MonacoEditorApi['editor']['create']> | undefined;
        let editorLayoutFrame: number | null = null;
        let heightUpdateFrame: number | null = null;
        const eolLf = ref(0);
        const eolCrlf = ref(1);
        const ensureMonaco = async () => {
            if (monacoApi) {
                return monacoApi;
            }

            setupMonacoEnvironment();
            const [monacoModule] = await Promise.all([import('monaco-editor/editor'), loadMonacoLanguageSupport()]);
            monacoApi = monacoModule;
            eolLf.value = monacoApi.editor.EndOfLineSequence.LF;
            eolCrlf.value = monacoApi.editor.EndOfLineSequence.CRLF;

            if (!monacoThemeInitialized) {
                monacoApi.editor.defineTheme('vs', {
                    base: 'vs',
                    inherit: true,
                    rules: [{ token: '' }],
                    colors: {
                        'editor.background': '#f8f6f6',
                        'minimap.background': '#f4f4f4',
                        'scrollbar.shadow': '#e1e1e1',
                        'scrollbarSlider.background': '#e1e1e1',
                        'scrollbarSlider.hoverBackground': '#cccccc',
                        'scrollbarSlider.activeBackground': '#bfbfbf',
                    },
                });
                monacoThemeInitialized = true;
            }

            return monacoApi;
        };
        const disposeEditor = () => {
            if (!editor) {
                return;
            }
            clearPendingLineHighlight();
            editor.dispose();
            editor = undefined;
        };
        const pendingInitialLine = ref(0);
        let lineHighlightDecorationIds: string[] = [];
        const clearPendingLineHighlight = () => {
            if (!editor) {
                lineHighlightDecorationIds = [];
                return;
            }
            lineHighlightDecorationIds = editor.deltaDecorations(lineHighlightDecorationIds, []);
        };
        const revealPendingInitialLine = () => {
            const line = pendingInitialLine.value;
            if (!editor || !monacoApi || line < 1) {
                return;
            }
            const model = editor.getModel();
            if (!model) {
                return;
            }
            const targetLine = Math.min(line, model.getLineCount());
            editor.setSelection({
                startLineNumber: targetLine,
                startColumn: 1,
                endLineNumber: targetLine,
                endColumn: 1,
            });
            editor.setPosition({ lineNumber: targetLine, column: 1 });
            editor.revealLineInCenter(targetLine);
            lineHighlightDecorationIds = editor.deltaDecorations(lineHighlightDecorationIds, [
                {
                    range: new monacoApi.Range(targetLine, 1, targetLine, model.getLineMaxColumn(targetLine)),
                    options: {
                        isWholeLine: true,
                        className: 'ai-search-target-line',
                        linesDecorationsClassName: 'ai-search-target-line-gutter',
                    },
                },
            ]);
            editor.focus();
            pendingInitialLine.value = 0;
        };
        const open = ref(false);
        const loading = ref(false);
        const fileName = ref('');
        const codeThemeKey = codeEditorThemeStorageKey;
        const warpKey = 'code-warp';
        const minimapKey = 'code-minimap';
        const directoryPath = ref('');
        const fileExtension = ref('');
        const baseDir = ref();
        const treeData = ref([]);
        const codeBox = ref();
        const defaultHeight = ref(56);
        const treeHeight = ref(0);
        const splitterHeight = ref('56vh');
        const isShow = ref(true);
        const defaultTreePanelSize = 220;
        const minTreePanelSize = 160;
        const maxTreePanelSize = 420;
        const mobileMinTreePanelSize = 120;
        const mobileMaxTreePanelSize = 320;
        const treePanelSize = ref(defaultTreePanelSize);
        const lastTreePanelSize = ref(defaultTreePanelSize);
        const isEdit = ref(false);
        const oldFileContent = ref('');
        const dialogHeader = ref(null);
        const dialogForm = ref(null);
        const dialogFooter = ref(null);
        const historyDrawerRef = ref();
        const currentPath = ref();
        const historyVersionCount = ref(0);
        const rowRefs = ref();
        const isCreate = ref('none');
        const newFolder = ref();
        const selectedParentNode = ref(null);
        const expandedNodeIds = ref<Set<string>>(new Set());
        const expandedNodeKeys = computed<string[]>(() => Array.from(expandedNodeIds.value));
        const addExpandedNode = (id: string) => {
            expandedNodeIds.value.add(id);
        };
        const removeExpandedNode = (id: string) => {
            expandedNodeIds.value.delete(id);
        };
        const resetExpandedNodes = () => {
            expandedNodeIds.value = new Set<string>();
        };
        const refreshEditorLayout = () => {
            if (editorLayoutFrame !== null) {
                return;
            }
            editorLayoutFrame = window.requestAnimationFrame(() => {
                editorLayoutFrame = null;
                editor?.layout();
            });
        };
        const syncTreePanelState = (size: number) => {
            const nextSize = Math.max(size, 0);
            treePanelSize.value = nextSize;
            isShow.value = nextSize > 0;
            if (isMobile.value) {
                treeHeight.value = Math.max(nextSize - 31, 0);
            }
            if (nextSize > 0) {
                lastTreePanelSize.value = nextSize;
            }
            closeTreeContextMenu();
            refreshEditorLayout();
        };
        const handleTreePanelSizeChange = (size: string | number) => {
            const nextSize = Number(size);
            if (Number.isNaN(nextSize)) {
                return;
            }
            syncTreePanelState(nextSize);
        };
        const handleSplitterResizeEnd = () => {
            refreshEditorLayout();
        };
        const getViewportHeight = () => window.visualViewport?.height || window.innerHeight;
        const toggleMobileTree = () => {
            if (!isMobile.value) {
                return;
            }
            const nextSize = isShow.value
                ? 0
                : Math.min(240, Math.max(mobileMinTreePanelSize, getViewportHeight() * 0.3));
            syncTreePanelState(nextSize);
            scheduleHeightUpdate();
        };
        const handleSplitterCollapse = (index: number, type: 'start' | 'end', sizes: number[]) => {
            if (index !== 0 || !type) {
                return;
            }
            const nextSize = sizes[0] || 0;
            syncTreePanelState(nextSize > 0 ? nextSize : 0);
            if (!nextSize && lastTreePanelSize.value < minTreePanelSize) {
                lastTreePanelSize.value = defaultTreePanelSize;
            }
        };
        const isFullscreen = ref(false);
        const config = reactive<EditorConfig>({
            theme: 'vs-dark',
            language: 'plaintext',
            eol: eolLf.value,
            wordWrap: 'on',
            minimap: false,
        });
        const selectTab = ref();
        const fileTabs = ref([]);
        const maxTabs = 10;
        const codeTabsStorageKey = 'code-editor-tabs';
        const saveTabsToStorage = () => {
            const simpleTabs = fileTabs.value.map((tab: any) => ({
                path: tab.path,
                name: tab.name,
            }));
            localStorage.setItem(codeTabsStorageKey, JSON.stringify(simpleTabs.slice(0, maxTabs)));
        };
        const loadTabsFromStorage = (): { path: string; name: string }[] => {
            const raw = localStorage.getItem(codeTabsStorageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.filter((item) => item && item.path && item.name);
            }
            return [];
        };
        const removeTab = (targetPath: TabPaneName) => {
            const tabs = fileTabs.value;
            let activeName = selectTab.value;

            const updateTabs = () => {
                if (activeName === targetPath) {
                    const index = tabs.findIndex((tab) => tab.path === targetPath);
                    const nextTab = tabs[index + 1] || tabs[index - 1];
                    if (nextTab) {
                        activeName = nextTab.path;
                    }
                }
                selectTab.value = activeName;
                fileTabs.value = tabs.filter((tab) => tab.path !== targetPath);
                saveTabsToStorage();
                if (fileTabs.value.length === 0) {
                    selectTab.value = '';
                    disposeEditor();
                }
            };

            if (isEdit.value) {
                ElMessageBox.confirm(i18n.global.t('file.saveContentAndClose'), {
                    confirmButtonText: i18n.global.t('commons.button.save'),
                    cancelButtonText: i18n.global.t('commons.button.notSave'),
                    type: 'info',
                    distinguishCancelAndClose: true,
                })
                    .then(() => {
                        updateTabs();
                        if (fileTabs.value.length > 0) {
                            saveContent();
                            getContent(selectTab.value);
                        }
                    })
                    .catch(() => {
                        updateTabs();
                        isEdit.value = false;
                        if (fileTabs.value.length > 0) {
                            getContent(selectTab.value);
                        }
                    });
            } else {
                updateTabs();
                if (fileTabs.value.length > 0) {
                    getContent(selectTab.value);
                }
            }
        };
        const removeAllTab = (targetPath: string, type: 'left' | 'right' | 'all') => {
            const tabs = fileTabs.value;
            const targetIndex = tabs.findIndex((tab) => tab.path === targetPath);
            let activeName = selectTab.value;

            const filterTabs = (): typeof fileTabs.value => {
                if (type === 'left') return tabs.slice(targetIndex);
                if (type === 'right') return tabs.slice(0, targetIndex + 1);
                return [];
            };

            const updateTabs = () => {
                if (activeName !== targetPath && type !== 'all') {
                    activeName = tabs[targetIndex]?.path || '';
                }
                const newTabs = type === 'all' ? [] : filterTabs();
                fileTabs.value = newTabs;
                selectTab.value = activeName;
                saveTabsToStorage();

                if (type === 'all') {
                    selectTab.value = '';
                    disposeEditor();
                } else if (newTabs.length > 0) {
                    getContent(activeName);
                }
            };

            const onConfirm = () => {
                updateTabs();
                saveContent();
            };

            const onCancel = () => {
                if (type === 'left' || type === 'right') {
                    editor.setValue(oldFileContent.value);
                }
                isEdit.value = false;
                isCreate.value = 'none';
                updateTabs();
            };

            if (isEdit.value) {
                ElMessageBox.confirm(i18n.global.t('file.saveContentAndClose'), {
                    confirmButtonText: i18n.global.t('commons.button.save'),
                    cancelButtonText: i18n.global.t('commons.button.notSave'),
                    type: 'info',
                    distinguishCancelAndClose: true,
                })
                    .then(onConfirm)
                    .catch(onCancel);
            } else {
                updateTabs();
            }
        };
        const removeOtherTab = (targetPath: string) => {
            const tabs = fileTabs.value;
            const targetTab = tabs.find((tab) => tab.path === targetPath);
            if (!targetTab) return;

            const updateTabs = () => {
                fileTabs.value = [targetTab];
                selectTab.value = targetTab.path;
                saveTabsToStorage();
                getContent(targetTab.path);
            };

            const onConfirm = () => {
                updateTabs();
                saveContent();
            };

            const onCancel = () => {
                editor.setValue(oldFileContent.value);
                isEdit.value = false;
                updateTabs();
            };

            if (isEdit.value) {
                ElMessageBox.confirm(i18n.global.t('file.saveContentAndClose'), {
                    confirmButtonText: i18n.global.t('commons.button.save'),
                    cancelButtonText: i18n.global.t('commons.button.notSave'),
                    type: 'info',
                    distinguishCancelAndClose: true,
                })
                    .then(onConfirm)
                    .catch(onCancel);
            } else {
                updateTabs();
            }
        };
        const changeTab = (targetPath: TabPaneName) => {
            selectTab.value = targetPath.toString();
            getContent(targetPath.toString());
        };
        const eols = computed(() => [
            {
                label: 'LF (Linux)',
                value: eolLf.value,
            },
            {
                label: 'CRLF (Windows)',
                value: eolCrlf.value,
            },
        ]);
        const themes = [
            {
                label: 'Visual Studio',
                value: 'vs',
            },
            {
                label: 'Visual Studio Dark',
                value: 'vs-dark',
            },
            {
                label: 'High Contrast Dark',
                value: 'hc-black',
            },
        ];
        let form = ref({
            content: '',
            path: '',
        });
        const currentEditorPath = computed(() => form.value.path || directoryPath.value || '');
        const handleClose = () => {
            const closeEditor = () => {
                open.value = false;
                selectTab.value = '';
                fileTabs.value = [];
                isEdit.value = false;
                if (editor) {
                    disposeEditor();
                }
                ctx.emit('close', open.value);
            };

            if (isEdit.value) {
                ElMessageBox.confirm(i18n.global.t('file.saveContentAndClose'), {
                    confirmButtonText: i18n.global.t('commons.button.save'),
                    cancelButtonText: i18n.global.t('commons.button.notSave'),
                    type: 'info',
                    distinguishCancelAndClose: true,
                })
                    .then(() => {
                        saveContent();
                    })
                    .finally(() => {
                        closeEditor();
                    });
            } else {
                closeEditor();
            }
        };
        const handleReset = () => {
            if (isEdit.value) {
                loading.value = true;
                form.value.content = oldFileContent.value;
                editor.setValue(oldFileContent.value);
                isEdit.value = false;
                MsgSuccess(i18n.global.t('commons.msg.resetSuccess'));
                loading.value = false;
            } else {
                MsgWarning(i18n.global.t('file.noEdit'));
            }
        };
        const loadTooltip = () => {
            return i18n.global.t('commons.button.' + (isFullscreen.value ? 'quitFullscreen' : 'fullscreen'));
        };
        onMounted(() => {
            isCreate.value = 'none';
            loadPath();
            scheduleHeightUpdate();
            window.addEventListener('resize', scheduleHeightUpdate);
            window.visualViewport?.addEventListener('resize', scheduleHeightUpdate);
            document.addEventListener('click', closeTreeContextMenu);
            window.addEventListener('scroll', closeTreeContextMenu, true);
        });
        const updateHeights = () => {
            const viewportHeight = getViewportHeight();
            const vh = viewportHeight / 100;
            if (isFullscreen.value || isMobile.value) {
                const paddingHeight = isMobile.value ? 0 : 30;
                const headerHeight = dialogHeader.value?.offsetHeight || 0;
                const formHeight = dialogForm.value?.offsetHeight || 0;
                const footerHeight = dialogFooter.value?.offsetHeight || 0;
                const minContentHeight = isMobile.value ? 120 : 240;
                const contentHeight = Math.max(
                    viewportHeight - headerHeight - formHeight - footerHeight - paddingHeight,
                    minContentHeight,
                );
                treeHeight.value = isMobile.value ? Math.max(treePanelSize.value - 31, 0) : contentHeight - 31;
                splitterHeight.value = `${contentHeight}px`;
            } else {
                splitterHeight.value = `${defaultHeight.value}vh`;
                treeHeight.value = defaultHeight.value * vh - 31;
            }
            refreshEditorLayout();
        };
        const scheduleHeightUpdate = () => {
            if (heightUpdateFrame !== null) {
                return;
            }
            heightUpdateFrame = window.requestAnimationFrame(() => {
                heightUpdateFrame = null;
                updateHeights();
            });
        };
        const flushHeightUpdate = () => {
            if (heightUpdateFrame !== null) {
                window.cancelAnimationFrame(heightUpdateFrame);
                heightUpdateFrame = null;
            }
            updateHeights();
        };
        const toggleFullscreen = () => {
            isFullscreen.value = !isFullscreen.value;
            scheduleHeightUpdate();
        };
        const changeLanguage = (command: string) => {
            if (!editor || !monacoApi) {
                return;
            }
            config.language = command;
            const model = editor.getModel();
            if (!model) {
                return;
            }
            monacoApi.editor.setModelLanguage(model, config.language);
        };
        const applyCodeEditorTheme = (theme: CodeEditorTheme, persist = false) => {
            config.theme = theme;
            if (!monacoApi) {
                return;
            }
            monacoApi.editor.setTheme(config.theme);
            applyTreeThemeClass();
            if (persist) {
                localStorage.setItem(codeThemeKey, config.theme);
            }
        };
        const changeTheme = (command: string) => {
            applyCodeEditorTheme(resolveCodeEditorTheme(command, isDarkTheme.value), true);
        };
        const applyTreeThemeClass = () => {
            const themes: Record<CodeEditorTheme, string> = {
                vs: 'monaco-editor-tree-light',
                'vs-dark': 'monaco-editor-tree-dark',
                'hc-black': 'monaco-editor-tree-dark',
            };

            if (!treeRef.value) {
                return;
            }
            Object.values(themes).forEach((themeClass) => {
                treeRef.value.$el.classList.remove(themeClass);
            });
            treeRef.value.$el.classList.add(themes[config.theme]);
        };
        const syncDefaultThemeWithPanelTheme = () => {
            const nextTheme = getDefaultCodeEditorTheme(isDarkTheme.value);
            localStorage.removeItem(codeThemeKey);
            applyCodeEditorTheme(nextTheme);
        };
        watch(isDarkTheme, syncDefaultThemeWithPanelTheme);
        const changeEOL = (command: number) => {
            if (!editor) {
                return;
            }
            config.eol = command;
            editor.getModel()?.pushEOL(config.eol);
        };
        const changeWarp = (command: string) => {
            config.wordWrap = command === 'on' ? 'off' : 'on';
            localStorage.setItem(warpKey, config.wordWrap);
            editor.updateOptions({
                wordWrap: isMobile.value ? 'on' : config.wordWrap,
            });
        };
        const changeMinimap = (command: boolean) => {
            config.minimap = command;
            localStorage.setItem(minimapKey, JSON.stringify(config.minimap));
            editor.updateOptions({
                minimap: {
                    enabled: !isMobile.value && config.minimap,
                },
            });
        };
        const applyResponsiveEditorOptions = () => {
            editor?.updateOptions({
                folding: !isMobile.value,
                lineDecorationsWidth: isMobile.value ? 6 : 10,
                lineNumbersMinChars: isMobile.value ? 3 : 6,
                minimap: {
                    enabled: !isMobile.value && config.minimap,
                },
                overviewRulerLanes: isMobile.value ? 0 : 3,
                scrollBeyondLastLine: false,
                wordWrap: isMobile.value ? 'on' : config.wordWrap,
            });
            refreshEditorLayout();
        };
        watch(isMobile, (mobile) => {
            if (mobile) {
                syncTreePanelState(0);
            } else if (!isShow.value) {
                syncTreePanelState(lastTreePanelSize.value || defaultTreePanelSize);
            }
            applyResponsiveEditorOptions();
            scheduleHeightUpdate();
        });
        const initEditor = async () => {
            const monaco = await ensureMonaco();

            disposeEditor();
            await nextTick();

            editor = monaco.editor.create(codeBox.value as HTMLElement, {
                theme: config.theme,
                value: form.value.content,
                readOnly: false,
                automaticLayout: true,
                language: config.language,
                folding: !isMobile.value,
                roundedSelection: false,
                overviewRulerBorder: false,
                wordWrap: isMobile.value ? 'on' : config.wordWrap,
                minimap: {
                    enabled: !isMobile.value && config.minimap,
                },
                lineDecorationsWidth: isMobile.value ? 6 : 10,
                lineNumbersMinChars: isMobile.value ? 3 : 6,
                overviewRulerLanes: isMobile.value ? 0 : 3,
                scrollBeyondLastLine: false,
            });
            if (editor.getModel()?.getValue() === '') {
                editor.getModel()?.setValue('');
            }

            editor.getModel()?.pushEOL(config.eol);
            applyTreeThemeClass();

            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, quickSave);
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, quickToggleComment);
            editor.focus();

            editor.onDidChangeModelContent(() => {
                if (editor) {
                    form.value.content = editor.getValue();
                    isEdit.value = true;
                }
            });

            revealPendingInitialLine();
        };
        const quickSave = () => {
            saveContent();
        };
        const quickToggleComment = () => {
            void editor?.getAction('editor.action.commentLine')?.run();
        };
        const openHistoryDrawer = () => {
            if (!form.value.path) {
                MsgWarning(i18n.global.t('file.historyNeedFile'));
                return;
            }
            if (!historyDrawerRef.value) {
                return;
            }
            historyDrawerRef.value.acceptParams({
                path: form.value.path,
                content: form.value.content,
                language: config.language,
                extension: fileExtension.value,
                dirty: isEdit.value,
            });
        };
        const loadHistoryVersionCount = async (path: string) => {
            if (!path) {
                historyVersionCount.value = 0;
                return;
            }

            try {
                const res = await rpc.file.searchHistory({
                    page: 1,
                    pageSize: 1,
                    path,
                    scope: 'current',
                });
                if (form.value.path === path) {
                    historyVersionCount.value = Number(res.total);
                }
            } catch {
                if (form.value.path === path) {
                    historyVersionCount.value = 0;
                }
            }
        };
        const saveContent = async () => {
            if (!hasManagePermissionAccess(undefined, { nodeAdmin: true })) {
                MsgError(i18n.global.t('commons.res.forbidden'));
                return;
            }
            if (isEdit.value) {
                loading.value = true;
                try {
                    await rpc.file.saveFile(form.value);
                    isEdit.value = false;
                    oldFileContent.value = form.value.content;
                    await loadHistoryVersionCount(form.value.path);
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                } finally {
                    loading.value = false;
                }
            } else {
                MsgWarning(i18n.global.t('file.noEdit'));
            }
        };
        const acceptParams = async (__panelSetupProps: EditProps) => {
            const monaco = await ensureMonaco();

            pendingInitialLine.value =
                __panelSetupProps.initialLine && __panelSetupProps.initialLine > 0
                    ? Math.floor(__panelSetupProps.initialLine)
                    : 0;
            form.value.content = __panelSetupProps.content;
            oldFileContent.value = __panelSetupProps.content;
            form.value.path = __panelSetupProps.path;
            historyVersionCount.value = 0;
            currentPath.value = getDirectoryPath(__panelSetupProps.path);
            directoryPath.value = getDirectoryPath(__panelSetupProps.path);
            fileExtension.value = __panelSetupProps.extension;
            fileName.value = __panelSetupProps.name;
            config.language = resolveEditorLanguage(
                __panelSetupProps.path,
                __panelSetupProps.extension,
                __panelSetupProps.name,
            );

            let savedTabs = loadTabsFromStorage();
            const withoutCurrent = savedTabs.filter((tab) => tab.path !== __panelSetupProps.path);
            if (withoutCurrent.length > 0) {
                try {
                    const existRes = await rpc.file.batchCheckFiles({ paths: withoutCurrent.map((t) => t.path) });
                    const existList = existRes.items;
                    const existingPaths = new Set(existList.map((r) => r.path));
                    savedTabs = withoutCurrent.filter((t) => existingPaths.has(t.path));
                } catch {
                    savedTabs = withoutCurrent;
                }
            } else {
                savedTabs = [];
            }
            const merged = [...savedTabs, { path: __panelSetupProps.path, name: __panelSetupProps.name }];
            fileTabs.value = merged.slice(-maxTabs);
            selectTab.value = __panelSetupProps.path;

            if (__panelSetupProps.language) {
                config.language = __panelSetupProps.language;
            }
            config.eol = monaco.editor.EndOfLineSequence.LF;
            config.theme = resolveCodeEditorTheme(localStorage.getItem(codeThemeKey), isDarkTheme.value);
            config.wordWrap = (localStorage.getItem(warpKey) as WordWrapOptions) || 'on';
            config.minimap =
                localStorage.getItem(minimapKey) !== null ? localStorage.getItem(minimapKey) === 'true' : true;
            open.value = true;
            saveTabsToStorage();
            loadHistoryVersionCount(__panelSetupProps.path);
            nextTick(() => {
                if (editor) {
                    editor.setValue(form.value.content);
                    const model = editor.getModel();
                    if (model) {
                        monacoApi?.editor.setModelLanguage(model, config.language);
                    }
                    isEdit.value = false;
                    revealPendingInitialLine();
                }
            });
        };
        const getIconName = (extension: string) => getIcon(extension);
        const loadPath = async () => {
            const pathRes = await rpc.agentSetting.getBaseDir({});
            baseDir.value = pathRes.path;
        };
        const getDirectoryPath = (filePath: string) => {
            if (!filePath) {
                return baseDir.value;
            }

            const lastSlashIndex = filePath.lastIndexOf('/');

            if (lastSlashIndex === -1) {
                return baseDir.value;
            }

            const directoryPath = filePath.substring(0, lastSlashIndex);
            if (directoryPath === '' || directoryPath === '.' || directoryPath === '/') {
                return baseDir.value;
            }
            return directoryPath;
        };
        const onOpen = async () => {
            if (isMobile.value) {
                syncTreePanelState(0);
            }
            await nextTick();
            flushHeightUpdate();
            await initEditor();
            applyCodeEditorTheme(config.theme);
            search(directoryPath.value).then((res) => {
                handleSearchResult(res);
            });
        };
        const handleSearchResult = (res: FileTreeResponse) => {
            resetExpandedNodes();
            if (res.items.length > 0 && res.items[0].children) {
                treeData.value = res.items[0].children.map((item) => ({
                    ...item,
                    children: item.isDir ? item.children || [] : undefined,
                }));
            } else {
                treeData.value = [];
            }
        };
        const getRefresh = (path: string) => {
            loading.value = true;
            try {
                search(path).then((res) => {
                    treeData.value = res.items[0].children;
                    loadedNodes.value = new Set();
                    resetExpandedNodes();
                    isCreate.value = 'none';
                    currentPath.value = path;
                    selectedParentNode.value = null;
                });
            } finally {
                loading.value = false;
                MsgSuccess(i18n.global.t('commons.msg.refreshSuccess'));
            }
        };
        const getContent = (path: string, forceReload = false) => {
            if (!forceReload && (form.value.path === path || isCreate.value == 'file')) {
                if (isMobile.value && isShow.value) {
                    syncTreePanelState(0);
                    scheduleHeightUpdate();
                }
                return;
            }
            const existsInTabs = fileTabs.value.some((tab) => tab.path === path);
            if (!existsInTabs && fileTabs.value.length >= maxTabs) {
                fileTabs.value.shift();
            }
            const fetchFileContent = () => {
                rpc.file
                    .getFile({ path })
                    .then((res) => {
                        form.value.content = res.content;
                        oldFileContent.value = res.content;
                        form.value.path = res.path;
                        fileExtension.value = res.extension;
                        fileName.value = res.name;
                        config.language = resolveEditorLanguage(res.path, res.extension, res.name);
                        initEditor();
                        const exists = fileTabs.value.some((tab) => tab.path === path);
                        if (exists) {
                            const tab = fileTabs.value.find((t) => t.path === path);
                            if (tab) tab.name = res.name;
                        } else {
                            fileTabs.value.push({
                                name: res.name,
                                path: res.path,
                            });
                        }
                        saveTabsToStorage();
                        selectTab.value = res.path;
                        loadHistoryVersionCount(res.path);
                        if (isMobile.value && isShow.value) {
                            syncTreePanelState(0);
                            scheduleHeightUpdate();
                        }
                    })
                    .catch(() => {});
            };

            if (isEdit.value) {
                ElMessageBox.confirm(i18n.global.t('file.saveAndOpenNewFile'), {
                    confirmButtonText: i18n.global.t('commons.button.sure'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                })
                    .then(() => {
                        saveContent();
                        fetchFileContent();
                    })
                    .catch(() => {
                        selectTab.value = form.value.path;
                    })
                    .finally(() => {});
            } else {
                fetchFileContent();
            }
        };
        const handleHistoryRestored = (path: string) => {
            if (path === form.value.path) {
                getContent(path, true);
                loadHistoryVersionCount(path);
            }
        };
        const initTreeData = () => ({
            path: '/',
            expand: true,
            showHidden: true,
            page: 1,
            pageSize: 1000,
            search: '',
            containSub: true,
            dir: false,
            sortBy: 'name',
            sortOrder: 'ascending',
        });
        let req = reactive(initTreeData());
        const loadedNodes = ref(new Set());
        const search = async (path: string) => {
            req.path = path;
            if (req.search != '') {
                req.sortBy = 'name';
                req.sortOrder = 'ascending';
            }
            return await rpc.file.getFileTree(req);
        };
        const getUpData = async () => {
            if ('/' === directoryPath.value) {
                MsgWarning(i18n.global.t('commons.msg.rootInfoErr'));
                return;
            }
            let pathParts = directoryPath.value.split('/');
            pathParts.pop();
            let newPath = pathParts.join('/') || '/';

            try {
                const response = await search(newPath);
                treeData.value = response.items[0]?.children || [];
                loadedNodes.value = new Set();
                resetExpandedNodes();
                isCreate.value = 'none';
                currentPath.value = newPath;
                selectedParentNode.value = null;
            } catch (error) {
            } finally {
                directoryPath.value = newPath;
            }
        };
        const treeRef = ref<InstanceType<typeof ElTreeV2>>();
        const treeContextMenu = reactive<{
            visible: boolean;
            x: number;
            y: number;
            data: any | null;
            node: any | null;
        }>({
            visible: false,
            x: 0,
            y: 0,
            data: null,
            node: null,
        });
        const treeProps = {
            value: 'id',
            label: 'name',
            children: 'children',
        };
        const closeTreeContextMenu = () => {
            treeContextMenu.visible = false;
            treeContextMenu.data = null;
            treeContextMenu.node = null;
        };
        const openTreeContextMenu = (event: MouseEvent, data: any, node: any) => {
            if (isMobile.value || data.id === 'new-dir' || data.id === 'new-file') {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            treeContextMenu.visible = true;
            treeContextMenu.x = event.clientX;
            treeContextMenu.y = event.clientY;
            treeContextMenu.data = data;
            treeContextMenu.node = node;
        };
        const handleNodeCollapse = (data: TreeNodeData, node: any) => {
            closeTreeContextMenu();
            isCreate.value = 'none';
            removeExpandedNode(data.id);

            const parentNode = node.parent;
            if (!parentNode) {
                selectedParentNode.value = null;
                return;
            }

            const hasExpandedChildren = parentNode.data.children?.some((child) => expandedNodeIds.value.has(child.id));

            if (hasExpandedChildren) {
                selectedParentNode.value = parentNode;
            } else {
                selectedParentNode.value = null;
            }
        };
        const handleNodeExpand = (data: TreeNodeData, node: any) => {
            closeTreeContextMenu();
            if (node.data.id == 'new-dir' || node.data.id == 'new-file') {
                return;
            }
            if (!node.data.isDir || loadedNodes.value.has(node.data.path)) {
                return;
            }
            if (node.data.isDir && isCreate.value == 'none') {
                currentPath.value = node.data.path;
                selectedParentNode.value = node;
                addExpandedNode(node.data.id);
            }
            search(data.path)
                .then((response) => {
                    const newTreeData = JSON.parse(JSON.stringify(treeData.value));
                    if (response.items.length > 0 && response.items[0].children) {
                        node.children = response.items[0].children;
                        loadedNodes.value.add(node.data.path);
                        updateNodeChildren(newTreeData, node.data.path, response.items[0].children);
                    } else {
                        node.children = [];
                    }
                    treeData.value = newTreeData;
                })
                .catch(() => {});
        };
        const getChildItems = (res: FileTreeResponse) => {
            return res.items.length > 0 && res.items[0].children ? res.items[0].children : [];
        };
        const loadDirectoryChildren = async (data: any, node: any) => {
            currentPath.value = data.path;
            selectedParentNode.value = node;
            addExpandedNode(data.id);
            if (loadedNodes.value.has(data.path)) {
                return;
            }
            const response = await search(data.path);
            const children = getChildItems(response);
            node.children = children;
            node.data.children = children;
            updateNodeChildren(treeData.value, data.path, children);
            treeData.value = [...treeData.value];
            loadedNodes.value.add(data.path);
        };
        const createFromContextMenu = async (command: string) => {
            const data = treeContextMenu.data;
            const node = treeContextMenu.node;
            closeTreeContextMenu();
            if (!data?.isDir || !node) {
                return;
            }
            try {
                await loadDirectoryChildren(data, node);
                handleCreate(command);
            } catch {
                MsgError(i18n.global.t('commons.status.failed'));
            }
        };
        const copyPathFromContextMenu = () => {
            const path = treeContextMenu.data?.path;
            closeTreeContextMenu();
            if (!path) {
                return;
            }
            copyText(path);
        };
        const updateNodeChildren = (nodes: any[], path: any, newChildren: FileTreeNode[]) => {
            const updateNode = (nodes: string | any[]) => {
                for (const element of nodes) {
                    if (element.path === path) {
                        element.children = newChildren;
                        break;
                    }
                    if (element.children && element.children.length) {
                        updateNode(element.children);
                    }
                }
            };
            updateNode(nodes);
        };
        const joinPath = (dir: string, name: string) => {
            if (dir === '/') {
                return `/${name}`;
            }
            return `${dir}/${name}`;
        };
        const isPathAffected = (path: string, targetPath: string, targetIsDir: boolean) => {
            return path === targetPath || (targetIsDir && path.startsWith(`${targetPath}/`));
        };
        const replaceAffectedPath = (path: string, oldPath: string, newPath: string, isDir: boolean) => {
            if (path === oldPath) {
                return newPath;
            }
            if (isDir && path.startsWith(`${oldPath}/`)) {
                return `${newPath}${path.slice(oldPath.length)}`;
            }
            return path;
        };
        const renameTreeNodePaths = (
            nodes: any[],
            oldPath: string,
            newPath: string,
            newName: string,
            isDir: boolean,
        ) => {
            for (const node of nodes) {
                if (node.path === oldPath) {
                    node.name = newName;
                }
                node.path = replaceAffectedPath(node.path, oldPath, newPath, isDir);
                if (node.children?.length) {
                    renameTreeNodePaths(node.children, oldPath, newPath, newName, isDir);
                }
            }
        };
        const removeTreeNodeByPath = (nodes: any[], targetPath: string, targetIsDir: boolean) => {
            return nodes
                .filter((node) => !isPathAffected(node.path, targetPath, targetIsDir))
                .map((node) => {
                    if (node.children?.length) {
                        node.children = removeTreeNodeByPath(node.children, targetPath, targetIsDir);
                    }
                    return node;
                });
        };
        const syncTabsAfterRename = (oldPath: string, newPath: string, newName: string, isDir: boolean) => {
            const isCurrentFileRenamed = form.value.path === oldPath;
            if (currentPath.value && isPathAffected(currentPath.value, oldPath, isDir)) {
                currentPath.value = replaceAffectedPath(currentPath.value, oldPath, newPath, isDir);
            }
            if (directoryPath.value && isPathAffected(directoryPath.value, oldPath, isDir)) {
                directoryPath.value = replaceAffectedPath(directoryPath.value, oldPath, newPath, isDir);
            }
            loadedNodes.value = new Set(
                Array.from(loadedNodes.value).map((path) => replaceAffectedPath(String(path), oldPath, newPath, isDir)),
            );
            fileTabs.value = fileTabs.value.map((tab) => {
                if (!isPathAffected(tab.path, oldPath, isDir)) {
                    return tab;
                }
                const nextPath = replaceAffectedPath(tab.path, oldPath, newPath, isDir);
                return {
                    ...tab,
                    path: nextPath,
                    name: tab.path === oldPath ? newName : tab.name,
                };
            });
            if (selectTab.value && isPathAffected(selectTab.value, oldPath, isDir)) {
                selectTab.value = replaceAffectedPath(selectTab.value, oldPath, newPath, isDir);
            }
            if (form.value.path && isPathAffected(form.value.path, oldPath, isDir)) {
                form.value.path = replaceAffectedPath(form.value.path, oldPath, newPath, isDir);
                if (isCurrentFileRenamed) {
                    fileName.value = newName;
                }
            }
            saveTabsToStorage();
        };
        const closeTabsAfterDelete = (targetPath: string, targetIsDir: boolean) => {
            const removedCurrent = selectTab.value && isPathAffected(selectTab.value, targetPath, targetIsDir);
            fileTabs.value = fileTabs.value.filter((tab) => !isPathAffected(tab.path, targetPath, targetIsDir));
            if (!removedCurrent) {
                saveTabsToStorage();
                return;
            }
            isEdit.value = false;
            const nextTab = fileTabs.value[fileTabs.value.length - 1];
            if (nextTab) {
                selectTab.value = nextTab.path;
                getContent(nextTab.path, true);
            } else {
                selectTab.value = '';
                form.value.content = '';
                form.value.path = '';
                oldFileContent.value = '';
                fileName.value = '';
                fileExtension.value = '';
                historyVersionCount.value = 0;
                disposeEditor();
            }
            saveTabsToStorage();
        };
        const renameFromContextMenu = async () => {
            const data = treeContextMenu.data;
            closeTreeContextMenu();
            if (!data) {
                return;
            }
            try {
                const res = await ElMessageBox.prompt(i18n.global.t('file.rename'), i18n.global.t('file.rename'), {
                    inputValue: data.name,
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    inputValidator: (value) => !!value?.trim(),
                });
                const newName = String(res.value || '').trim();
                if (!newName || newName === data.name) {
                    return;
                }
                const oldPath = data.path;
                const parentPath = getDirectoryPath(oldPath);
                const newPath = joinPath(parentPath, newName);
                loading.value = true;
                await rpc.file.changeName({ oldName: oldPath, newName: newPath });
                renameTreeNodePaths(treeData.value, oldPath, newPath, newName, data.isDir);
                treeData.value = [...treeData.value];
                syncTabsAfterRename(oldPath, newPath, newName, data.isDir);
                loadedNodes.value.delete(oldPath);
                loadedNodes.value.delete(newPath);
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            } finally {
                loading.value = false;
            }
        };
        const deleteFromContextMenu = async () => {
            const data = treeContextMenu.data;
            closeTreeContextMenu();
            if (!data) {
                return;
            }
            try {
                await ElMessageBox.confirm(
                    i18n.global.t(data.isDir ? 'file.deleteHelper' : 'file.deleteHelper2'),
                    i18n.global.t('commons.button.delete'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.delete'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        type: 'warning',
                    },
                );
                loading.value = true;
                await rpc.file.delete({ path: data.path, isDir: data.isDir, forceDelete: false });
                closeTabsAfterDelete(data.path, data.isDir);
                treeData.value = removeTreeNodeByPath(treeData.value, data.path, data.isDir);
                loadedNodes.value.delete(data.path);
                loadedNodes.value.delete(getDirectoryPath(data.path));
                if (
                    selectedParentNode.value &&
                    isPathAffected(selectedParentNode.value.data?.path || '', data.path, data.isDir)
                ) {
                    selectedParentNode.value = null;
                }
                if (currentPath.value && isPathAffected(currentPath.value, data.path, data.isDir)) {
                    currentPath.value = getDirectoryPath(data.path);
                }
                MsgSuccess(i18n.global.t('commons.msg.deleteSuccess'));
            } finally {
                loading.value = false;
            }
        };
        const handleMobileTreeCommand = (command: string, data: any, node: any) => {
            treeContextMenu.data = data;
            treeContextMenu.node = node;
            if (command === 'dir' || command === 'file') {
                return createFromContextMenu(command);
            }
            if (command === 'copy') {
                return copyPathFromContextMenu();
            }
            if (command === 'rename') {
                return renameFromContextMenu();
            }
            if (command === 'delete') {
                return deleteFromContextMenu();
            }
        };
        const currentEditingNode = ref<any>(null);
        const createNewNode = (command: string) => {
            const isDir = command === 'dir';
            const fileName = isDir ? 'dir' : 'file';
            return {
                id: isDir ? 'new-dir' : 'new-file',
                name: fileName,
                path: `${currentPath.value}/${fileName}`,
                isDir,
                extension: '',
                children: [],
            };
        };
        const removeExistingNode = (data: any[], command: string) => {
            const targetId = command == 'dir' ? 'new-dir' : 'new-file';
            data = filterNodes(data, targetId);
            treeData.value = [...data];
            return data;
        };
        const getRawNodeChildren = (node: any) => {
            if (!node?.data) {
                return [];
            }
            if (!Array.isArray(node.data.children)) {
                node.data.children = [];
            }
            node.data.children = node.data.children.map((child) => (child?.data?.path ? child.data : child));
            return node.data.children;
        };
        const handleCreate = (command: string) => {
            removeExistingNode(treeData.value, command);
            if ((command === 'dir' && isCreate.value === 'file') || (command === 'file' && isCreate.value === 'dir')) {
                cancelFolder();
                isCreate.value = 'none';
            }

            if (isCreate.value !== 'none') return;

            const newFileNode = createNewNode(command);
            newFolder.value = newFileNode.name;
            currentEditingNode.value = newFileNode;
            if (selectedParentNode.value) {
                const children = getRawNodeChildren(selectedParentNode.value);
                children.unshift(newFileNode);
                updateNodeChildren(treeData.value, selectedParentNode.value.data.path, children);
                treeData.value = [...treeData.value];
            } else {
                treeData.value = [newFileNode, ...treeData.value];
            }

            nextTick(() => {
                rowRefs.value?.focus();
            });

            isCreate.value = command;
        };
        const filterNodes = (nodes, targetId) => {
            const filtered = nodes.filter((node) => node.id !== targetId);

            filtered.forEach((node) => {
                if (node.children && node.children.length > 0) {
                    node.children = filterNodes(node.children, targetId);
                }
                if (node.data && node.data.children && node.data.children.length > 0) {
                    node.data.children = filterNodes(node.data.children, targetId);
                }
            });

            return filtered;
        };
        const cancelFolder = () => {
            const targetId = isCreate.value == 'dir' ? 'new-dir' : 'new-file';
            isCreate.value = 'none';
            newFolder.value = '';
            if (selectedParentNode.value) {
                selectedParentNode.value.data.children = getRawNodeChildren(selectedParentNode.value).filter(
                    (node) => node.id !== targetId,
                );
            }
            treeData.value = filterNodes(treeData.value, targetId);
            loadedNodes.value.delete(currentPath.value);
        };
        let addForm = reactive({
            path: '',
            name: '',
            isDir: true,
            mode: 0o755,
            isLink: false,
            isSymlink: true,
            linkPath: '',
        });
        const createFolder = async (isDir: boolean) => {
            addForm.path = `${currentPath.value}/${newFolder.value}`;
            const editingNode = currentEditingNode.value;
            if (!editingNode) return;
            if (addForm.path.indexOf('.1panel_clash') > -1) {
                MsgWarning(i18n.global.t('file.clashDidNotSupport'));
                return;
            }
            addForm.isDir = isDir;
            addForm.name = newFolder.value;
            let addItem = {};
            Object.assign(addItem, addForm);
            loading.value = true;
            rpc.file
                .createFile(addItem)
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                    editingNode.id = newUUID();
                    editingNode.name = addForm.name;
                    editingNode.path = addForm.path;
                    treeData.value = [...treeData.value];
                    isCreate.value = 'none';
                    currentEditingNode.value = null;
                    newFolder.value = '';
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        onBeforeUnmount(() => {
            if (editor) {
                editor.dispose();
            }
            isCreate.value = 'none';
            currentPath.value = '';
            selectedParentNode.value = null;
            window.removeEventListener('resize', scheduleHeightUpdate);
            window.visualViewport?.removeEventListener('resize', scheduleHeightUpdate);
            if (heightUpdateFrame !== null) {
                window.cancelAnimationFrame(heightUpdateFrame);
            }
            if (editorLayoutFrame !== null) {
                window.cancelAnimationFrame(editorLayoutFrame);
            }
            document.removeEventListener('click', closeTreeContextMenu);
            window.removeEventListener('scroll', closeTreeContextMenu, true);
        });
        ctx.expose({ acceptParams });
        return () => (
            <>
                <DialogPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    size={unref(isMobile) ? 'full' : 'w-70'}
                    onOpened={($event?: any) => {
                        (onOpen as any)($event);
                    }}
                    show-close={false}
                    fullscreen={unref(isMobile) || unref(isFullscreen)}
                    class={'code-dialog !p-0'}
                    v-slots={{
                        header: () => (
                            <>
                                <div
                                    ref={dialogHeader}
                                    class={'code-header flex items-center justify-between rounded-t px-4'}
                                >
                                    <div class={'code-title'}>
                                        <span class={'dialog-object-name'}>
                                            {$t('home.dir') + ' - ' + unref(currentEditorPath)}
                                        </span>
                                        {unref(currentEditorPath) ? (
                                            <ElTooltip content={$t('file.copyDir')} placement="top">
                                                <CopyButton
                                                    content={unref(currentEditorPath)}
                                                    class={'code-title-copy'}
                                                />
                                            </ElTooltip>
                                        ) : null}
                                    </div>
                                    <ElSpace alignment="center" size={1} class={'dialog-header-icon'}>
                                        {!unref(isMobile) ? (
                                            <ElTooltip content={loadTooltip()} placement="top">
                                                <ElButton
                                                    onClick={($event?: any) => {
                                                        (toggleFullscreen as any)($event);
                                                    }}
                                                    icon="FullScreen"
                                                    class={
                                                        'mr-2.5 !border-none !bg-transparent !px-1 !py-2 !text-base !font-semibold'
                                                    }
                                                />
                                            </ElTooltip>
                                        ) : null}
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (handleClose as any)($event);
                                            }}
                                            icon="Close"
                                            class={'!border-none !bg-transparent !px-1 !py-2 !text-xl'}
                                        />
                                    </ElSpace>
                                </div>
                            </>
                        ),
                        content: () => (
                            <>
                                <div ref={dialogForm} class={'code-action px-4 py-2'}>
                                    <div class={'card-action flex items-center justify-start gap-x-4'}>
                                        {unref(isMobile) ? (
                                            <>
                                                <ElButton
                                                    link
                                                    icon="FolderOpened"
                                                    title={$t('home.dir')}
                                                    aria-label={$t('home.dir')}
                                                    onClick={($event?: any) => {
                                                        (toggleMobileTree as any)($event);
                                                    }}
                                                    class={'mobile-action-button'}
                                                />
                                                <ElDivider direction="vertical" class={'!mx-0'} />
                                                <ElButton
                                                    link
                                                    icon="RefreshLeft"
                                                    title={$t('commons.button.reset')}
                                                    aria-label={$t('commons.button.reset')}
                                                    onClick={($event?: any) => {
                                                        (handleReset as any)($event);
                                                    }}
                                                    class={'mobile-action-button'}
                                                />
                                                <ElDivider direction="vertical" class={'!mx-0'} />
                                                {withDirectives(
                                                    <ElButton
                                                        link
                                                        icon="Check"
                                                        title={$t('commons.button.save')}
                                                        aria-label={$t('commons.button.save')}
                                                        onClick={($event?: any) => {
                                                            saveContent();
                                                        }}
                                                        class={'mobile-action-button'}
                                                    />,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <ElText
                                                    onClick={($event?: any) => {
                                                        (handleReset as any)($event);
                                                    }}
                                                    class={'cursor-pointer'}
                                                >
                                                    {$t('commons.button.reset')}
                                                </ElText>
                                                <ElDivider direction="vertical" class={'!mx-0'} />
                                                {withDirectives(
                                                    <ElText
                                                        onClick={($event?: any) => {
                                                            saveContent();
                                                        }}
                                                        class={'ml-0 cursor-pointer'}
                                                    >
                                                        {$t('commons.button.save')}
                                                    </ElText>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )}
                                            </>
                                        )}
                                        <ElDivider direction="vertical" class={'!mx-0'} />
                                        <ElDropdown
                                            trigger="click"
                                            max-height="300"
                                            placement="bottom-start"
                                            onCommand={($event?: any) => {
                                                (changeTheme as any)($event);
                                            }}
                                            v-slots={{
                                                dropdown: () => (
                                                    <>
                                                        <ElDropdownMenu>
                                                            {(themes || []).map((item) => (
                                                                <ElDropdownItem command={item.value} key={item.label}>
                                                                    <div
                                                                        class={
                                                                            'flex w-full items-center justify-between gap-4'
                                                                        }
                                                                    >
                                                                        {item.label}
                                                                        {config.theme == item.value ? (
                                                                            <ElIcon>
                                                                                <Check />
                                                                            </ElIcon>
                                                                        ) : null}
                                                                    </div>
                                                                </ElDropdownItem>
                                                            ))}
                                                        </ElDropdownMenu>
                                                    </>
                                                ),
                                            }}
                                        >
                                            <span class={'el-dropdown-link cursor-pointer'}>{$t('file.theme')}</span>
                                        </ElDropdown>
                                        <ElDivider direction="vertical" class={'!mx-0'} />
                                        <ElDropdown
                                            trigger="click"
                                            max-height="300"
                                            placement="bottom-start"
                                            onCommand={($event?: any) => {
                                                (changeLanguage as any)($event);
                                            }}
                                            v-slots={{
                                                dropdown: () => (
                                                    <>
                                                        <ElDropdownMenu>
                                                            {(Languages || []).map((item) => (
                                                                <ElDropdownItem command={item.label} key={item.label}>
                                                                    <div
                                                                        class={
                                                                            'flex w-full items-center justify-between gap-4'
                                                                        }
                                                                    >
                                                                        {item.label}
                                                                        {config.language == item.label ? (
                                                                            <ElIcon>
                                                                                <Check />
                                                                            </ElIcon>
                                                                        ) : null}
                                                                    </div>
                                                                </ElDropdownItem>
                                                            ))}
                                                        </ElDropdownMenu>
                                                    </>
                                                ),
                                            }}
                                        >
                                            <span class={'el-dropdown-link cursor-pointer'}>{$t('file.language')}</span>
                                        </ElDropdown>
                                        <ElDivider direction="vertical" class={'!mx-0'} />
                                        <ElDropdown
                                            trigger="click"
                                            max-height="300"
                                            placement="bottom-start"
                                            onCommand={($event?: any) => {
                                                (changeEOL as any)($event);
                                            }}
                                            v-slots={{
                                                dropdown: () => (
                                                    <>
                                                        <ElDropdownMenu>
                                                            {(unref(eols) || []).map((item) => (
                                                                <ElDropdownItem command={item.value} key={item.label}>
                                                                    <div
                                                                        class={
                                                                            'flex w-full items-center justify-between gap-4'
                                                                        }
                                                                    >
                                                                        {item.label}
                                                                        {config.eol == item.value ? (
                                                                            <ElIcon>
                                                                                <Check />
                                                                            </ElIcon>
                                                                        ) : null}
                                                                    </div>
                                                                </ElDropdownItem>
                                                            ))}
                                                        </ElDropdownMenu>
                                                    </>
                                                ),
                                            }}
                                        >
                                            <span class={'el-dropdown-link cursor-pointer'}>{$t('file.eol')}</span>
                                        </ElDropdown>
                                        <ElDivider direction="vertical" class={'!mx-0'} />
                                        {!unref(isMobile) ? (
                                            <ElDropdown
                                                trigger="click"
                                                max-height="300"
                                                placement="bottom-start"
                                                v-slots={{
                                                    dropdown: () => (
                                                        <>
                                                            <ElDropdownMenu>
                                                                <ElDropdownItem
                                                                    onClick={($event?: any) => {
                                                                        changeMinimap(!config.minimap);
                                                                    }}
                                                                >
                                                                    <div
                                                                        class={
                                                                            'flex w-full items-center justify-between gap-4'
                                                                        }
                                                                    >
                                                                        {$t('file.minimap')}
                                                                        {config.minimap ? (
                                                                            <ElIcon>
                                                                                <Check />
                                                                            </ElIcon>
                                                                        ) : null}
                                                                    </div>
                                                                </ElDropdownItem>
                                                                <ElDropdownItem
                                                                    onClick={($event?: any) => {
                                                                        changeWarp(config.wordWrap);
                                                                    }}
                                                                >
                                                                    <div
                                                                        class={
                                                                            'flex w-full items-center justify-between gap-4'
                                                                        }
                                                                    >
                                                                        {$t('file.wordWrap')}
                                                                        {config.wordWrap == 'on' ? (
                                                                            <ElIcon>
                                                                                <Check />
                                                                            </ElIcon>
                                                                        ) : null}
                                                                    </div>
                                                                </ElDropdownItem>
                                                            </ElDropdownMenu>
                                                        </>
                                                    ),
                                                }}
                                            >
                                                <span class={'el-dropdown-link cursor-pointer'}>
                                                    {$t('file.setting')}
                                                </span>
                                            </ElDropdown>
                                        ) : null}
                                        {unref(isMobile) ? (
                                            <>
                                                <ElText
                                                    onClick={($event?: any) => {
                                                        (openHistoryDrawer as any)($event);
                                                    }}
                                                    class={'cursor-pointer'}
                                                >
                                                    {$t('file.history')}
                                                    {' ('}
                                                    {unref(historyVersionCount)}
                                                    {') '}
                                                </ElText>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                {withDirectives(
                                    <div>
                                        <ElSplitter
                                            layout={unref(isMobile) ? 'vertical' : 'horizontal'}
                                            lazy
                                            onCollapse={($event?: any) => {
                                                (handleSplitterCollapse as any)($event);
                                            }}
                                            onResizeEnd={($event?: any) => {
                                                (handleSplitterResizeEnd as any)($event);
                                            }}
                                            class={'code-splitter'}
                                            style={{ height: unref(splitterHeight) }}
                                        >
                                            <ElSplitterPanel
                                                size={unref(treePanelSize)}
                                                onUpdate:size={($v) => {
                                                    treePanelSize.value = $v as any;
                                                }}
                                                min={
                                                    unref(isShow)
                                                        ? unref(isMobile)
                                                            ? mobileMinTreePanelSize
                                                            : minTreePanelSize
                                                        : 0
                                                }
                                                max={unref(isMobile) ? mobileMaxTreePanelSize : maxTreePanelSize}
                                                resizable={unref(isShow)}
                                                collapsible
                                                class={cn('code-tree-panel', { 'is-collapsed': !unref(isShow) })}
                                            >
                                                <div
                                                    class={
                                                        'monaco-editor monaco-editor-background tree-container border-0'
                                                    }
                                                    style={[{}, { display: unref(isShow) ? '' : 'none' }]}
                                                >
                                                    <div class={'flex h-7 items-center justify-between px-1'}>
                                                        <ElText
                                                            size="small"
                                                            onClick={($event?: any) => {
                                                                getUpData();
                                                            }}
                                                            class={'cursor-pointer'}
                                                        >
                                                            <ElIcon>
                                                                <Top />
                                                            </ElIcon>
                                                            <span class={'hidden pl-1 sm:inline'}>{$t('file.up')}</span>
                                                        </ElText>
                                                        <ElDivider direction="vertical" class={'!mx-0'} />
                                                        <ElText
                                                            size="small"
                                                            onClick={($event?: any) => {
                                                                getRefresh(unref(directoryPath));
                                                            }}
                                                            class={'cursor-pointer'}
                                                        >
                                                            <ElIcon>
                                                                <Refresh />
                                                            </ElIcon>
                                                            <span class={'hidden pl-1 sm:inline'}>
                                                                {$t('commons.button.refresh')}
                                                            </span>
                                                        </ElText>
                                                        <ElDivider direction="vertical" class={'!mx-0'} />
                                                        <ElDropdown
                                                            onCommand={($event?: any) => {
                                                                (handleCreate as any)($event);
                                                            }}
                                                            trigger="click"
                                                            v-slots={{
                                                                dropdown: () => (
                                                                    <>
                                                                        <ElDropdownMenu>
                                                                            {withDirectives(
                                                                                <FuDropdownItem
                                                                                    command="dir"
                                                                                    class={'!px-2'}
                                                                                >
                                                                                    <SvgIcon
                                                                                        iconName="p-file-folder"
                                                                                        class={'!h-5 !w-5'}
                                                                                    />
                                                                                    {$t('file.dir')}
                                                                                </FuDropdownItem>,
                                                                                [
                                                                                    [permissionDirective, true],
                                                                                    [nodeAdminDirective, true],
                                                                                ],
                                                                            )}
                                                                            {withDirectives(
                                                                                <FuDropdownItem
                                                                                    command="file"
                                                                                    class={'!px-2'}
                                                                                >
                                                                                    <SvgIcon
                                                                                        iconName="p-file-normal"
                                                                                        class={'!h-5 !w-5'}
                                                                                    />
                                                                                    {$t('menu.files')}
                                                                                </FuDropdownItem>,
                                                                                [
                                                                                    [permissionDirective, true],
                                                                                    [nodeAdminDirective, true],
                                                                                ],
                                                                            )}
                                                                        </ElDropdownMenu>
                                                                    </>
                                                                ),
                                                            }}
                                                        >
                                                            <ElText size="small" class={'cursor-pointer'}>
                                                                {$t('commons.button.create')}
                                                                <ElIcon>
                                                                    <ArrowDown />
                                                                </ElIcon>
                                                            </ElText>
                                                        </ElDropdown>
                                                    </div>
                                                    <ElDivider class={'!my-0'} />
                                                    <ElTreeV2
                                                        ref={treeRef}
                                                        data={unref(treeData)}
                                                        props={treeProps}
                                                        onNodeExpand={($event?: any) => {
                                                            (handleNodeExpand as any)($event);
                                                        }}
                                                        onNodeCollapse={($event?: any) => {
                                                            (handleNodeCollapse as any)($event);
                                                        }}
                                                        onNodeClick={($event?: any) => {
                                                            (closeTreeContextMenu as any)($event);
                                                        }}
                                                        onNodeContextmenu={($event?: any) => {
                                                            (openTreeContextMenu as any)($event);
                                                        }}
                                                        default-expanded-keys={unref(expandedNodeKeys)}
                                                        height={unref(treeHeight)}
                                                        indent={unref(isMobile) ? 12 : 6}
                                                        item-size={unref(isMobile) ? 34 : 26}
                                                        highlight-current
                                                        class={'monaco-editor-tree monaco-editor-background pt-2'}
                                                        v-slots={{
                                                            default: ({ node, data }) => (
                                                                <>
                                                                    {data.isDir ? (
                                                                        <span class={'tree-node-content'}>
                                                                            {unref(isCreate) == 'dir' &&
                                                                            data.id == 'new-dir' ? (
                                                                                <>
                                                                                    <div class={'tree-node-editing'}>
                                                                                        <SvgIcon
                                                                                            iconName="p-file-folder"
                                                                                            class={'table-icon'}
                                                                                        />
                                                                                        <ElInput
                                                                                            size="small"
                                                                                            ref={rowRefs}
                                                                                            modelValue={unref(
                                                                                                newFolder,
                                                                                            )}
                                                                                            onUpdate:modelValue={(
                                                                                                $v,
                                                                                            ) => {
                                                                                                newFolder.value =
                                                                                                    $v as any;
                                                                                            }}
                                                                                            class={'!min-w-0 !flex-1'}
                                                                                        />
                                                                                        <ElIcon
                                                                                            size="small"
                                                                                            onClick={($event?: any) => {
                                                                                                $event.stopPropagation();
                                                                                                createFolder(true);
                                                                                            }}
                                                                                            class={
                                                                                                'w-4 cursor-pointer pl-1'
                                                                                            }
                                                                                        >
                                                                                            <Check />
                                                                                        </ElIcon>
                                                                                        <ElIcon
                                                                                            size="small"
                                                                                            onClick={($event?: any) => {
                                                                                                $event.stopPropagation();
                                                                                                cancelFolder();
                                                                                            }}
                                                                                            class={'w-4 cursor-pointer'}
                                                                                        >
                                                                                            <Close />
                                                                                        </ElIcon>
                                                                                    </div>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <SvgIcon
                                                                                        iconName="p-file-folder"
                                                                                        class={'table-icon'}
                                                                                    />
                                                                                    <small
                                                                                        title={node.label}
                                                                                        class={'tree-node-label'}
                                                                                    >
                                                                                        {node.label}
                                                                                    </small>
                                                                                </>
                                                                            )}
                                                                        </span>
                                                                    ) : (
                                                                        <span
                                                                            onClick={($event?: any) => {
                                                                                getContent(data.path);
                                                                            }}
                                                                            class={'tree-node-content'}
                                                                        >
                                                                            {unref(isCreate) == 'file' &&
                                                                            data.id == 'new-file' ? (
                                                                                <>
                                                                                    <div class={'tree-node-editing'}>
                                                                                        <SvgIcon
                                                                                            iconName={getIconName(
                                                                                                data.extension,
                                                                                            )}
                                                                                            class={'table-icon'}
                                                                                        />
                                                                                        <ElInput
                                                                                            size="small"
                                                                                            ref={rowRefs}
                                                                                            modelValue={unref(
                                                                                                newFolder,
                                                                                            )}
                                                                                            onUpdate:modelValue={(
                                                                                                $v,
                                                                                            ) => {
                                                                                                newFolder.value =
                                                                                                    $v as any;
                                                                                            }}
                                                                                            class={'!min-w-0 !flex-1'}
                                                                                        />
                                                                                        <ElIcon
                                                                                            size="small"
                                                                                            onClick={($event?: any) => {
                                                                                                $event.stopPropagation();
                                                                                                createFolder(false);
                                                                                            }}
                                                                                            class={
                                                                                                'w-4 cursor-pointer pl-1'
                                                                                            }
                                                                                        >
                                                                                            <Check />
                                                                                        </ElIcon>
                                                                                        <ElIcon
                                                                                            size="small"
                                                                                            onClick={($event?: any) => {
                                                                                                $event.stopPropagation();
                                                                                                cancelFolder();
                                                                                            }}
                                                                                            class={'w-4 cursor-pointer'}
                                                                                        >
                                                                                            <Close />
                                                                                        </ElIcon>
                                                                                    </div>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <SvgIcon
                                                                                        iconName={getIconName(
                                                                                            data.extension,
                                                                                        )}
                                                                                        class={'table-icon'}
                                                                                    />
                                                                                    <small
                                                                                        title={node.label}
                                                                                        class={'tree-node-label'}
                                                                                    >
                                                                                        {node.label}
                                                                                    </small>
                                                                                </>
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                    {unref(isMobile) &&
                                                                    data.id !== 'new-dir' &&
                                                                    data.id !== 'new-file' ? (
                                                                        <span
                                                                            onClick={($event?: any) => {
                                                                                $event.stopPropagation();
                                                                            }}
                                                                            class={'tree-node-mobile-actions'}
                                                                        >
                                                                            <ElDropdown
                                                                                trigger="click"
                                                                                onCommand={($event?: any) => {
                                                                                    (command) =>
                                                                                        handleMobileTreeCommand(
                                                                                            command,
                                                                                            data,
                                                                                            node,
                                                                                        );
                                                                                }}
                                                                                v-slots={{
                                                                                    dropdown: () => (
                                                                                        <>
                                                                                            <ElDropdownMenu>
                                                                                                {data.isDir
                                                                                                    ? withDirectives(
                                                                                                          <FuDropdownItem command="dir">
                                                                                                              <SvgIcon
                                                                                                                  iconName="p-file-folder"
                                                                                                                  class={
                                                                                                                      'tree-context-menu__icon'
                                                                                                                  }
                                                                                                              />
                                                                                                              {$t(
                                                                                                                  'file.dir',
                                                                                                              )}
                                                                                                          </FuDropdownItem>,
                                                                                                          [
                                                                                                              [
                                                                                                                  permissionDirective,
                                                                                                                  true,
                                                                                                              ],
                                                                                                              [
                                                                                                                  nodeAdminDirective,
                                                                                                                  true,
                                                                                                              ],
                                                                                                          ],
                                                                                                      )
                                                                                                    : null}
                                                                                                {data.isDir
                                                                                                    ? withDirectives(
                                                                                                          <FuDropdownItem command="file">
                                                                                                              <SvgIcon
                                                                                                                  iconName="p-file-normal"
                                                                                                                  class={
                                                                                                                      'tree-context-menu__icon'
                                                                                                                  }
                                                                                                              />
                                                                                                              {$t(
                                                                                                                  'menu.files',
                                                                                                              )}
                                                                                                          </FuDropdownItem>,
                                                                                                          [
                                                                                                              [
                                                                                                                  permissionDirective,
                                                                                                                  true,
                                                                                                              ],
                                                                                                              [
                                                                                                                  nodeAdminDirective,
                                                                                                                  true,
                                                                                                              ],
                                                                                                          ],
                                                                                                      )
                                                                                                    : null}
                                                                                                <ElDropdownItem command="copy">
                                                                                                    <ElIcon>
                                                                                                        <CopyDocument />
                                                                                                    </ElIcon>
                                                                                                    {$t('file.copyDir')}
                                                                                                </ElDropdownItem>
                                                                                                {withDirectives(
                                                                                                    <FuDropdownItem command="rename">
                                                                                                        <ElIcon>
                                                                                                            <Edit />
                                                                                                        </ElIcon>
                                                                                                        {$t(
                                                                                                            'file.rename',
                                                                                                        )}
                                                                                                    </FuDropdownItem>,
                                                                                                    [
                                                                                                        [
                                                                                                            permissionDirective,
                                                                                                            true,
                                                                                                        ],
                                                                                                        [
                                                                                                            nodeAdminDirective,
                                                                                                            true,
                                                                                                        ],
                                                                                                    ],
                                                                                                )}
                                                                                                {withDirectives(
                                                                                                    <FuDropdownItem
                                                                                                        command="delete"
                                                                                                        divided
                                                                                                    >
                                                                                                        <ElIcon>
                                                                                                            <Delete />
                                                                                                        </ElIcon>
                                                                                                        {$t(
                                                                                                            'commons.button.delete',
                                                                                                        )}
                                                                                                    </FuDropdownItem>,
                                                                                                    [
                                                                                                        [
                                                                                                            permissionDirective,
                                                                                                            true,
                                                                                                        ],
                                                                                                        [
                                                                                                            nodeAdminDirective,
                                                                                                            true,
                                                                                                        ],
                                                                                                    ],
                                                                                                )}
                                                                                            </ElDropdownMenu>
                                                                                        </>
                                                                                    ),
                                                                                }}
                                                                            >
                                                                                <ElButton
                                                                                    link
                                                                                    aria-label={$t('tabs.more')}
                                                                                    class={'mobile-tree-node-action'}
                                                                                >
                                                                                    <ElIcon>
                                                                                        <MoreFilled />
                                                                                    </ElIcon>
                                                                                </ElButton>
                                                                            </ElDropdown>
                                                                        </span>
                                                                    ) : null}
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    {treeContextMenu.visible ? (
                                                        <div
                                                            onClick={($event?: any) => {
                                                                $event.stopPropagation();
                                                            }}
                                                            onContextmenu={($event?: any) => {
                                                                $event.preventDefault();
                                                            }}
                                                            class={'tree-context-menu'}
                                                            style={{
                                                                left: `${treeContextMenu.x}px`,
                                                                top: `${treeContextMenu.y}px`,
                                                            }}
                                                        >
                                                            {treeContextMenu.data?.isDir
                                                                ? withDirectives(
                                                                      <div
                                                                          onClick={($event?: any) => {
                                                                              createFromContextMenu('dir');
                                                                          }}
                                                                          class={'tree-context-menu__item'}
                                                                      >
                                                                          <SvgIcon
                                                                              iconName="p-file-folder"
                                                                              class={'tree-context-menu__icon'}
                                                                          />
                                                                          <span>{$t('file.dir')}</span>
                                                                      </div>,
                                                                      [
                                                                          [permissionDirective, true],
                                                                          [nodeAdminDirective, true],
                                                                      ],
                                                                  )
                                                                : null}
                                                            {treeContextMenu.data?.isDir
                                                                ? withDirectives(
                                                                      <div
                                                                          onClick={($event?: any) => {
                                                                              createFromContextMenu('file');
                                                                          }}
                                                                          class={'tree-context-menu__item'}
                                                                      >
                                                                          <SvgIcon
                                                                              iconName="p-file-normal"
                                                                              class={'tree-context-menu__icon'}
                                                                          />
                                                                          <span>{$t('menu.files')}</span>
                                                                      </div>,
                                                                      [
                                                                          [permissionDirective, true],
                                                                          [nodeAdminDirective, true],
                                                                      ],
                                                                  )
                                                                : null}
                                                            <div
                                                                onClick={($event?: any) => {
                                                                    (copyPathFromContextMenu as any)($event);
                                                                }}
                                                                class={'tree-context-menu__item'}
                                                            >
                                                                <ElIcon class={'tree-context-menu__icon'}>
                                                                    <CopyDocument />
                                                                </ElIcon>
                                                                <span>{$t('file.copyDir')}</span>
                                                            </div>
                                                            {withDirectives(
                                                                <div
                                                                    onClick={($event?: any) => {
                                                                        (renameFromContextMenu as any)($event);
                                                                    }}
                                                                    class={'tree-context-menu__item'}
                                                                >
                                                                    <ElIcon class={'tree-context-menu__icon'}>
                                                                        <Edit />
                                                                    </ElIcon>
                                                                    <span>{$t('file.rename')}</span>
                                                                </div>,
                                                                [
                                                                    [permissionDirective, true],
                                                                    [nodeAdminDirective, true],
                                                                ],
                                                            )}
                                                            {withDirectives(
                                                                <div
                                                                    onClick={($event?: any) => {
                                                                        (deleteFromContextMenu as any)($event);
                                                                    }}
                                                                    class={'tree-context-menu__item is-danger'}
                                                                >
                                                                    <ElIcon class={'tree-context-menu__icon'}>
                                                                        <Delete />
                                                                    </ElIcon>
                                                                    <span>{$t('commons.button.delete')}</span>
                                                                </div>,
                                                                [
                                                                    [permissionDirective, true],
                                                                    [nodeAdminDirective, true],
                                                                ],
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </ElSplitterPanel>
                                            <ElSplitterPanel
                                                min={unref(isMobile) ? 180 : 240}
                                                class={'code-editor-panel'}
                                            >
                                                <div class={'code-editor-panel__inner relative'}>
                                                    <CodeTabs
                                                        select-tab={unref(selectTab)}
                                                        file-tabs={unref(fileTabs)}
                                                        on-remove-tab={removeTab}
                                                        on-change-tab={changeTab}
                                                        on-remove-all-tab={removeAllTab}
                                                        on-remove-other-tab={removeOtherTab}
                                                        class={'monaco-editor monaco-editor-background'}
                                                    />
                                                    <div ref={codeBox} class={'code-box relative'}>
                                                        {unref(fileTabs).length === 0 ? (
                                                            <div class={'flex h-full items-center justify-center'}>
                                                                <ElEmpty image={noUpdateImage} />
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </ElSplitterPanel>
                                        </ElSplitter>
                                        <div
                                            ref={dialogFooter}
                                            class={
                                                'code-footer hidden h-7 items-center justify-end gap-4 rounded-b pl-4 sm:flex'
                                            }
                                        >
                                            {config.theme ? <ElDivider direction="vertical" class={'!h-6'} /> : null}
                                            <ElDropdown
                                                trigger="click"
                                                max-height="300"
                                                placement="top"
                                                onCommand={($event?: any) => {
                                                    (changeTheme as any)($event);
                                                }}
                                                v-slots={{
                                                    dropdown: () => (
                                                        <>
                                                            <ElDropdownMenu>
                                                                {(themes || []).map((item) => (
                                                                    <ElDropdownItem
                                                                        command={item.value}
                                                                        key={item.label}
                                                                    >
                                                                        <div
                                                                            class={
                                                                                'flex w-full items-center justify-between gap-4'
                                                                            }
                                                                        >
                                                                            {item.label}
                                                                            {config.theme == item.value ? (
                                                                                <ElIcon>
                                                                                    <Check />
                                                                                </ElIcon>
                                                                            ) : null}
                                                                        </div>
                                                                    </ElDropdownItem>
                                                                ))}
                                                            </ElDropdownMenu>
                                                        </>
                                                    ),
                                                }}
                                            >
                                                <span class={'el-dropdown-link'}>
                                                    {themes.find((item) => item.value === config.theme)?.label ||
                                                        $t('file.theme')}
                                                </span>
                                            </ElDropdown>
                                            <ElDivider direction="vertical" class={'!h-6'} />
                                            <ElDropdown
                                                trigger="click"
                                                max-height="300"
                                                placement="top"
                                                onCommand={($event?: any) => {
                                                    (changeEOL as any)($event);
                                                }}
                                                v-slots={{
                                                    dropdown: () => (
                                                        <>
                                                            <ElDropdownMenu>
                                                                {(unref(eols) || []).map((item) => (
                                                                    <ElDropdownItem
                                                                        command={item.value}
                                                                        key={item.label}
                                                                    >
                                                                        <div
                                                                            class={
                                                                                'flex w-full items-center justify-between gap-4'
                                                                            }
                                                                        >
                                                                            {item.label}
                                                                            {config.eol == item.value ? (
                                                                                <ElIcon>
                                                                                    <Check />
                                                                                </ElIcon>
                                                                            ) : null}
                                                                        </div>
                                                                    </ElDropdownItem>
                                                                ))}
                                                            </ElDropdownMenu>
                                                        </>
                                                    ),
                                                }}
                                            >
                                                <span class={'el-dropdown-link'}>
                                                    {unref(eols).find((item) => item.value === config.eol)?.label ||
                                                        $t('file.eol')}
                                                </span>
                                            </ElDropdown>
                                            <ElDivider direction="vertical" class={'!h-6'} />
                                            <ElText
                                                onClick={($event?: any) => {
                                                    (openHistoryDrawer as any)($event);
                                                }}
                                                class={'inline-flex cursor-pointer items-center gap-1'}
                                            >
                                                <span class={'el-dropdown-link'}>
                                                    {$t('file.history')}
                                                    {' ('}
                                                    {unref(historyVersionCount)}
                                                    {')'}
                                                </span>
                                            </ElText>
                                            <ElDivider direction="vertical" class={'!h-6'} />
                                            <ElDropdown
                                                trigger="click"
                                                max-height="300"
                                                placement="top"
                                                onCommand={($event?: any) => {
                                                    (changeLanguage as any)($event);
                                                }}
                                                v-slots={{
                                                    dropdown: () => (
                                                        <>
                                                            <ElDropdownMenu>
                                                                {(Languages || []).map((item) => (
                                                                    <ElDropdownItem
                                                                        command={item.label}
                                                                        key={item.label}
                                                                    >
                                                                        <div
                                                                            class={
                                                                                'flex w-full items-center justify-between gap-4'
                                                                            }
                                                                        >
                                                                            {item.label}
                                                                            {config.language == item.label ? (
                                                                                <ElIcon>
                                                                                    <Check />
                                                                                </ElIcon>
                                                                            ) : null}
                                                                        </div>
                                                                    </ElDropdownItem>
                                                                ))}
                                                            </ElDropdownMenu>
                                                        </>
                                                    ),
                                                }}
                                            >
                                                <span class={'el-dropdown-link'}>
                                                    {config.language
                                                        ? `${$t('file.language')}: ${
                                                              Languages.find((item) => item.label === config.language)
                                                                  ?.label || config.language
                                                          }`
                                                        : $t('file.language')}
                                                </span>
                                            </ElDropdown>
                                            <ElDivider direction="vertical" class={'!h-6'} />
                                            <ElDropdown
                                                trigger="click"
                                                max-height="300"
                                                placement="top"
                                                v-slots={{
                                                    dropdown: () => (
                                                        <>
                                                            <ElDropdownMenu>
                                                                <ElDropdownItem
                                                                    onClick={($event?: any) => {
                                                                        changeWarp('off');
                                                                    }}
                                                                >
                                                                    <div
                                                                        class={
                                                                            'flex w-full items-center justify-between gap-4'
                                                                        }
                                                                    >
                                                                        {$t('commons.button.enable')}
                                                                        {config.wordWrap == 'on' ? (
                                                                            <ElIcon>
                                                                                <Check />
                                                                            </ElIcon>
                                                                        ) : null}
                                                                    </div>
                                                                </ElDropdownItem>
                                                                <ElDropdownItem
                                                                    onClick={($event?: any) => {
                                                                        changeWarp('on');
                                                                    }}
                                                                >
                                                                    <div
                                                                        class={
                                                                            'flex w-full items-center justify-between gap-4'
                                                                        }
                                                                    >
                                                                        {$t('commons.button.disable')}
                                                                        {config.wordWrap == 'off' ? (
                                                                            <ElIcon>
                                                                                <Check />
                                                                            </ElIcon>
                                                                        ) : null}
                                                                    </div>
                                                                </ElDropdownItem>
                                                            </ElDropdownMenu>
                                                        </>
                                                    ),
                                                }}
                                            >
                                                <span class={'el-dropdown-link'}>
                                                    {$t('file.wordWrap') +
                                                        ': ' +
                                                        $t(
                                                            config.wordWrap === 'on'
                                                                ? 'commons.button.enable'
                                                                : 'commons.button.disable',
                                                        )}
                                                </span>
                                            </ElDropdown>
                                            <ElDivider direction="vertical" class={'!h-6'} />
                                            <ElDropdown
                                                trigger="click"
                                                max-height="300"
                                                placement="top"
                                                v-slots={{
                                                    dropdown: () => (
                                                        <>
                                                            <ElDropdownMenu>
                                                                <ElDropdownItem
                                                                    onClick={($event?: any) => {
                                                                        changeMinimap(true);
                                                                    }}
                                                                >
                                                                    <div
                                                                        class={
                                                                            'flex w-full items-center justify-between gap-4'
                                                                        }
                                                                    >
                                                                        {$t('commons.button.enable')}
                                                                        {config.minimap ? (
                                                                            <ElIcon>
                                                                                <Check />
                                                                            </ElIcon>
                                                                        ) : null}
                                                                    </div>
                                                                </ElDropdownItem>
                                                                <ElDropdownItem
                                                                    onClick={($event?: any) => {
                                                                        changeMinimap(false);
                                                                    }}
                                                                >
                                                                    <div
                                                                        class={
                                                                            'flex w-full items-center justify-between gap-4'
                                                                        }
                                                                    >
                                                                        {$t('commons.button.disable')}
                                                                        {!config.minimap ? (
                                                                            <ElIcon>
                                                                                <Check />
                                                                            </ElIcon>
                                                                        ) : null}
                                                                    </div>
                                                                </ElDropdownItem>
                                                            </ElDropdownMenu>
                                                        </>
                                                    ),
                                                }}
                                            >
                                                <span class={'el-dropdown-link'}>
                                                    {$t('file.minimap') +
                                                        ': ' +
                                                        $t(
                                                            config.minimap
                                                                ? 'commons.button.enable'
                                                                : 'commons.button.disable',
                                                        )}
                                                </span>
                                            </ElDropdown>
                                            <ElDivider direction="vertical" class={'!mr-3.5 !h-6'} />
                                        </div>
                                    </div>,
                                    [[vLoading, unref(loading)]],
                                )}
                            </>
                        ),
                    }}
                />
                <FileHistoryDrawer
                    ref={historyDrawerRef}
                    onRestored={($event?: any) => {
                        (handleHistoryRestored as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
