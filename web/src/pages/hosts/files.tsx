import { ArrowDown } from '@element-plus/icons-vue';
import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import { computeSize } from '@/utils/size';
import { copyText } from '@/utils/clipboard';
import { dateFormatSimpleWithSecond } from '@/utils/date';
import { downloadFile, getFileType, getIcon, isConvertible } from '@/utils/file';
import { getRandomStr } from '@/utils/id';
import { File } from '@/types/file';
import { Mimetypes } from '@/global/mimetype';
import { resolveEditorLanguage } from '@/utils/file';
import { MsgSuccess, MsgWarning } from '@/utils/message';
import { useMultipleSearchable } from '@/pages/views/host/file-management/hooks/searchable';
import {
    mergeDirSizeCache,
    sortFilesByDisplaySize,
    updateDirSizeCache,
} from '@/pages/views/host/file-management/size-cache';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { Download as ElDownload, Upload as ElUpload, View, Hide } from '@element-plus/icons-vue';
import i18n from '@/lang';
import CreateFile from '@/pages/views/host/file-management/create/index';
import ChangeRole from '@/pages/views/host/file-management/change-role/index';
import Compress from '@/pages/views/host/file-management/compress/index';
import Decompress from '@/pages/views/host/file-management/decompress/index';
import Upload from '@/pages/views/host/file-management/upload/index';
import FileRename from '@/pages/views/host/file-management/rename/index';
import CodeEditor from '@/pages/views/host/file-management/code-editor/index';
import Wget from '@/pages/views/host/file-management/wget/index';
import Move from '@/pages/views/host/file-management/move/index';
import Download from '@/pages/views/host/file-management/download/index';
import Owner from '@/pages/views/host/file-management/chown/index';
import DeleteFile from '@/pages/views/host/file-management/delete/index';
import Process from '@/pages/views/host/file-management/process/index';
import Detail from '@/pages/views/host/file-management/detail/index';
import RecycleBin from '@/pages/views/host/file-management/recycle-bin/index';
import Favorite from '@/pages/views/host/file-management/favorite/index';
import ShareList from '@/pages/views/host/file-management/share-list/index';
import FileHistoryDrawer from '@/pages/views/host/file-management/code-editor/history/index';
import BatchRole from '@/pages/views/host/file-management/batch-role/index';
import Preview from '@/pages/views/host/file-management/preview/index';
import TextPreview from '@/pages/views/host/file-management/text-preview/index';
import VscodeOpenDialog from '@/components/vscode-open/index';
import Convert from '@/pages/views/host/file-management/convert/index';
import FileAiSearchDrawer from '@/pages/views/host/file-management/ai-search/file-ai-search-drawer';
import FileShare from '@/pages/views/host/file-management/share/index';
import { debounce } from 'lodash-es';
import TerminalDialog from '@/pages/views/host/file-management/terminal/index';
import { Dashboard } from '@/types/dashboard';
import { CompressExtension, MimetypeByExtensionObject } from '@/enums/files';
import { routerToNameWithQuery } from '@/utils/router';
import { rpc } from '@/lib/rpc';
import { toFileListView, type FileListView } from '@/lib/rpc/file';
import { toPlainNumbers } from '@/lib/rpc/dashboard';
import FileList from '@/components/file-list/index';
interface FilePaths {
    url: string;
    name: string;
}
import '@/pages/views/host/file-management/index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import { cn } from '@/utils/cn';
import { HomeFilled } from '@element-plus/icons-vue';
import LayoutContent from '@/components/layout-content/index';
import FuDropdownItem from '@/components/fu/FuDropdownItem';
import SvgIcon from '@/components/svg-icon/svg-icon';
import { FolderOpened } from '@element-plus/icons-vue';
import FuTableColumnSelect from '@/components/table/TableColumnSelect';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';
import { Plus } from '@element-plus/icons-vue';
interface CodemodProps {
    [key: string]: any;
}
const emits = {};
const options = {
    name: 'File',
    props: {},
    emits: emits,
    __scopeId: 'data-v-108d4a5b',
};
export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode, isAdminOrNodeAdmin, isMobile, lastFilePath, openMenuTabs } = useGlobalStore();
        const fileRef = ref();
        const router = useRouter();
        const data = ref();
        const tableRefs = ref<Record<string, any>>({});
        const heightDiff = ref(365);
        const fileTableRef = ref<HTMLElement | null>(null);
        const dropdownMaxHeight = ref(450);
        const baseDir = ref();
        const remarkRequestId = ref(0);
        const remarkLoadTimer = ref<number | null>(null);
        const editableTabsKey = ref('');
        const editableTabs = ref([
            { id: '1', name: getLastPath(baseDir.value), path: baseDir.value },
            { id: '2', name: 'home', path: '/home' },
        ]);
        const setTableRef = (key: string, el: any) => {
            if (el) {
                tableRefs.value[key] = el;
            }
        };
        const getCurrentTable = () => tableRefs.value[editableTabsKey.value];
        let selects = ref<any>([]);
        const initData = () => ({
            path: '/',
            expand: true,
            showHidden: localStorage.getItem('show-hidden') === 'true',
            page: 1,
            pageSize: 100,
            search: '',
            containSub: false,
            sortBy: 'name',
            sortOrder: 'ascending',
        });
        let req = reactive(initData());
        let loading = ref(false);
        const paths = ref<FilePaths[]>([]);
        const breadcrumbVisiblePaths = ref<FilePaths[]>([]);
        const breadcrumbHiddenPaths = ref<FilePaths[]>([]);
        let pathWidth = ref(0);
        const history: string[] = [];
        let pointer = -1;
        const fileCreate = reactive({ path: '/', isDir: false, mode: 0o755, isAppendOnly: false });
        const fileCompress = reactive({ files: [''], name: '', dst: '', operate: 'compress' });
        const fileDeCompress = reactive({ path: '', name: '', dst: '', type: '' });
        const fileEdit = reactive<{
            content: string;
            path: string;
            name: string;
            language: string;
            extension: string;
            initialLine?: number;
        }>({ content: '', path: '', name: '', language: 'plaintext', extension: '' });
        const filePreview = reactive({
            path: '',
            name: '',
            extension: '',
            fileType: '',
            imageFiles: [],
            currentNode: '',
        });
        const fileUpload = reactive({ path: '', isAppendOnly: false });
        const fileRename = reactive({ path: '', oldPath: '', oldName: '', newName: '', tabId: '' });
        const renameSubmitting = ref(false);
        const renameComposing = ref(false);
        const renameFailedName = ref<string | null>(null);
        const renameLeavePending = ref(false);
        const fileWget = reactive({ path: '', isAppendOnly: false });
        const fileMove = reactive({
            oldPaths: [''],
            allNames: [''],
            type: '',
            path: '',
            name: '',
            count: 0,
            isDir: false,
        });
        const fileConvert = reactive<{
            outputPath: string;
            files: File.ConvertFile[];
        }>({
            outputPath: '',
            files: [
                {
                    type: '',
                    inputFile: '',
                    extension: '',
                    path: '',
                    outputFormat: '',
                },
            ],
        });
        const ffmpegExist = ref(false);
        const aiSearchDrawerVisible = ref(false);
        const aiSearchDrawerRef = ref<InstanceType<typeof FileAiSearchDrawer> | null>(null);
        const openAiSearchDrawer = () => {
            aiSearchDrawerVisible.value = true;
        };
        const getSearchPath = (path: string | string[]) => {
            aiSearchDrawerRef.value?.applyPathFromPicker(path);
        };
        const openAiSearchPathPicker = (path?: string) => {
            fileRef.value.acceptParams({ path: path || req.path, dir: true, multiple: false });
        };
        const createRef = ref();
        const roleRef = ref();
        const detailRef = ref();
        const compressRef = ref();
        const deCompressRef = ref();
        const codeEditorRef = ref();
        const renameRef = ref();
        const uploadRef = ref();
        const wgetRef = ref();
        const moveRef = ref();
        const downloadRef = ref();
        const toolRef = ref();
        const breadCrumbRef = ref();
        const chownRef = ref();
        const moveOpen = ref(false);
        const deleteRef = ref();
        const recycleBinRef = ref();
        const favoriteRef = ref();
        const shareListRef = ref();
        const historyDrawerRef = ref<InstanceType<typeof FileHistoryDrawer> | null>(null);
        const hoveredRowPath = ref(null);
        const favorites = ref([]);
        const batchRoleRef = ref();
        const dialogVscodeOpenRef = ref();
        const previewRef = ref();
        const textPreviewRef = ref();
        const processRef = ref();
        const MAX_OPEN_SIZE = 10 * 1024 * 1024;
        const MAX_DIR_SIZE_CONCURRENT = 2;
        const hostMount = ref<Dashboard.DiskInfo[]>([]);
        let resizeObserver: ResizeObserver;
        let lastPathWidth = 0;
        let pathResizeLocked = false;
        let depthSizeToken = 0;
        const dirSizeCache = new Map<string, number>();
        const dirTotalSize = ref(-1);
        const disableBtn = ref(false);
        const calculateBtn = ref(false);
        const dirNum = ref(0);
        const fileNum = ref(0);
        const imageFiles = ref([]);
        const isEdit = ref(false);
        const isDragOver = ref(false);
        const convertRef = ref();
        const fileTaskStatus = reactive<Record<string, string>>({});
        const renameRefs = ref<Record<string, any>>({});
        const setRenameRef = (key: string, el: any) => {
            if (el) {
                renameRefs.value[key] = el;
            }
        };
        const getCurrentRename = () => renameRefs.value[editableTabsKey.value];
        const pathRefs = ref<Record<string, any>>({});
        const columns = ref([]);
        const setPathRef = (key: string, el: any) => {
            if (el) {
                pathRefs.value[key] = el;
            }
        };
        const getCurrentPath = () => pathRefs.value[editableTabsKey.value];
        const { searchableStatus, searchablePath, setSearchableInputRef, searchableInputBlur } =
            useMultipleSearchable(paths);
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 100,
            total: 0,
        });
        useSearchState(
            'host/file-management/index',
            {
                search: toRef(req, 'search'),
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const btnWrapperRefs = ref<Record<string, any>>({});
        const setBtnWrapperRef = (key: string, el: any) => {
            if (el) {
                btnWrapperRefs.value[key] = el;
            }
        };
        const getCurrentBtnWrapper = () => btnWrapperRefs.value[editableTabsKey.value];
        const toolButtons = ref([
            {
                label: 'commons.button.copy',
                action: () => openMove('copy'),
            },
            {
                label: 'file.move',
                action: () => openMove('cut'),
            },
            {
                label: 'file.compress',
                action: () => openCompress(selects.value),
            },
            {
                label: 'file.role',
                action: () => openBatchRole(selects.value),
            },
            {
                label: 'commons.button.delete',
                action: () => batchDelFiles(),
            },
        ]);
        const visibleButtons = ref([...toolButtons.value]);
        const moreButtons = ref([]);
        const isRightToolbarWrapped = ref(false);
        const batchButtonMinWidths = [64, 64, 64, 64, 64];
        const moreButtonWidth = 76;
        const toolbarGap = 8;
        const updateButtons = async () => {
            await nextTick();
            const wrapper = getCurrentBtnWrapper();
            if (!wrapper) {
                return;
            }
            const slotWrapper = wrapper.parentElement as HTMLElement | null;
            const titleRow = slotWrapper?.parentElement as HTMLElement | null;
            const rowWidth = titleRow?.clientWidth || slotWrapper?.clientWidth || wrapper.offsetWidth || 0;
            if (!rowWidth) {
                visibleButtons.value = [...toolButtons.value];
                moreButtons.value = [];
                return;
            }
            const pasteEl = wrapper.querySelector('.copy-button') as HTMLElement | null;
            const leftSibling = slotWrapper?.previousElementSibling as HTMLElement | null;
            const pasteWidth = pasteEl?.offsetWidth || 0;
            const pasteReserve = moveOpen.value ? pasteWidth + toolbarGap : 0;
            const columnSelectWidth = 48;
            const minBatchWidth = moreButtonWidth;
            const sameLineReserve = leftSibling ? leftSibling.offsetWidth + 16 : 0;
            const sameLineAvailable = rowWidth - sameLineReserve - pasteReserve - columnSelectWidth - toolbarGap;
            isRightToolbarWrapped.value = !!leftSibling && sameLineAvailable < minBatchWidth;
            const leftReserve = isRightToolbarWrapped.value ? 0 : sameLineReserve;
            const rightLineWidth = Math.max(0, rowWidth - leftReserve - columnSelectWidth - toolbarGap);
            const availableWidth = Math.max(0, rightLineWidth - pasteReserve);
            let usedWidth = 0;
            let visibleCount = 0;
            for (const buttonWidth of batchButtonMinWidths) {
                const nextUsedWidth = usedWidth + buttonWidth;
                const remainingButtonCount = toolButtons.value.length - visibleCount - 1;
                const reserveMoreWidth = remainingButtonCount > 0 ? moreButtonWidth : 0;
                if (nextUsedWidth + reserveMoreWidth <= availableWidth) {
                    usedWidth = nextUsedWidth;
                    visibleCount++;
                } else {
                    break;
                }
            }
            visibleButtons.value = toolButtons.value.slice(0, visibleCount);
            moreButtons.value = toolButtons.value.slice(visibleCount);
        };
        const search = async () => {
            dirTotalSize.value = -1;
            await getWgetProcess();
            loading.value = true;
            if (req.search != '') {
                req.sortBy = 'name';
                req.sortOrder = 'ascending';
                getCurrentTable().clearSort();
            }
            req.page = paginationConfig.currentPage;
            req.pageSize = paginationConfig.pageSize;
            try {
                const res = await rpc.file.listFiles({
                    path: req.path,
                    search: req.search || '',
                    containSub: req.containSub || false,
                    expand: true,
                    dir: (req as { dir?: boolean }).dir || false,
                    showHidden: req.showHidden || false,
                    page: req.page,
                    pageSize: req.pageSize,
                    sortBy: req.sortBy || '',
                    sortOrder: req.sortOrder || '',
                    isDetail: false,
                });
                handleSearchResult(toFileListView(res));
            } finally {
                loading.value = false;
            }
        };
        const searchFile = async () => {
            loading.value = true;
            dirTotalSize.value = -1;
            try {
                const res = await rpc.file.listFiles({
                    path: req.path,
                    search: req.search || '',
                    containSub: req.containSub || false,
                    expand: true,
                    dir: (req as { dir?: boolean }).dir || false,
                    showHidden: req.showHidden || false,
                    page: req.page,
                    pageSize: req.pageSize,
                    sortBy: req.sortBy || '',
                    sortOrder: req.sortOrder || '',
                    isDetail: false,
                });
                return toFileListView(res);
            } finally {
                loading.value = false;
            }
        };
        const resetDirSizeCache = () => {
            dirSizeCache.clear();
        };
        const handleSearchResult = (res: FileListView) => {
            if (res.path && res.path !== req.path) {
                resetDirSizeCache();
            }
            let items = mergeDirSizeCache(res.items || [], dirSizeCache);
            if (req.sortBy === 'size') {
                items = sortFilesByDisplaySize(items, req.sortOrder);
            }
            data.value = items;
            paginationConfig.total = res.itemTotal;
            dirNum.value = data.value.filter((item) => item.isDir).length;
            fileNum.value = data.value.filter((item) => !item.isDir).length;
            if (res.path) {
                req.path = res.path;
            }
            fileCreate.isAppendOnly = res.isAppendOnly;
            fileUpload.isAppendOnly = res.isAppendOnly;
            fileWget.isAppendOnly = res.isAppendOnly;
            scheduleRemarkLoad();
        };
        const normalizeFilePath = (filePath: string) => {
            if (!filePath) {
                return '/';
            }
            const normalized = `/${filePath.split('/').filter(Boolean).join('/')}`;
            return normalized === '' ? '/' : normalized;
        };
        const findExistingPath = async (filePath: string) => {
            const segments = normalizeFilePath(filePath).split('/').filter(Boolean);
            while (segments.length > 0) {
                const current = `/${segments.join('/')}`;
                try {
                    const res = await rpc.file.checkFile({ path: current, withInit: false });
                    if (res.exists) {
                        return current;
                    }
                } catch {
                    // ignore check errors
                }
                segments.pop();
            }
            return '/';
        };
        const loadInitialExistingPath = async (url: string) => {
            const existingPath = await findExistingPath(url);
            if (existingPath === normalizeFilePath(url)) {
                return;
            }
            const { pageSize: oldPageSize, sortBy: oldSortBy, sortOrder: oldSortOrder, showHidden } = req;
            Object.assign(req, initData(), {
                path: existingPath,
                containSub: false,
                search: '',
                pageSize: oldPageSize,
                sortBy: oldSortBy,
                sortOrder: oldSortOrder,
                showHidden,
            });
            lastFilePath.value = req.path;
            getPaths(req.path);
            updateTab(req.path);
            paths.value = buildPaths(req.path);
            resetPaths();
            MsgWarning(i18n.global.t('commons.res.notFound'));
        };
        const viewHideFile = async () => {
            req.showHidden = !req.showHidden;
            localStorage.setItem('show-hidden', req.showHidden ? 'true' : 'false');
            let searchResult = await searchFile();
            handleSearchResult(searchResult);
        };
        const open = async (row: File.File) => {
            hideRightMenu();
            calculateBtn.value = false;
            disableBtn.value = false;
            if (row.isDir) {
                if (row.name.indexOf('.1panel_clash') > -1) {
                    MsgWarning(i18n.global.t('file.clashOpenAlert'));
                    return;
                }
                const name = row.name;
                if (req.path.endsWith('/')) {
                    req.path = req.path + name;
                } else {
                    req.path = req.path + '/' + name;
                }
                paths.value.push({
                    url: req.path,
                    name: name,
                });
                await jump(req.path);
            } else {
                openView(row);
            }
        };
        const copyDir = (row: File.File) => {
            if (row?.path) {
                copyText(row?.path);
            }
        };
        const formatBreadcrumbName = (path: FilePaths, index: number) => {
            const isLast = index === breadcrumbVisiblePaths.value.length - 1;
            if (isLast || path.name.length <= 25) {
                return path.name;
            }
            return `${path.name.substring(0, 22)}...`;
        };
        const getBreadcrumbElement = () => {
            return (getCurrentPath()?.querySelector('.address-url') as HTMLElement | null) || breadCrumbRef.value;
        };
        const resetPaths = () => {
            breadcrumbVisiblePaths.value = [...paths.value];
            breadcrumbHiddenPaths.value = [];
        };
        const handlePath = async () => {
            resetPaths();
            if (paths.value.length <= 2) {
                return;
            }
            await nextTick();
            const breadcrumbEl = getBreadcrumbElement();
            const pathEl = getCurrentPath();
            const maxWidth = (pathEl?.clientWidth || toolRef.value?.clientWidth || 0) - 24;
            if (!breadcrumbEl || maxWidth <= 0) {
                return;
            }
            let hiddenCount = 0;
            const maxHiddenCount = Math.max(paths.value.length - 2, 0);
            while (hiddenCount < maxHiddenCount && breadcrumbEl.scrollWidth > maxWidth) {
                hiddenCount++;
                breadcrumbHiddenPaths.value = paths.value.slice(1, 1 + hiddenCount);
                breadcrumbVisiblePaths.value = [paths.value[0], ...paths.value.slice(1 + hiddenCount)];
                await nextTick();
            }
        };
        const resizeHandler = debounce(() => {
            const el = getCurrentPath();
            const width = el?.clientWidth || 0;
            // 面包屑测量会改写自身 DOM，必须按宽度变化加锁，避免 ResizeObserver 递归更新。
            if (pathResizeLocked || Math.abs(width - lastPathWidth) <= 2) return;
            lastPathWidth = width;
            pathResizeLocked = true;
            handlePath();
            window.setTimeout(() => {
                pathResizeLocked = false;
            }, 300);
        }, 100);
        const btnResizeHandler = debounce(() => {
            updateButtons();
        }, 100);
        const observeResize = () => {
            const el = getCurrentPath();
            const ele = getCurrentBtnWrapper();
            const titleRow = ele?.parentElement?.parentElement as HTMLElement | null;
            if (!el && !ele && !titleRow) return;
            const observe = new ResizeObserver((entries) => {
                const isElChanged = entries.some((entry) => entry.target === el);
                const isEleChanged = entries.some((entry) => entry.target === ele);
                const isTitleChanged = entries.some((entry) => entry.target === titleRow);
                // 面包屑测量会改写自身 DOM，ResizeObserver 不再触发测量，避免递归更新。
                if (isEleChanged || isTitleChanged) btnResizeHandler();
                updateHeight();
            });
            if (el) observe.observe(el);
            if (ele) observe.observe(ele);
            if (titleRow) observe.observe(titleRow);
            resizeObserver = observe;
        };
        function watchTitleHeight() {
            const el = document.querySelector<HTMLElement>('.content-container__title');
            if (el) {
                let titleHeight = el.offsetHeight < 40 ? 40 : 80;
                heightDiff.value = 325 + titleHeight;
            }
        }
        const right = () => {
            if (pointer < history.length - 1) {
                pointer++;
                let url = history[pointer];
                backForwardJump(url);
            }
        };
        const back = () => {
            if (pointer > 0) {
                pointer--;
                let url = history[pointer];
                backForwardJump(url);
            }
        };
        const top = () => {
            if (paths.value.length > 0) {
                let url = '/';
                if (paths.value.length >= 2) {
                    url = paths.value[paths.value.length - 2].url;
                }
                jump(url);
            }
        };
        const jump = async (url: string) => {
            hideRightMenu();
            history.splice(pointer + 1);
            history.push(url);
            pointer = history.length - 1;
            const { path: oldUrl, pageSize: oldPageSize, sortBy: oldSortBy, sortOrder: oldSortOrder, showHidden } = req;
            if (oldUrl !== url) {
                resetDirSizeCache();
            }
            Object.assign(req, initData(), {
                path: url,
                containSub: false,
                search: '',
                pageSize: oldPageSize,
                sortBy: oldSortBy,
                sortOrder: oldSortOrder,
                showHidden,
            });
            let searchResult = await searchFile();
            if (!searchResult.path) {
                req.path = oldUrl;
                lastFilePath.value = req.path;
                MsgWarning(i18n.global.t('commons.res.notFound'));
                return;
            }
            req.path = searchResult.path;
            lastFilePath.value = req.path;
            handleSearchResult(searchResult);
            getPaths(req.path);
            updateTab(req.path);
            await nextTick(function () {
                handlePath();
            });
        };
        const backForwardJump = async (url: string) => {
            const { pageSize: oldPageSize, sortBy: oldSortBy, sortOrder: oldSortOrder, showHidden } = req;
            if (req.path !== url) {
                resetDirSizeCache();
            }
            Object.assign(req, initData(), {
                path: url,
                containSub: false,
                search: '',
                pageSize: oldPageSize,
                sortBy: oldSortBy,
                sortOrder: oldSortOrder,
                showHidden,
            });
            let searchResult = await searchFile();
            handleSearchResult(searchResult);
            getPaths(req.path);
            updateTab(req.path);
            await nextTick(function () {
                handlePath();
            });
        };
        const getPaths = (reqPath: string | undefined | null) => {
            const pathString = reqPath || '';
            const pathArray = pathString.split('/').filter((p) => p !== '');
            const breadcrumbs = [];
            let base = '';
            for (const p of pathArray) {
                base = `${base}/${p}`;
                breadcrumbs.push({
                    url: base,
                    name: p,
                });
            }
            paths.value = breadcrumbs;
            resetPaths();
        };
        const handleCreate = (command: string) => {
            fileCreate.path = req.path;
            fileCreate.isDir = command === 'dir';
            createRef.value.acceptParams(fileCreate);
        };
        const delFile = async (row: File.File | null) => {
            deleteRef.value.acceptParams([row], currentNode.value);
        };
        const batchDelFiles = () => {
            deleteRef.value.acceptParams(selects.value, currentNode.value);
        };
        const formatFileSize = (size: number) => {
            return computeSize(size);
        };
        const dirSizeQueue: Array<() => Promise<void>> = [];
        const dirSizeLoadingPaths = new Set<string>();
        let activeDirSizeRequests = 0;
        const flushDirSizeQueue = () => {
            while (activeDirSizeRequests < MAX_DIR_SIZE_CONCURRENT && dirSizeQueue.length > 0) {
                const task = dirSizeQueue.shift()!;
                activeDirSizeRequests++;
                task().finally(() => {
                    activeDirSizeRequests--;
                    flushDirSizeQueue();
                });
            }
        };
        const enqueueDirSizeTask = (task: () => Promise<void>) => {
            return new Promise<void>((resolve, reject) => {
                dirSizeQueue.push(async () => {
                    try {
                        await task();
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
                flushDirSizeQueue();
            });
        };
        const getFileSize = async (path: string) => {
            updateByPath(path, { btnLoading: true });
            try {
                const res = await rpc.file.getFile({ path });
                const size = Number(res.size);
                updateDirSizeCache(dirSizeCache, [{ path, size }]);
                updateByPath(path, { dirSize: size });
            } finally {
                updateByPath(path, { btnLoading: false });
            }
        };
        const getDirSize = async (path: string) => {
            if (dirSizeLoadingPaths.has(path)) {
                return;
            }
            dirSizeLoadingPaths.add(path);
            updateByPath(path, { btnLoading: true });
            try {
                await enqueueDirSizeTask(async () => {
                    const res = await rpc.file.getSize({ path });
                    const size = Number(res.size);
                    updateDirSizeCache(dirSizeCache, [{ path, size }]);
                    updateByPath(path, { dirSize: size });
                });
            } finally {
                dirSizeLoadingPaths.delete(path);
                updateByPath(path, { btnLoading: false });
            }
        };
        const updateByPath = (path: string, patch: Partial<(typeof data.value)[0]>) => {
            data.value = data.value.map((item) => (item.path === path ? { ...item, ...patch } : item));
        };
        const getDirTotalSize = async (path: string) => {
            calculateBtn.value = true;
            try {
                const res = await rpc.file.getSize({ path });
                dirTotalSize.value = Number(res.size);
            } finally {
                calculateBtn.value = false;
            }
        };
        const calculateSize = (path: string) => {
            const token = ++depthSizeToken;
            disableBtn.value = true;
            setTimeout(async () => {
                try {
                    const res = await rpc.file.getDepthSize({ path });
                    if (token !== depthSizeToken || req.path !== path) {
                        return;
                    }
                    const items = res.items.map((dir) => ({ path: dir.path, size: Number(dir.size) }));
                    const sizeMap = new Map(items.map((dir) => [dir.path, dir.size]));
                    updateDirSizeCache(dirSizeCache, items);
                    data.value = data.value.map((item) =>
                        sizeMap.has(item.path) ? { ...item, dirSize: sizeMap.get(item.path)! } : item,
                    );
                } catch (err) {
                    console.error('Error computing dir size:', err);
                } finally {
                    if (token === depthSizeToken) {
                        disableBtn.value = false;
                    }
                }
            }, 0);
        };
        const getIconName = (name: string, extension: string) => {
            return getIcon(getFileExtension(name, extension));
        };
        const openMode = (item: File.File) => {
            roleRef.value.acceptParams(item);
        };
        const openChown = (item: File.File) => {
            chownRef.value.acceptParams(item);
        };
        const openCompress = (items: File.File[]) => {
            const paths = [];
            for (const item of items) {
                paths.push(item.path);
            }
            fileCompress.files = paths;
            if (paths.length === 1) {
                fileCompress.name = items[0].name;
            } else {
                fileCompress.name = getRandomStr(6);
            }
            fileCompress.dst = req.path;
            compressRef.value.acceptParams(fileCompress);
        };
        const openDeCompress = (item: File.File) => {
            const extension = getFileExtension(item.name, item.extension);
            const mimeType = item.mimeType || MimetypeByExtensionObject[extension];
            const typeByMime = mimeType ? Mimetypes.get(mimeType) : undefined;
            const typeByExtension = getEnumKeyByValue(extension);
            if (typeByMime && (!typeByExtension || CompressExtension[typeByMime] === extension)) {
                fileDeCompress.type = typeByMime;
            } else if (typeByExtension) {
                fileDeCompress.type = typeByExtension;
            } else {
                MsgWarning(i18n.global.t('file.canNotDeCompress'));
                return;
            }
            fileDeCompress.name = item.name;
            fileDeCompress.path = item.path;
            fileDeCompress.dst = req.path;
            deCompressRef.value.acceptParams(fileDeCompress);
        };
        function getEnumKeyByValue(value: string): keyof typeof CompressExtension | undefined {
            const normalizedValue = value.toLowerCase();
            return (Object.keys(CompressExtension) as Array<keyof typeof CompressExtension>).find(
                (k) => CompressExtension[k] === normalizedValue,
            );
        }
        const sortedCompressExtensions = Object.values(CompressExtension).sort((a, b) => b.length - a.length);
        const getFileExtension = (name: string, extension?: string): string => {
            const lowerName = name?.toLowerCase().split('?')[0] ?? '';
            if (lowerName.startsWith('.') && lowerName.indexOf('.', 1) === -1) {
                return extension.toLowerCase();
            }
            const compoundMatch = sortedCompressExtensions.find((compressExtension) =>
                lowerName.endsWith(compressExtension),
            );
            if (compoundMatch) {
                return compoundMatch;
            }
            if (extension) {
                const lowerExt = extension.toLowerCase();
                return lowerExt.startsWith('.') ? lowerExt : `.${lowerExt}`;
            }
            const extensionIndex = lowerName.lastIndexOf('.');
            return extensionIndex === -1 ? '' : lowerName.slice(extensionIndex);
        };
        const openView = (item: File.File) => {
            const fileType = getFileType(item.extension);
            if (fileType == 'pdf') {
                MsgWarning(i18n.global.t('file.fileCanNotRead'));
                return;
            }
            if (fileType === 'image') {
                imageFiles.value = data.value
                    .filter((item) => !item.isDir)
                    .filter((item) => getFileType(item.extension) == 'image')
                    .map((item) => (item.isSymlink ? item.linkPath : item.path));
            }
            const previewTypes = ['image', 'video', 'audio', 'word', 'excel'];
            if (previewTypes.includes(fileType)) {
                return openPreview(item, fileType);
            }
            if (fileType === 'compress') {
                return openDeCompress(item);
            }
            const path = item.isSymlink ? item.linkPath : item.path;
            if (item.size > MAX_OPEN_SIZE) {
                return openTextPreview(path, item.name);
            }
            const actionMap = {
                text: () => openCodeEditor(path),
            };
            return actionMap[fileType] ? actionMap[fileType](item) : openCodeEditor(path);
        };
        const openPreview = (item: File.File, fileType: string) => {
            if (item.mode.toString() == '-' && item.user == '-' && item.group == '-') {
                MsgWarning(i18n.global.t('file.fileCanNotRead'));
                return;
            }
            filePreview.path = item.isSymlink ? item.linkPath : item.path;
            filePreview.name = item.name;
            filePreview.extension = item.extension;
            filePreview.fileType = fileType;
            filePreview.imageFiles = imageFiles.value;
            filePreview.currentNode = currentNode.value;
            previewRef.value.acceptParams(filePreview);
        };
        const openPathInCodeEditor = (
            path: string,
            opts?: {
                initialLine?: number;
            },
        ) => {
            if (!path) {
                return;
            }
            const line = opts?.initialLine && opts.initialLine > 0 ? Math.floor(opts.initialLine) : undefined;
            rpc.file
                .getFile({ path })
                .then((res) => {
                    fileEdit.content = res.content;
                    fileEdit.path = res.path;
                    fileEdit.name = res.name;
                    fileEdit.extension = res.extension;
                    fileEdit.language = resolveEditorLanguage(res.path, res.extension, res.name);
                    fileEdit.initialLine = line;
                    codeEditorRef.value.acceptParams(fileEdit);
                    fileEdit.initialLine = undefined;
                })
                .catch(() => {});
        };
        const onAiSearchOpenEditor = (payload: { path: string; initialLine?: number }) => {
            openPathInCodeEditor(payload.path, { initialLine: payload.initialLine });
        };
        const openCodeEditor = (path: string) => {
            openPathInCodeEditor(path);
        };
        const openTextPreview = (path: string, name: string) => {
            textPreviewRef.value.acceptParams({ path, name });
        };
        const openUpload = () => {
            fileUpload.path = req.path;
            uploadRef.value.acceptParams(fileUpload);
        };
        const openWget = () => {
            fileWget.path = req.path;
            wgetRef.value.acceptParams(fileWget);
        };
        const openBatchRole = (items: File.File[]) => {
            batchRoleRef.value.acceptParams({ files: items });
        };
        const closeWget = (submit: boolean) => {
            search();
            if (submit) {
                openProcess();
            }
        };
        const closeMovePage = (submit: boolean) => {
            if (submit) {
                search();
                closeMove();
            }
        };
        const openProcess = () => {
            processRef.value.acceptParams();
        };
        const closeProcess = () => {
            search();
            getWgetProcess();
            setTimeout(() => {
                getWgetProcess();
            }, 1000);
        };
        const processCount = ref(0);
        const getWgetProcess = async () => {
            processCount.value = 0;
            try {
                const res = await rpc.file.getWgetProcessKeys({});
                if (res.keys.length > 0) {
                    processCount.value = res.keys.length;
                }
            } catch (error) {}
        };
        const openRename = (item: File.File, source: string) => {
            if (renameSubmitting.value) return;
            fileRename.path = item.path.substring(0, item.path.lastIndexOf('/')) || '/';
            fileRename.oldPath = item.path;
            fileRename.oldName = item.path.substring(item.path.lastIndexOf('/') + 1);
            fileRename.newName = fileRename.oldName;
            fileRename.tabId = editableTabsKey.value;
            renameComposing.value = false;
            renameFailedName.value = null;
            renameLeavePending.value = false;
            if (source === 'right') {
                isEdit.value = true;
                nextTick(() => {
                    getCurrentRename()?.focus();
                });
                hideRightMenu();
            } else {
                isEdit.value = false;
                renameRef.value.acceptParams(fileRename);
            }
        };
        const isCurrentRename = (row: File.File) =>
            isEdit.value && fileRename.oldPath === row.path && fileRename.tabId === editableTabsKey.value;
        const onRenameEnter = (event: KeyboardEvent, row: File.File) => {
            if (event.isComposing || event.keyCode === 229 || renameComposing.value || event.repeat) return;
            event.preventDefault();
            return handleRename(row);
        };
        const onRenameCompositionEnd = (event: CompositionEvent, row: File.File) => {
            if (!isCurrentRename(row)) return;
            fileRename.newName = (event.target as HTMLInputElement).value.trim();
            renameComposing.value = false;
            if (renameLeavePending.value) {
                renameLeavePending.value = false;
                return onRenameLeave(row);
            }
        };
        const cancelRename = (row: File.File) => {
            if (!isEdit.value || renameSubmitting.value || fileRename.oldPath !== row.path) return;
            isEdit.value = false;
            fileRename.newName = fileRename.oldName;
            renameComposing.value = false;
            renameFailedName.value = null;
            renameLeavePending.value = false;
        };
        const onRenameEscape = (event: KeyboardEvent, row: File.File) => {
            if (event.isComposing || event.keyCode === 229 || renameComposing.value) return;
            event.preventDefault();
            event.stopPropagation();
            cancelRename(row);
        };
        const onRenameLeave = async (row: File.File) => {
            if (!isCurrentRename(row) || renameSubmitting.value) return;
            if (renameComposing.value) {
                renameLeavePending.value = true;
                return;
            }
            await nextTick();
            if (!isCurrentRename(row) || renameSubmitting.value || renameComposing.value) return;
            // Keep failed-name state after the toast disappears; leaving must not retry it.
            if (renameFailedName.value === fileRename.newName.trim()) {
                cancelRename(row);
                return;
            }
            return handleRename(row);
        };
        const handleRename = async (row: File.File): Promise<void> => {
            if (!isCurrentRename(row) || renameSubmitting.value || renameComposing.value) return;
            const newName = fileRename.newName.trim();
            if (!newName) {
                renameFailedName.value = newName;
                MsgWarning(i18n.global.t('commons.rule.requiredInput'));
                return;
            }
            if (newName === fileRename.oldName) {
                cancelRename(row);
                return;
            }
            const addItem: File.FileRename = {
                oldName: fileRename.oldPath,
                newName: getPath(fileRename.path, newName),
            };
            const namePrefix = row.name.substring(0, row.name.lastIndexOf('/') + 1);
            renameSubmitting.value = true;
            try {
                await rpc.file.changeName(addItem);
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                isEdit.value = false;
                fileRename.oldName = '';
                renameFailedName.value = null;
                row.name = namePrefix + newName;
                row.path = addItem.newName;
            } catch (error) {
                renameFailedName.value = newName;
                console.error(error);
            } finally {
                renameSubmitting.value = false;
            }
        };
        const getPath = (path: string, name: string) => {
            return path === '/' ? path + name : path + '/' + name;
        };
        const openMove = (type: string) => {
            fileMove.type = type;
            fileMove.name = '';
            fileMove.allNames = [];
            fileMove.isDir = false;
            const oldPaths = [];
            for (const s of selects.value) {
                oldPaths.push(s['path']);
            }
            fileMove.count = selects.value.length;
            fileMove.oldPaths = oldPaths;
            if (selects.value.length == 1) {
                fileMove.name = selects.value[0].name;
                fileMove.isDir = selects.value[0].isDir;
            } else {
                const allNames = [];
                for (const s of selects.value) {
                    allNames.push(s['name']);
                }
                fileMove.allNames = allNames;
            }
            moveOpen.value = true;
            if (type === 'cut') {
                MsgSuccess(i18n.global.t('file.moveSuccess') + '! ' + i18n.global.t('file.pasteMsg'));
            } else {
                MsgSuccess(i18n.global.t('file.copySuccess') + '! ' + i18n.global.t('file.pasteMsg'));
            }
            updateButtons();
        };
        const openMoveBtn = (type: string, item: File.File) => {
            selects.value = [];
            selects.value.push(item);
            openMove(type);
        };
        const closeMove = () => {
            selects.value = [];
            getCurrentTable().clearSelects();
            hideRightMenu();
            fileMove.oldPaths = [];
            fileMove.name = '';
            fileMove.count = 0;
            fileMove.isDir = false;
            moveOpen.value = false;
            updateButtons();
        };
        const openPaste = () => {
            fileMove.path = req.path;
            moveRef.value.acceptParams(fileMove);
        };
        function onLoading(isLoading: boolean) {
            loading.value = isLoading;
        }
        const openDownload = (file: File.File) => {
            downloadFile(file.path, currentNode.value);
        };
        const fileShareRef = ref<InstanceType<typeof FileShare> | null>(null);
        const openShareFile = (row: File.File) => {
            fileShareRef.value?.acceptParams({ path: row.path });
        };
        const openShareDetail = (path: string) => {
            fileShareRef.value?.acceptParams({ path });
        };
        const openDetail = (row: File.File) => {
            detailRef.value.acceptParams({ path: row.path });
        };
        const openRecycleBin = () => {
            recycleBinRef.value.acceptParams();
        };
        const openFavorite = () => {
            favoriteRef.value.acceptParams();
        };
        const openShareList = () => {
            shareListRef.value.acceptParams();
        };
        const openFileHistoryCenter = () => {
            historyDrawerRef.value?.acceptParams({
                path: '',
                content: '',
                language: 'plaintext',
                extension: '',
                dirty: false,
                scope: 'all',
            });
        };
        const handleFileTaskChange = (type: string, payload: { taskID: string; status: string }) => {
            if (!payload.taskID) {
                return;
            }
            const taskKey = `${type}:${payload.taskID}`;
            const previous = fileTaskStatus[taskKey];
            fileTaskStatus[taskKey] = payload.status;
            if (previous === 'Executing' && payload.status === 'Success') {
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            }
            if (payload.status && payload.status !== 'Executing') {
                delete fileTaskStatus[taskKey];
            }
        };
        const changeSort = ({ prop, order }) => {
            req.sortBy = prop;
            req.sortOrder = order;
            req.search = '';
            req.page = 1;
            req.pageSize = paginationConfig.pageSize;
            req.containSub = false;
            search();
        };
        const showFavorite = (row: File.File) => {
            hoveredRowPath.value = row.path;
        };
        const hideFavorite = () => {
            hoveredRowPath.value = null;
        };
        const addToFavorite = async (row: File.File) => {
            try {
                await rpc.file.addFavorite({ path: row.path });
                await search();
            } catch (error) {}
        };
        const remove = async (id: number) => {
            ElMessageBox.confirm(i18n.global.t('file.removeFavorite'), i18n.global.t('commons.msg.remove'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                try {
                    await rpc.file.deleteFavorite({ id });
                    await search();
                } catch (error) {}
            });
        };
        const getFavorites = async () => {
            try {
                const res = await rpc.file.searchFavorites(req);
                favorites.value = res.items;
            } catch (error) {}
        };
        const removeShareByPath = async (path: string) => {
            ElMessageBox.confirm(i18n.global.t('file.shareCancelConfirm'), i18n.global.t('commons.msg.remove'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                try {
                    await rpc.file.deleteShare({ path });
                    await search();
                } catch (error) {}
            });
        };
        const toFavorite = (row: File.Favorite) => {
            if (row.isDir) {
                jump(row.path);
            } else {
                let file = {} as File.File;
                const extension = getFileExtension(row.name);
                file.path = row.path;
                file.name = row.name;
                file.extension = extension;
                file.mimeType = MimetypeByExtensionObject[extension] || '';
                openView(file);
            }
        };
        const dialogTerminalRef = ref();
        const toTerminal = () => {
            dialogTerminalRef.value!.acceptParams({ cwd: req.path, command: '/bin/sh' });
        };
        const openWithVSCode = (row: File.File) => {
            dialogVscodeOpenRef.value.acceptParams({ path: row.path + (row.isDir ? '' : ':1:1') });
        };
        const openRemark = async (row: File.File) => {
            try {
                const res = await ElMessageBox.prompt(
                    i18n.global.t('file.remarkPrompt'),
                    i18n.global.t('file.setRemark'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        inputValue: row.remark ?? '',
                        inputPlaceholder: i18n.global.t('file.remarkPlaceholder'),
                    },
                );
                const remark = res.value ?? '';
                await rpc.file.setRemark({ path: row.path, remark: remark });
                row.remark = remark;
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            } catch (error) {
                return;
            }
        };
        const beforeButtons = [
            {
                label: i18n.global.t('commons.button.open'),
                click: open,
                show: (row: File.File) => {
                    return row?.isDir || row?.size <= MAX_OPEN_SIZE || isDecompressFile(row);
                },
            },
            {
                label: i18n.global.t('file.previewLargeFile'),
                click: (row: File.File) => {
                    const path = row.isSymlink ? row.linkPath : row.path;
                    openTextPreview(path, row.name);
                },
                show: (row: File.File) => {
                    return !row?.isDir && row?.size > MAX_OPEN_SIZE && !isDecompressFile(row);
                },
            },
            {
                label: i18n.global.t('commons.button.download'),
                click: (row: File.File) => {
                    openDownload(row);
                },
                disabled: (row: File.File) => {
                    return row?.isDir;
                },
            },
            {
                label: i18n.global.t('commons.button.copy'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => openMoveBtn('copy', row),
            },
            {
                label: i18n.global.t('file.move'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => openMoveBtn('cut', row),
            },
            {
                label: i18n.global.t('file.paste'),
                permission: true,
                nodeAdmin: true,
                click: openPaste,
                disabled: () => {
                    return !moveOpen.value;
                },
            },
            {
                label: i18n.global.t('file.compress'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => {
                    openCompress([row]);
                },
            },
            {
                label: i18n.global.t('file.deCompress'),
                click: openDeCompress,
                disabled: (row: File.File) => {
                    return !isDecompressFile(row);
                },
            },
            {
                label: i18n.global.t('file.editPermissions'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => {
                    openBatchRole([row]);
                },
            },
            {
                label: i18n.global.t('file.setRemark'),
                hideOnRemarkBlackList: true,
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => {
                    openRemark(row);
                },
            },
        ];
        const afterButtons = [
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                nodeAdmin: true,
                disabled: (row: File.File) => {
                    return row.name == '.1panel_clash';
                },
                click: delFile,
                divided: true,
            },
            {
                label: i18n.global.t('file.copyDir'),
                click: copyDir,
            },
            {
                label: i18n.global.t('file.addFavoriteAction'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => {
                    addToFavorite(row);
                },
                show: (row: File.File) => row?.favoriteId === 0,
            },
            {
                label: i18n.global.t('file.removeFavoriteAction'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => {
                    remove(row?.favoriteId);
                },
                show: (row: File.File) => row?.favoriteId > 0,
            },
            {
                label: i18n.global.t('file.shareFile'),
                permission: true,
                nodeAdmin: true,
                click: openShareFile,
                show: (row: File.File) => {
                    return !row?.isDir && !row?.shareCode;
                },
            },
            {
                label: i18n.global.t('file.shareCancel'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => {
                    removeShareByPath(row.path);
                },
                show: (row: File.File) => {
                    return !row?.isDir && !!row?.shareCode;
                },
            },
            {
                label: i18n.global.t('file.convert'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => {
                    openConvert(row);
                },
                disabled: (row: File.File) => {
                    return row?.isDir || !isConvertible(row?.extension, row?.mimeType);
                },
            },
            {
                label: i18n.global.t('file.openWithVscode'),
                click: openWithVSCode,
            },
            {
                label: i18n.global.t('file.info'),
                click: openDetail,
                divided: true,
            },
        ];
        const rightBtnRename = [
            {
                label: i18n.global.t('file.rename'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => {
                    openRename(row, 'right');
                },
            },
        ];
        const moreBtnRename = [
            {
                label: i18n.global.t('file.rename'),
                permission: true,
                nodeAdmin: true,
                click: (row: File.File) => {
                    openRename(row, 'more');
                },
            },
        ];
        const filterRemarkButtons = (buttons: any[]) => {
            if (!isInRemarkBlackList(req.path)) {
                return buttons;
            }
            return buttons.filter((btn) => !btn.hideOnRemarkBlackList);
        };
        const rightButtons = computed(() =>
            filterRemarkButtons([...beforeButtons, ...rightBtnRename, ...afterButtons]),
        );
        const tableMoreButtons = computed(() =>
            filterRemarkButtons([...beforeButtons, ...moreBtnRename, ...afterButtons]),
        );
        const openConvert = (item: File.File) => {
            if (!ffmpegExist.value) {
                ElMessageBox.confirm(
                    i18n.global.t('cronjob.library.noSuchApp', ['FFmpeg']),
                    i18n.global.t('file.convert'),
                    {
                        confirmButtonText: i18n.global.t('app.toInstall'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                    },
                ).then(() => {
                    routerToNameWithQuery('Library', { t: Date.now(), uncached: 'true' });
                });
                return;
            } else {
                if (!isConvertible(item.extension, item.mimeType)) {
                    MsgWarning(i18n.global.t('file.fileCanNotConvert'));
                    return;
                }
                const fileType = getFileType(item.extension);
                fileConvert.outputPath = req.path;
                fileConvert.files = [
                    {
                        type: fileType,
                        path: req.path,
                        extension: item.extension,
                        inputFile: item.name,
                        outputFormat: item.extension.slice(1),
                    },
                ];
                convertRef.value.acceptParams(fileConvert);
            }
        };
        const isDecompressFile = (row: File.File) => {
            if (row.isDir) {
                return false;
            }
            const extension = getFileExtension(row.name, row.extension);
            const mimeType = row.mimeType || MimetypeByExtensionObject[extension];
            if (getFileType(extension) === 'compress') {
                return true;
            }
            if (!mimeType || mimeType === 'application/octet-stream') {
                return false;
            }
            return Mimetypes.get(mimeType) != undefined;
        };
        const getHostMount = async () => {
            try {
                const res = await rpc.file.listMounts({});
                hostMount.value = toPlainNumbers(res.items);
            } catch (error) {
                console.error('Error fetching host mount:', error);
            }
        };
        const handleDrop = async (event: DragEvent) => {
            event.preventDefault();
            isDragOver.value = false;
            fileUpload.path = req.path;
            if (!uploadRef.value?.open) {
                await uploadRef.value?.handleDrop(event);
            }
            uploadRef.value.acceptParams(fileUpload);
        };
        const handleDragover = (event: DragEvent) => {
            event.preventDefault();
            isDragOver.value = true;
        };
        const handleDragleave = (event: { preventDefault: () => void }) => {
            event.preventDefault();
            isDragOver.value = false;
        };
        function hideRightMenu() {
            getCurrentTable().closeRightClick();
        }
        function initShowHidden() {
            const showHidden = localStorage.getItem('show-hidden');
            if (showHidden === null) {
                localStorage.setItem('show-hidden', 'true');
                req.showHidden = true;
            } else {
                req.showHidden = showHidden === 'true';
            }
        }
        const remarkBlackList = ['/proc', '/sys', '/dev', '/run'];
        const scheduleRemarkLoad = () => {
            if (remarkLoadTimer.value) {
                window.clearTimeout(remarkLoadTimer.value);
            }
            if (isInRemarkBlackList(req.path)) {
                return;
            }
            remarkLoadTimer.value = window.setTimeout(() => {
                void loadRemarksForCurrentPage();
            }, 1000);
        };
        const isInRemarkBlackList = (path: string) => {
            return remarkBlackList.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
        };
        const loadRemarksForCurrentPage = async () => {
            if (!Array.isArray(data.value) || data.value.length === 0) return;
            const paths = data.value.map((item) => item.path).filter(Boolean);
            if (paths.length === 0) return;
            const currentId = ++remarkRequestId.value;
            try {
                const res = await rpc.file.getRemarks({ paths });
                if (currentId !== remarkRequestId.value) return;
                const remarks = res.remarks || {};
                data.value.forEach((item) => {
                    const remark = remarks[item.path];
                    if (remark !== undefined && remark !== '') {
                        item.remark = remark;
                    }
                });
            } catch (error) {
                if (currentId !== remarkRequestId.value) return;
            }
        };
        function initTabsAndPaths() {
            initTabs();
            let path = getInitialPath();
            req.path = path;
            getPaths(path);
            updateTab(path);
            paths.value = buildPaths(path);
            resetPaths();
            pathWidth.value = getCurrentPath()?.offsetWidth;
        }
        function buildPaths(path: string) {
            return path
                .split('/')
                .filter(Boolean)
                .reduce((accumulator, segment) => {
                    const lastPath = accumulator[accumulator.length - 1];
                    const currentUrl = lastPath ? `${lastPath.url}/${segment}` : `/${segment}`;
                    accumulator.push({
                        url: currentUrl,
                        name: segment,
                    });
                    return accumulator;
                }, []);
        }
        async function initHistory() {
            await loadInitialExistingPath(req.path);
            await search();
            history.push(req.path);
            pointer = history.length - 1;
        }
        function getInitialPath(): string {
            const routePath = router.currentRoute.value.query.path;
            if (routePath && typeof routePath === 'string') {
                const p = routePath.trim();
                if (p !== '') {
                    lastFilePath.value = p;
                    return p;
                }
            }
            const tab = editableTabs.value.find((t) => t.id === editableTabsKey.value);
            if (tab && typeof tab.path === 'string' && tab.path.trim() !== '') {
                const p = tab.path.trim();
                lastFilePath.value = p;
                return p;
            }
            if (typeof lastFilePath.value === 'string' && lastFilePath.value.trim() !== '') {
                return lastFilePath.value;
            }
            return '/';
        }
        function initTabs() {
            const savedTabs = localStorage.getItem('editableTabs');
            if (savedTabs) {
                editableTabs.value = JSON.parse(savedTabs);
            }
            const savedTabsKey = localStorage.getItem('editableTabsKey');
            if (savedTabsKey) {
                editableTabsKey.value = savedTabsKey;
            } else {
                setFirstTab();
            }
        }
        function setFirstTab() {
            if (editableTabs.value.length > 0) {
                const first = editableTabs.value[0];
                editableTabsKey.value = first.id;
            } else {
                initTabs();
            }
        }
        function saveStorageTabs() {
            localStorage.setItem('editableTabs', JSON.stringify(editableTabs.value));
        }
        function saveStorageTabsKey() {
            localStorage.setItem('editableTabsKey', editableTabsKey.value);
        }
        function getLastPath(path: string): string {
            if (!path) return '';
            const parts = path.split('/').filter(Boolean);
            return parts.length ? parts[parts.length - 1] : '';
        }
        function updateTab(newPath?: string) {
            editableTabs.value = editableTabs.value.map((tab) => {
                if (tab.id === editableTabsKey.value) {
                    return {
                        ...tab,
                        path: newPath,
                        name: getLastPath(newPath),
                    };
                }
                return tab;
            });
            saveStorageTabs();
        }
        const loadPath = async () => {
            const pathRes = await rpc.agentSetting.getBaseDir({});
            baseDir.value = pathRes.path;
        };
        const addTab = () => {
            if (editableTabs.value.length >= 6) {
                MsgWarning(i18n.global.t('file.notCanTab'));
                return;
            }
            const usedIds = new Set(editableTabs.value.map((t) => Number(t.id)));
            const newId = Array.from({ length: 6 }, (_, i) => i + 1).find((id) => !usedIds.has(id));
            if (!newId) {
                MsgWarning(i18n.global.t('file.notCanTab'));
                return;
            }
            editableTabs.value.push({
                id: String(newId),
                name: getLastPath(baseDir.value),
                path: baseDir.value,
            });
            editableTabsKey.value = String(newId);
            changeTab(newId);
        };
        const changeTab = (targetPath: TabPaneName) => {
            if (targetPath === 99) {
                return;
            }
            const current = editableTabs.value.find((tab) => tab.id === targetPath.toString());
            editableTabsKey.value = current.id;
            saveStorageTabs();
            saveStorageTabsKey();
            if (req.path !== current?.path) {
                resetDirSizeCache();
            }
            req.path = current ? current.path : '';
            lastFilePath.value = req.path;
            getPaths(req.path);
            search();
        };
        const removeTab = (targetId: TabPaneName) => {
            const tabs = editableTabs.value;
            if (tabs.length <= 1) {
                MsgWarning(i18n.global.t('file.keepOneTab'));
                return;
            }
            const target = String(targetId);
            const current = String(editableTabsKey.value);
            const idx = tabs.findIndex((t) => String(t.id) === target);
            if (idx === -1) return;
            let nextActive = current;
            if (current === target) {
                nextActive = tabs[idx + 1]?.id ?? tabs[idx - 1]?.id ?? current;
            }
            editableTabs.value = tabs.filter((t) => String(t.id) !== target);
            editableTabsKey.value = String(nextActive);
            changeTab(nextActive);
        };
        const checkFFmpeg = () => {
            rpc.host.checkComponent({ name: 'ffmpeg' }).then((res) => {
                ffmpegExist.value = res.exists ?? false;
            });
        };
        const updateHeight = () => {
            const el = fileTableRef.value;
            if (!el) return;
            let tabHeight = openMenuTabs.value ? 40 : -4;
            const half = (el.offsetHeight + tabHeight) / 2;
            dropdownMaxHeight.value = Math.max(half, 300);
        };
        onMounted(async () => {
            await loadPath();
            await nextTick();
            watchTitleHeight();
            window.addEventListener('resize', watchTitleHeight);
            updateHeight();
            window.addEventListener('resize', updateHeight);
            initShowHidden();
            initTabsAndPaths();
            await getHostMount();
            await initHistory();
            checkFFmpeg();
            await nextTick(function () {
                handlePath();
                observeResize();
            });
        });
        onBeforeUnmount(() => {
            if (resizeObserver) resizeObserver.disconnect();
            window.removeEventListener('resize', watchTitleHeight);
            window.removeEventListener('resize', updateHeight);
            if (remarkLoadTimer.value) {
                window.clearTimeout(remarkLoadTimer.value);
            }
        });
        return () => (
            <div
                ref={fileTableRef}
                onDragover={($event?: any) => {
                    (handleDragover as any)($event);
                }}
                onDrop={($event?: any) => {
                    (handleDrop as any)($event);
                }}
                onDragleave={($event?: any) => {
                    (handleDragleave as any)($event);
                }}
                class={cn('file-management-page h-full', { 'is-drag-over': unref(isDragOver) })}
            >
                <ElTabs
                    type="card"
                    modelValue={unref(editableTabsKey)}
                    onUpdate:modelValue={($v) => {
                        editableTabsKey.value = $v as any;
                    }}
                    onTabChange={($event?: any) => {
                        (changeTab as any)($event);
                    }}
                    onTabRemove={($event?: any) => {
                        (removeTab as any)($event);
                    }}
                    class={'file-tabs'}
                >
                    {(unref(editableTabs) || []).map((item) => (
                        <ElTabPane
                            closable
                            label={item.name == '' ? $t('file.root') : item.name}
                            name={item.id}
                            key={item.id}
                        >
                            <div ref={toolRef} class={'flex flex-wrap items-center gap-3 pt-0.5 pb-3'}>
                                <div class={'file-navigation__actions flex shrink-0 items-center gap-1.5'}>
                                    <ElTooltip content={$t('file.back')} placement="top">
                                        <ElButton
                                            icon="Back"
                                            onClick={($event?: any) => {
                                                (back as any)($event);
                                            }}
                                            circle
                                        />
                                    </ElTooltip>
                                    <ElTooltip content={$t('file.right')} placement="top">
                                        <ElButton
                                            icon="Right"
                                            onClick={($event?: any) => {
                                                (right as any)($event);
                                            }}
                                            circle
                                        />
                                    </ElTooltip>
                                    <ElTooltip content={$t('file.top')} placement="top">
                                        <ElButton
                                            icon="Top"
                                            onClick={($event?: any) => {
                                                (top as any)($event);
                                            }}
                                            circle
                                            disabled={unref(paths).length == 0}
                                        />
                                    </ElTooltip>
                                    <ElTooltip content={$t('commons.button.refresh')} placement="top">
                                        <ElButton
                                            icon="Refresh"
                                            circle
                                            onClick={($event?: any) => {
                                                (search as any)($event);
                                            }}
                                        />
                                    </ElTooltip>
                                    <ElTooltip
                                        content={req.showHidden ? $t('file.noShowHide') : $t('file.showHide')}
                                        placement="top"
                                    >
                                        <ElButton
                                            circle
                                            type={req.showHidden ? '' : 'primary'}
                                            icon={req.showHidden ? View : Hide}
                                            onClick={($event?: any) => {
                                                (viewHideFile as any)($event);
                                            }}
                                            class={'btn'}
                                        />
                                    </ElTooltip>
                                </div>
                                <div ref={(el) => setPathRef(item.id, el)} class={'hidden min-w-0 flex-1 sm:block'}>
                                    <div
                                        onClick={($event?: any) => {
                                            searchableStatus.value = true;
                                        }}
                                        class={'address-bar'}
                                        style={[{}, { display: !unref(searchableStatus) ? '' : 'none' }]}
                                    >
                                        <div ref={breadCrumbRef} class={'address-url flex items-center'}>
                                            <span class={'breadcrumb-root'}>
                                                <ElLink
                                                    onClick={($event?: any) => {
                                                        $event.stopPropagation();
                                                        jump('/');
                                                    }}
                                                >
                                                    <ElIcon size={20}>
                                                        <HomeFilled />
                                                    </ElIcon>
                                                </ElLink>
                                            </span>
                                            {(unref(breadcrumbVisiblePaths) || []).map((path, index) => (
                                                <span
                                                    class={'breadcrumb-item inline-flex min-w-0 items-center'}
                                                    key={path.url}
                                                >
                                                    <span class={'arrow'}>{'>'}</span>
                                                    {index === 1 && unref(breadcrumbHiddenPaths).length > 0 ? (
                                                        <>
                                                            <ElDropdown
                                                                v-slots={{
                                                                    dropdown: () => (
                                                                        <ElDropdownMenu>
                                                                            {(unref(breadcrumbHiddenPaths) || []).map(
                                                                                (hidePath) => (
                                                                                    <ElDropdownItem
                                                                                        onClick={($event?: any) => {
                                                                                            $event.stopPropagation();
                                                                                            jump(hidePath.url);
                                                                                        }}
                                                                                        key={hidePath.url}
                                                                                    >
                                                                                        <span class={'box-item'}>
                                                                                            {hidePath.name.length > 25
                                                                                                ? hidePath.name.substring(
                                                                                                      0,
                                                                                                      22,
                                                                                                  ) + '...'
                                                                                                : hidePath.name}
                                                                                        </span>
                                                                                    </ElDropdownItem>
                                                                                ),
                                                                            )}
                                                                        </ElDropdownMenu>
                                                                    ),
                                                                }}
                                                            >
                                                                <span
                                                                    onClick={($event?: any) => {
                                                                        $event.stopPropagation();
                                                                    }}
                                                                    class={
                                                                        'path-segment path-segment--overflow pathname cursor-pointer focus:outline-none focus-visible:outline-none'
                                                                    }
                                                                >
                                                                    {' .. '}
                                                                </span>
                                                            </ElDropdown>
                                                            <span class={'arrow'}>{'>'}</span>
                                                            <ElTooltip
                                                                effect="dark"
                                                                content={path.name}
                                                                placement="bottom"
                                                                class={'box-item'}
                                                            >
                                                                <ElLink
                                                                    onClick={($event?: any) => {
                                                                        $event.stopPropagation();
                                                                        jump(path.url);
                                                                    }}
                                                                    class={'path-segment pathname cursor-pointer'}
                                                                >
                                                                    {formatBreadcrumbName(path, index)}
                                                                </ElLink>
                                                            </ElTooltip>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ElTooltip
                                                                effect="dark"
                                                                content={path.name}
                                                                placement="bottom"
                                                                class={'box-item'}
                                                            >
                                                                <ElLink
                                                                    onClick={($event?: any) => {
                                                                        $event.stopPropagation();
                                                                        jump(path.url);
                                                                    }}
                                                                    class={'path-segment pathname cursor-pointer'}
                                                                >
                                                                    {formatBreadcrumbName(path, index)}
                                                                </ElLink>
                                                            </ElTooltip>
                                                        </>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <ElInput
                                        ref={(el) => unref(setSearchableInputRef)(item.id, el)}
                                        modelValue={unref(searchablePath)}
                                        onUpdate:modelValue={($v) => {
                                            searchablePath.value = $v as any;
                                        }}
                                        onBlur={($event?: any) => {
                                            unref(searchableInputBlur);
                                        }}
                                        onKeyup={($event?: any) => {
                                            if (!($event.key === 'Enter')) return;
                                            jump(unref(searchablePath));
                                            searchableStatus.value = false;
                                        }}
                                        class={'address-input'}
                                        style={[{}, { display: unref(searchableStatus) ? '' : 'none' }]}
                                    />
                                </div>
                                <div class={'block min-w-0 flex-1 sm:hidden'}>
                                    <div class={'address-bar'}>
                                        <div class={'address-url flex items-center'}>
                                            <span class={'breadcrumb-root'}>
                                                <ElLink
                                                    onClick={($event?: any) => {
                                                        $event.stopPropagation();
                                                        jump('/');
                                                    }}
                                                >
                                                    <ElIcon size={20}>
                                                        <HomeFilled />
                                                    </ElIcon>
                                                </ElLink>
                                            </span>
                                            {(unref(breadcrumbVisiblePaths) || []).map((path, index) => (
                                                <span
                                                    class={'breadcrumb-item inline-flex min-w-0 items-center'}
                                                    key={path.url}
                                                >
                                                    <span class={'arrow'}>{'>'}</span>
                                                    {index === 1 && unref(breadcrumbHiddenPaths).length > 0 ? (
                                                        <>
                                                            <ElDropdown
                                                                v-slots={{
                                                                    dropdown: () => (
                                                                        <ElDropdownMenu>
                                                                            {(unref(breadcrumbHiddenPaths) || []).map(
                                                                                (hidePath) => (
                                                                                    <ElDropdownItem
                                                                                        onClick={($event?: any) => {
                                                                                            $event.stopPropagation();
                                                                                            jump(hidePath.url);
                                                                                        }}
                                                                                        key={hidePath.url}
                                                                                    >
                                                                                        <span class={'box-item'}>
                                                                                            {hidePath.name.length > 25
                                                                                                ? hidePath.name.substring(
                                                                                                      0,
                                                                                                      22,
                                                                                                  ) + '...'
                                                                                                : hidePath.name}
                                                                                        </span>
                                                                                    </ElDropdownItem>
                                                                                ),
                                                                            )}
                                                                        </ElDropdownMenu>
                                                                    ),
                                                                }}
                                                            >
                                                                <span
                                                                    onClick={($event?: any) => {
                                                                        $event.stopPropagation();
                                                                    }}
                                                                    class={
                                                                        'path-segment path-segment--overflow pathname cursor-pointer focus:outline-none focus-visible:outline-none'
                                                                    }
                                                                >
                                                                    {' .. '}
                                                                </span>
                                                            </ElDropdown>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span class={'arrow'}>{'>'}</span>
                                                            <ElTooltip
                                                                effect="dark"
                                                                content={path.name}
                                                                placement="bottom"
                                                                class={'box-item'}
                                                            >
                                                                <ElLink
                                                                    onClick={($event?: any) => {
                                                                        $event.stopPropagation();
                                                                        jump(path.url);
                                                                    }}
                                                                    class={'path-segment pathname cursor-pointer'}
                                                                >
                                                                    {formatBreadcrumbName(path, index)}
                                                                </ElLink>
                                                            </ElTooltip>
                                                        </>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div
                                    class={
                                        'flex w-full flex-wrap items-center justify-start gap-2 xl:w-auto xl:flex-nowrap'
                                    }
                                >
                                    <div class={'file-search-input-shell w-full min-w-0'}>
                                        <ElInput
                                            modelValue={req.search}
                                            onUpdate:modelValue={($v) => {
                                                req.search = $v as any;
                                            }}
                                            onClear={($event?: any) => {
                                                search();
                                            }}
                                            onKeydown={($event?: any) => {
                                                if (!($event.key === 'Enter')) return;
                                                search();
                                            }}
                                            placeholder={$t('file.search')}
                                            v-slots={{
                                                prepend: () => (
                                                    <>
                                                        <ElCheckbox
                                                            modelValue={req.containSub}
                                                            onUpdate:modelValue={($v) => {
                                                                req.containSub = $v as any;
                                                            }}
                                                        >
                                                            {$t('file.sub')}
                                                        </ElCheckbox>
                                                    </>
                                                ),
                                                append: () => (
                                                    <>
                                                        <ElButton
                                                            icon="Search"
                                                            onClick={($event?: any) => {
                                                                (search as any)($event);
                                                            }}
                                                            round
                                                        />
                                                    </>
                                                ),
                                            }}
                                        />
                                    </div>
                                    {withDirectives(
                                        <ElButton
                                            plain
                                            type="primary"
                                            onClick={($event?: any) => {
                                                (openAiSearchDrawer as any)($event);
                                            }}
                                            class={'max-w-20'}
                                        >
                                            {$t('file.aiSearch')}
                                        </ElButton>,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                </div>
                            </div>
                            {withDirectives(
                                <LayoutContent
                                    title={$t('menu.files')}
                                    class={'file-layout'}
                                    v-slots={{
                                        prompt: () => (
                                            <>
                                                <ElAlert
                                                    type="info"
                                                    closable={false}
                                                    v-slots={{
                                                        title: () => (
                                                            <>
                                                                <span class={'input-help whitespace-break-spaces'}>
                                                                    {$t('file.fileHelper')}
                                                                </span>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            </>
                                        ),
                                        leftToolBar: () => (
                                            <>
                                                <div class={'flex max-w-full flex-wrap items-center gap-2'}>
                                                    <ElDropdown
                                                        onCommand={($event?: any) => {
                                                            (handleCreate as any)($event);
                                                        }}
                                                        v-slots={{
                                                            dropdown: () => (
                                                                <ElDropdownMenu>
                                                                    {withDirectives(
                                                                        <FuDropdownItem command="dir">
                                                                            <SvgIcon iconName="p-file-folder" />
                                                                            {$t('file.dir')}
                                                                        </FuDropdownItem>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
                                                                    {withDirectives(
                                                                        <FuDropdownItem command="file">
                                                                            <SvgIcon iconName="p-file-normal" />
                                                                            {$t('menu.files')}
                                                                        </FuDropdownItem>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
                                                                </ElDropdownMenu>
                                                            ),
                                                        }}
                                                    >
                                                        <ElButton type="primary">
                                                            {$t('commons.button.create')}
                                                            <ElIcon>
                                                                <ArrowDown />
                                                            </ElIcon>
                                                        </ElButton>
                                                    </ElDropdown>
                                                    <ElDropdown
                                                        v-slots={{
                                                            dropdown: () => (
                                                                <ElDropdownMenu>
                                                                    {withDirectives(
                                                                        <FuDropdownItem
                                                                            onClick={($event?: any) => {
                                                                                (openUpload as any)($event);
                                                                            }}
                                                                        >
                                                                            <ElIcon>
                                                                                <ElUpload />
                                                                            </ElIcon>
                                                                            {$t('commons.button.upload')}
                                                                        </FuDropdownItem>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
                                                                    {withDirectives(
                                                                        <FuDropdownItem
                                                                            onClick={($event?: any) => {
                                                                                (openWget as any)($event);
                                                                            }}
                                                                        >
                                                                            <ElIcon>
                                                                                <ElDownload />
                                                                            </ElIcon>
                                                                            {$t('file.remoteFile')}
                                                                        </FuDropdownItem>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
                                                                </ElDropdownMenu>
                                                            ),
                                                        }}
                                                    >
                                                        <ElButton>
                                                            {$t('commons.button.upload')}
                                                            {'/'}
                                                            {$t('commons.button.download')}
                                                            <ElIcon>
                                                                <ArrowDown />
                                                            </ElIcon>
                                                        </ElButton>
                                                    </ElDropdown>
                                                    <ElButtonGroup class={'file-utility-group'}>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                (openRecycleBin as any)($event);
                                                            }}
                                                            class={'btn'}
                                                        >
                                                            {$t('file.recycleBin')}
                                                        </ElButton>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                (toTerminal as any)($event);
                                                            }}
                                                            disabled={!unref(isAdminOrNodeAdmin)}
                                                            class={'btn'}
                                                        >
                                                            {$t('menu.terminal')}
                                                        </ElButton>
                                                        <ElPopover
                                                            placement="bottom"
                                                            width={250}
                                                            trigger="hover"
                                                            onBeforeEnter={($event?: any) => {
                                                                (getFavorites as any)($event);
                                                            }}
                                                            v-slots={{
                                                                reference: () => (
                                                                    <>
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (openFavorite as any)($event);
                                                                            }}
                                                                        >
                                                                            {$t('file.favorite')}
                                                                        </ElButton>
                                                                    </>
                                                                ),
                                                            }}
                                                        >
                                                            <div class={'favorite-item'}>
                                                                <ElTable data={unref(favorites)}>
                                                                    <ElTableColumn
                                                                        prop="name"
                                                                        v-slots={{
                                                                            default: ({ row }) => (
                                                                                <>
                                                                                    <div
                                                                                        class={
                                                                                            'group flex items-center justify-between'
                                                                                        }
                                                                                    >
                                                                                        <ElTooltip
                                                                                            effect="dark"
                                                                                            content={row.path}
                                                                                            placement="left"
                                                                                            class={'box-item'}
                                                                                        >
                                                                                            <span
                                                                                                onClick={(
                                                                                                    $event?: any,
                                                                                                ) => {
                                                                                                    toFavorite(row);
                                                                                                }}
                                                                                                type="primary"
                                                                                                class={
                                                                                                    'table-link text-ellipsis'
                                                                                                }
                                                                                            >
                                                                                                {row.isDir ? (
                                                                                                    <SvgIcon
                                                                                                        className="table-icon"
                                                                                                        iconName="p-file-folder"
                                                                                                    />
                                                                                                ) : (
                                                                                                    <SvgIcon
                                                                                                        className="table-icon"
                                                                                                        iconName="p-file-normal"
                                                                                                    />
                                                                                                )}
                                                                                                {row.name}
                                                                                            </span>
                                                                                        </ElTooltip>
                                                                                        {!row.isDir ? (
                                                                                            <ElIcon
                                                                                                onClick={(
                                                                                                    $event?: any,
                                                                                                ) => {
                                                                                                    jump(row.path);
                                                                                                }}
                                                                                                class={
                                                                                                    'hidden cursor-pointer group-hover:block'
                                                                                                }
                                                                                            >
                                                                                                <FolderOpened />
                                                                                            </ElIcon>
                                                                                        ) : null}
                                                                                    </div>
                                                                                </>
                                                                            ),
                                                                        }}
                                                                    />
                                                                </ElTable>
                                                            </div>
                                                        </ElPopover>
                                                        <ElButton class={'file-tool'}>
                                                            <ElDropdown
                                                                v-slots={{
                                                                    default: () => (
                                                                        <>
                                                                            <ElButton
                                                                                link
                                                                                class={
                                                                                    '!h-full !w-full cursor-pointer p-2 transition-colors focus-visible:!outline-none'
                                                                                }
                                                                            >
                                                                                {$t('file.fileTools')}
                                                                            </ElButton>
                                                                        </>
                                                                    ),
                                                                    dropdown: () => (
                                                                        <ElDropdownMenu>
                                                                            <FuDropdownItem
                                                                                onClick={($event?: any) => {
                                                                                    (openShareList as any)($event);
                                                                                }}
                                                                            >
                                                                                {$t('file.shareList')}
                                                                            </FuDropdownItem>
                                                                            <FuDropdownItem
                                                                                onClick={($event?: any) => {
                                                                                    (openFileHistoryCenter as any)(
                                                                                        $event,
                                                                                    );
                                                                                }}
                                                                            >
                                                                                {$t('file.history')}
                                                                            </FuDropdownItem>
                                                                        </ElDropdownMenu>
                                                                    ),
                                                                }}
                                                            />
                                                        </ElButton>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                calculateSize(req.path);
                                                            }}
                                                            loading={unref(disableBtn)}
                                                            class={'btn'}
                                                        >
                                                            {$t('file.calculate')}
                                                        </ElButton>
                                                        {unref(hostMount).length == 1 ? (
                                                            <>
                                                                <ElButton
                                                                    onClick={($event?: any) => {
                                                                        $event.stopPropagation();
                                                                        jump(unref(hostMount)[0]?.path);
                                                                    }}
                                                                    class={'btn'}
                                                                >
                                                                    {unref(hostMount)[0]?.path}
                                                                    {' ('}
                                                                    {$t('file.root')}
                                                                    {') '}
                                                                    {formatFileSize(unref(hostMount)[0]?.free)}
                                                                </ElButton>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ElDropdown
                                                                    v-slots={{
                                                                        dropdown: () => (
                                                                            <ElDropdownMenu>
                                                                                {(unref(hostMount) || []).map(
                                                                                    (mount, index) => (
                                                                                        <>
                                                                                            {index == 0 ? (
                                                                                                <ElDropdownItem
                                                                                                    onClick={(
                                                                                                        $event?: any,
                                                                                                    ) => {
                                                                                                        $event.stopPropagation();
                                                                                                        jump(
                                                                                                            mount.path,
                                                                                                        );
                                                                                                    }}
                                                                                                >
                                                                                                    {mount.path}
                                                                                                    {' ('}
                                                                                                    {$t('file.root')}
                                                                                                    {') '}
                                                                                                    {formatFileSize(
                                                                                                        mount.free,
                                                                                                    )}
                                                                                                </ElDropdownItem>
                                                                                            ) : null}
                                                                                            {index != 0 ? (
                                                                                                <ElDropdownItem
                                                                                                    onClick={(
                                                                                                        $event?: any,
                                                                                                    ) => {
                                                                                                        $event.stopPropagation();
                                                                                                        jump(
                                                                                                            mount.path,
                                                                                                        );
                                                                                                    }}
                                                                                                >
                                                                                                    {mount.path}
                                                                                                    {' ('}
                                                                                                    {$t('home.mount')}
                                                                                                    {') '}
                                                                                                    {formatFileSize(
                                                                                                        mount.free,
                                                                                                    )}
                                                                                                </ElDropdownItem>
                                                                                            ) : null}
                                                                                        </>
                                                                                    ),
                                                                                )}
                                                                            </ElDropdownMenu>
                                                                        ),
                                                                    }}
                                                                >
                                                                    <ElButton class={'btn'}>
                                                                        {unref(hostMount)[0]?.path}
                                                                        {' ('}
                                                                        {$t('file.root')}
                                                                        {') '}
                                                                        {formatFileSize(unref(hostMount)[0]?.free)}
                                                                    </ElButton>
                                                                </ElDropdown>
                                                            </>
                                                        )}
                                                    </ElButtonGroup>
                                                    {unref(processCount) > 0 ? (
                                                        <ElBadge value={unref(processCount)} class={'btn'}>
                                                            <ElButton
                                                                onClick={($event?: any) => {
                                                                    (openProcess as any)($event);
                                                                }}
                                                                class={'btn'}
                                                            >
                                                                {$t('file.wgetTask')}
                                                            </ElButton>
                                                        </ElBadge>
                                                    ) : null}
                                                </div>
                                            </>
                                        ),
                                        rightToolBar: () => (
                                            <>
                                                <div
                                                    ref={(el) => setBtnWrapperRef(item.id, el)}
                                                    class={[
                                                        'file-batch-toolbar flex max-w-full flex-nowrap items-center gap-2',
                                                        unref(isRightToolbarWrapped)
                                                            ? 'is-toolbar-wrapped w-full justify-start'
                                                            : 'justify-end',
                                                    ]}
                                                >
                                                    <div class={'flex min-w-0 flex-nowrap items-center gap-2'}>
                                                        {unref(moveOpen) ? (
                                                            <ElButtonGroup class={'copy-button'}>
                                                                <ElTooltip
                                                                    effect="dark"
                                                                    content={$t('file.paste')}
                                                                    placement="bottom"
                                                                    class={'box-item'}
                                                                >
                                                                    <ElButton
                                                                        plain
                                                                        onClick={($event?: any) => {
                                                                            (openPaste as any)($event);
                                                                        }}
                                                                    >
                                                                        {$t('file.paste')}
                                                                        {'('}
                                                                        {fileMove.count}
                                                                        {') '}
                                                                    </ElButton>
                                                                </ElTooltip>
                                                                <ElTooltip
                                                                    effect="dark"
                                                                    content={$t('commons.button.cancel')}
                                                                    placement="bottom"
                                                                    class={'box-item'}
                                                                >
                                                                    <ElButton
                                                                        plain
                                                                        icon="Close"
                                                                        onClick={($event?: any) => {
                                                                            (closeMove as any)($event);
                                                                        }}
                                                                        class={'close'}
                                                                    />
                                                                </ElTooltip>
                                                            </ElButtonGroup>
                                                        ) : null}
                                                        {unref(visibleButtons).length == 0 ? (
                                                            <>
                                                                {unref(moreButtons).length ? (
                                                                    <ElDropdown
                                                                        v-slots={{
                                                                            dropdown: () => (
                                                                                <ElDropdownMenu>
                                                                                    {(unref(moreButtons) || []).map(
                                                                                        (btn) =>
                                                                                            withDirectives(
                                                                                                <FuDropdownItem
                                                                                                    onClick={(
                                                                                                        $event?: any,
                                                                                                    ) => {
                                                                                                        (
                                                                                                            btn.action as any
                                                                                                        )($event);
                                                                                                    }}
                                                                                                    disabled={
                                                                                                        unref(selects)
                                                                                                            .length ===
                                                                                                        0
                                                                                                    }
                                                                                                    key={btn.label}
                                                                                                >
                                                                                                    {$t(btn.label)}
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
                                                                                            ),
                                                                                    )}
                                                                                </ElDropdownMenu>
                                                                            ),
                                                                        }}
                                                                    >
                                                                        <ElButton>
                                                                            {$t('tabs.more')}
                                                                            <ElIcon>
                                                                                <ArrowDown />
                                                                            </ElIcon>
                                                                        </ElButton>
                                                                    </ElDropdown>
                                                                ) : null}
                                                            </>
                                                        ) : null}
                                                        {unref(visibleButtons).length > 0 ? (
                                                            <>
                                                                <ElButtonGroup
                                                                    class={'flex max-w-full flex-nowrap items-center'}
                                                                >
                                                                    {(unref(visibleButtons) || []).map((btn) => (
                                                                        <>
                                                                            {withDirectives(
                                                                                <ElButton
                                                                                    plain
                                                                                    onClick={($event?: any) => {
                                                                                        (btn.action as any)($event);
                                                                                    }}
                                                                                    disabled={
                                                                                        unref(selects).length === 0
                                                                                    }
                                                                                >
                                                                                    {$t(btn.label)}
                                                                                </ElButton>,
                                                                                [
                                                                                    [permissionDirective, true],
                                                                                    [nodeAdminDirective, true],
                                                                                ],
                                                                            )}
                                                                        </>
                                                                    ))}
                                                                    {unref(moreButtons).length ? (
                                                                        <ElDropdown
                                                                            v-slots={{
                                                                                dropdown: () => (
                                                                                    <ElDropdownMenu>
                                                                                        {(unref(moreButtons) || []).map(
                                                                                            (btn) =>
                                                                                                withDirectives(
                                                                                                    <FuDropdownItem
                                                                                                        onClick={(
                                                                                                            $event?: any,
                                                                                                        ) => {
                                                                                                            (
                                                                                                                btn.action as any
                                                                                                            )($event);
                                                                                                        }}
                                                                                                        disabled={
                                                                                                            unref(
                                                                                                                selects,
                                                                                                            ).length ===
                                                                                                            0
                                                                                                        }
                                                                                                        key={btn.label}
                                                                                                    >
                                                                                                        {$t(btn.label)}
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
                                                                                                ),
                                                                                        )}
                                                                                    </ElDropdownMenu>
                                                                                ),
                                                                            }}
                                                                        >
                                                                            <ElButton>
                                                                                {$t('tabs.more')}
                                                                                <ElIcon>
                                                                                    <ArrowDown />
                                                                                </ElIcon>
                                                                            </ElButton>
                                                                        </ElDropdown>
                                                                    ) : null}
                                                                </ElButtonGroup>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                    <div class={'flex items-center gap-2'}>
                                                        <FuTableColumnSelect
                                                            columns={unref(columns)}
                                                            trigger="hover"
                                                            title={$t('commons.table.selectColumn')}
                                                            popper-class="popper-class"
                                                            only-icon={true}
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        ),
                                        main: () => (
                                            <>
                                                <ComplexTable
                                                    cache-pagination={false}
                                                    pagination-config={paginationConfig}
                                                    selects={unref(selects)}
                                                    onUpdate:selects={($v) => {
                                                        selects.value = $v as any;
                                                    }}
                                                    ref={(el) => setTableRef(item.id, el)}
                                                    data={unref(data)}
                                                    onSearch={($event?: any) => {
                                                        (search as any)($event);
                                                    }}
                                                    onSortChange={($event?: any) => {
                                                        (changeSort as any)($event);
                                                    }}
                                                    onCellMouseEnter={($event?: any) => {
                                                        (showFavorite as any)($event);
                                                    }}
                                                    onCellMouseLeave={($event?: any) => {
                                                        (hideFavorite as any)($event);
                                                    }}
                                                    heightDiff={unref(heightDiff)}
                                                    right-buttons={unref(rightButtons)}
                                                    columns={unref(columns)}
                                                    localKey="fileManagementColumn"
                                                    class={'file-table'}
                                                    v-slots={{
                                                        paginationLeft: () => (
                                                            <>
                                                                <div class={'file-pagination-summary'}>
                                                                    <ElText small>
                                                                        {$t('file.fileDirNum', [
                                                                            unref(dirNum),
                                                                            unref(fileNum),
                                                                        ])}
                                                                    </ElText>
                                                                    <ElText small>
                                                                        {$t('file.currentDir') + $t('file.size') + ' '}
                                                                    </ElText>
                                                                    <ElButton
                                                                        type="primary"
                                                                        link
                                                                        small
                                                                        loading={unref(calculateBtn)}
                                                                    >
                                                                        {unref(dirTotalSize) == -1 ? (
                                                                            <span
                                                                                onClick={($event?: any) => {
                                                                                    getDirTotalSize(req.path);
                                                                                }}
                                                                            >
                                                                                {$t('file.calculate')}
                                                                            </span>
                                                                        ) : (
                                                                            <span>
                                                                                {formatFileSize(unref(dirTotalSize))}
                                                                            </span>
                                                                        )}
                                                                    </ElButton>
                                                                </div>
                                                            </>
                                                        ),
                                                    }}
                                                >
                                                    <ElTableColumn type="selection" width="30" />
                                                    <ElTableColumn
                                                        label={$t('commons.table.name')}
                                                        min-width="250"
                                                        fix
                                                        show-overflow-tooltip
                                                        sortable={'custom'}
                                                        prop="name"
                                                        v-slots={{
                                                            default: ({ row }) => (
                                                                <>
                                                                    <div class={'file-row'}>
                                                                        <div class={'file-row__icon'}>
                                                                            {row.isDir ? (
                                                                                <SvgIcon
                                                                                    className="table-icon"
                                                                                    iconName="p-file-folder"
                                                                                />
                                                                            ) : (
                                                                                <SvgIcon
                                                                                    className="table-icon"
                                                                                    iconName={getIconName(
                                                                                        row.name,
                                                                                        row.extension,
                                                                                    )}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <div class={'file-name'}>
                                                                            {unref(isEdit) &&
                                                                            fileRename.oldPath === row.path &&
                                                                            fileRename.tabId === item.id ? (
                                                                                withDirectives(
                                                                                    <div
                                                                                        onClick={($event?: any) => {
                                                                                            $event.stopPropagation();
                                                                                        }}
                                                                                        onKeydown={($event?: any) => {
                                                                                            if (
                                                                                                !(
                                                                                                    $event.key ===
                                                                                                    'Escape'
                                                                                                )
                                                                                            )
                                                                                                return;
                                                                                            onRenameEscape($event, row);
                                                                                        }}
                                                                                        class={'min-w-0'}
                                                                                    >
                                                                                        <ElInput
                                                                                            modelValue={
                                                                                                fileRename.newName
                                                                                            }
                                                                                            onUpdate:modelValue={(
                                                                                                $v,
                                                                                            ) => {
                                                                                                fileRename.newName =
                                                                                                    typeof $v ===
                                                                                                    'string'
                                                                                                        ? $v.trim()
                                                                                                        : $v;
                                                                                            }}
                                                                                            ref={(el) =>
                                                                                                setRenameRef(
                                                                                                    item.id,
                                                                                                    el,
                                                                                                )
                                                                                            }
                                                                                            autofocus={unref(isEdit)}
                                                                                            readonly={unref(
                                                                                                renameSubmitting,
                                                                                            )}
                                                                                            aria-label={$t(
                                                                                                'commons.table.name',
                                                                                            )}
                                                                                            onCompositionstart={(
                                                                                                $event?: any,
                                                                                            ) => {
                                                                                                renameComposing.value = true;
                                                                                            }}
                                                                                            onCompositionend={(
                                                                                                $event?: any,
                                                                                            ) => {
                                                                                                onRenameCompositionEnd(
                                                                                                    $event,
                                                                                                    row,
                                                                                                );
                                                                                            }}
                                                                                            onKeydown={(
                                                                                                $event?: any,
                                                                                            ) => {
                                                                                                if (
                                                                                                    !(
                                                                                                        $event.key ===
                                                                                                        'Enter'
                                                                                                    )
                                                                                                )
                                                                                                    return;
                                                                                                onRenameEnter(
                                                                                                    $event,
                                                                                                    row,
                                                                                                );
                                                                                            }}
                                                                                            class={'table-input'}
                                                                                        />
                                                                                    </div>,
                                                                                    [
                                                                                        [
                                                                                            ClickOutside,
                                                                                            () => onRenameLeave(row),
                                                                                        ],
                                                                                    ],
                                                                                )
                                                                            ) : (
                                                                                <span
                                                                                    onClick={($event?: any) => {
                                                                                        open(row);
                                                                                    }}
                                                                                    type="primary"
                                                                                    class={'table-link'}
                                                                                >
                                                                                    {row.name}
                                                                                </span>
                                                                            )}
                                                                            {row.isSymlink ? (
                                                                                <span>
                                                                                    {'-> '}
                                                                                    {row.linkPath}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        <div class={'file-row__actions'}>
                                                                            {row.shareCode
                                                                                ? withDirectives(
                                                                                      <ElButton
                                                                                          link
                                                                                          type="primary"
                                                                                          size="large"
                                                                                          icon="Share"
                                                                                          onClick={($event?: any) => {
                                                                                              openShareFile(row);
                                                                                          }}
                                                                                      />,
                                                                                      [
                                                                                          [permissionDirective, true],
                                                                                          [nodeAdminDirective, true],
                                                                                      ],
                                                                                  )
                                                                                : null}
                                                                        </div>
                                                                        <div class={'file-row__actions'}>
                                                                            {row.favoriteId > 0 ? (
                                                                                withDirectives(
                                                                                    <ElButton
                                                                                        link
                                                                                        type="warning"
                                                                                        size="large"
                                                                                        icon="StarFilled"
                                                                                        onClick={($event?: any) => {
                                                                                            remove(row.favoriteId);
                                                                                        }}
                                                                                    />,
                                                                                    [
                                                                                        [permissionDirective, true],
                                                                                        [nodeAdminDirective, true],
                                                                                    ],
                                                                                )
                                                                            ) : (
                                                                                <div>
                                                                                    {unref(hoveredRowPath) ===
                                                                                        row.path &&
                                                                                    !isCurrentRename(row)
                                                                                        ? withDirectives(
                                                                                              <ElButton
                                                                                                  link
                                                                                                  icon="Star"
                                                                                                  onClick={(
                                                                                                      $event?: any,
                                                                                                  ) => {
                                                                                                      addToFavorite(
                                                                                                          row,
                                                                                                      );
                                                                                                  }}
                                                                                              />,
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
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <ElTableColumn
                                                        label={$t('file.mode')}
                                                        prop="mode"
                                                        width="80"
                                                        v-slots={{
                                                            default: ({ row }) => (
                                                                <>
                                                                    {withDirectives(
                                                                        <ElLink
                                                                            underline="never"
                                                                            onClick={($event?: any) => {
                                                                                openMode(row);
                                                                            }}
                                                                        >
                                                                            {row.mode}
                                                                        </ElLink>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <ElTableColumn
                                                        label={`${$t('commons.table.user')} / ${$t('file.group')}`}
                                                        prop="user"
                                                        show-overflow-tooltip
                                                        width="200"
                                                        v-slots={{
                                                            default: ({ row }) => (
                                                                <>
                                                                    {withDirectives(
                                                                        <ElLink
                                                                            underline="never"
                                                                            onClick={($event?: any) => {
                                                                                openChown(row);
                                                                            }}
                                                                        >
                                                                            {row.user ? row.user : '-'}
                                                                            {' ('}
                                                                            {row.uid}
                                                                            {') / '}
                                                                            {row.group ? row.group : '-'}
                                                                            {' ('}
                                                                            {row.gid}
                                                                            {') '}
                                                                        </ElLink>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <ElTableColumn
                                                        label={$t('file.size')}
                                                        prop="size"
                                                        width="120"
                                                        sortable={'custom'}
                                                        v-slots={{
                                                            default: ({ row }) => (
                                                                <>
                                                                    <ElButton
                                                                        type="primary"
                                                                        link
                                                                        small
                                                                        loading={row.btnLoading}
                                                                        onClick={($event?: any) => {
                                                                            row.isDir
                                                                                ? getDirSize(row.path)
                                                                                : getFileSize(row.path);
                                                                        }}
                                                                    >
                                                                        {row.isDir ? (
                                                                            <span>
                                                                                {row.dirSize === undefined ? (
                                                                                    <span>{$t('file.calculate')}</span>
                                                                                ) : (
                                                                                    <span>
                                                                                        {formatFileSize(row.dirSize)}
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        ) : (
                                                                            <span>{formatFileSize(row.size)}</span>
                                                                        )}
                                                                    </ElButton>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <ElTableColumn
                                                        label={$t('file.updateTime')}
                                                        prop="modTime"
                                                        width="180"
                                                        show-overflow-tooltip
                                                        sortable={'custom'}
                                                        v-slots={{
                                                            default: ({ row }) => (
                                                                <>
                                                                    {row.modTime
                                                                        ? dateFormatSimpleWithSecond(row.modTime)
                                                                        : '-'}
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <ElTableColumn
                                                        label={$t('file.remark')}
                                                        prop="remark"
                                                        width="180"
                                                        show-overflow-tooltip
                                                        v-slots={{
                                                            default: ({ row }) => (
                                                                <>
                                                                    <span>{row.remark ? row.remark : '-'}</span>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <FuTableOperations
                                                        max-height={unref(dropdownMaxHeight)}
                                                        ellipsis={unref(isMobile) ? 0 : 2}
                                                        buttons={unref(tableMoreButtons)}
                                                        label={$t('commons.table.operate')}
                                                        min-width={unref(isMobile) ? 'auto' : 200}
                                                        fixed={unref(isMobile) ? false : 'right'}
                                                        width="200"
                                                        fix
                                                    />
                                                </ComplexTable>
                                            </>
                                        ),
                                    }}
                                />,
                                [[vLoading, unref(loading)]],
                            )}
                        </ElTabPane>
                    ))}
                    <ElTabPane
                        name={unref(editableTabsKey)}
                        closable={false}
                        disabled={unref(editableTabs).length > 6}
                        v-slots={{
                            label: () => (
                                <>
                                    <ElIcon
                                        onClick={($event?: any) => {
                                            addTab();
                                        }}
                                    >
                                        <Plus />
                                    </ElIcon>
                                </>
                            ),
                        }}
                    />
                </ElTabs>
                <CreateFile
                    ref={createRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <ChangeRole
                    ref={roleRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <Compress
                    ref={compressRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                    onTaskChange={($event?: any) => {
                        handleFileTaskChange('compress', $event);
                    }}
                />
                <Decompress
                    ref={deCompressRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                    onTaskChange={($event?: any) => {
                        handleFileTaskChange('decompress', $event);
                    }}
                />
                <CodeEditor
                    ref={codeEditorRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <FileRename
                    ref={renameRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <Upload
                    ref={uploadRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <Wget
                    ref={wgetRef}
                    onClose={($event?: any) => {
                        (closeWget as any)($event);
                    }}
                />
                <Move
                    ref={moveRef}
                    onClose={($event?: any) => {
                        (closeMovePage as any)($event);
                    }}
                    onLoading={($event?: any) => {
                        (onLoading as any)($event);
                    }}
                />
                <Download
                    ref={downloadRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <Process
                    ref={processRef}
                    onClose={($event?: any) => {
                        (closeProcess as any)($event);
                    }}
                />
                <Owner
                    ref={chownRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <Detail ref={detailRef} />
                <DeleteFile
                    ref={deleteRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <RecycleBin
                    ref={recycleBinRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <Favorite
                    ref={favoriteRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                    onJump={($event?: any) => {
                        (jump as any)($event);
                    }}
                    onToFavorite={($event?: any) => {
                        (toFavorite as any)($event);
                    }}
                />
                <ShareList
                    ref={shareListRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                    onDetail={($event?: any) => {
                        (openShareDetail as any)($event);
                    }}
                />
                <FileHistoryDrawer
                    ref={historyDrawerRef}
                    onRestored={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <BatchRole
                    ref={batchRoleRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <VscodeOpenDialog ref={dialogVscodeOpenRef} />
                <Preview ref={previewRef} />
                <TextPreview ref={textPreviewRef} />
                <TerminalDialog ref={dialogTerminalRef} />
                <Convert
                    ref={convertRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <FileAiSearchDrawer
                    ref={aiSearchDrawerRef}
                    modelValue={unref(aiSearchDrawerVisible)}
                    onUpdate:modelValue={($v) => {
                        aiSearchDrawerVisible.value = $v as any;
                    }}
                    list-path={req.path}
                    onPickDirectory={($event?: any) => {
                        (openAiSearchPathPicker as any)($event);
                    }}
                    onOpenEditor={($event?: any) => {
                        (onAiSearchOpenEditor as any)($event);
                    }}
                />
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (getSearchPath as any)($event);
                    }}
                />
                <FileShare
                    ref={fileShareRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);

definePage({
    name: 'File',
    props: true,
    meta: { icon: 'p-file-menu', title: 'menu.files', permission: 'host_file_view' },
});
