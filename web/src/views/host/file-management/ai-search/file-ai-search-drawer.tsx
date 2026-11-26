import { $t } from '@/utils/i18n-t';
import { Folder } from '@element-plus/icons-vue';
import { fileAiSearch } from '@/api/modules/files';
import { rpc } from '@/lib/rpc';
import { pageAgentAccounts } from '@/api/modules/ai';
import { File } from '@/types/file';
interface FileAISearchReq {
    path: string;
    query: string;
    responseLanguage?: string;
    containSub?: boolean;
    maxItems?: number;
    matchCase?: boolean;
    wholeWord?: boolean;
    useRegex?: boolean;
    extensions?: string[];
    minSize?: number;
    maxSize?: number;
    modifiedAfter?: string;
    modifiedBefore?: string;
    maxScanFiles?: number;
    maxFileBytes?: number;
    maxHitsPerFile?: number;
    maxTotalHits?: number;
    contentHitsPromptMaxBytes?: number;
    llmMaxOutputTokens?: number;
}
interface FileAIContentHit {
    path: string;
    line: number;
    text: string;
}
interface FileAISearchResult {
    mode?: 'ai' | 'grep';
    summary: string;
    hits: FileAIContentHit[];
    contentScannedFiles: number;
    contentHitsTruncated: boolean;
    truncated: boolean;
    preFiltered: boolean;
    itemCount: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    duration: string;
}
import { useGlobalStore } from '@/composables/useGlobalStore';
import i18n from '@/lang';
import { MsgSuccess, MsgWarning } from '@/utils/message';
import MkdownEditor from '@/components/mkdown-editor/index';
import './file-ai-search-drawer.styles.css';
import { cn } from '@/utils/cn';

interface CodemodProps {
    [key: string]: any;
    modelValue?: boolean;
    listPath?: string;
}

const emits = {
    'update:modelValue': (arg0?: boolean) => true,
    'pick-directory': (arg0?: string) => true,
    'open-editor': (arg0?: { path: string; initialLine?: number }) => true,
};

const options = {
    name: 'file-ai-search-drawer',
    props: {
        modelValue: Boolean,
        listPath: String,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-daf49cd7',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const AI_SEARCH_DEFAULT_MAX_ITEMS = 500;
        const AI_SEARCH_DEFAULT_MAX_SCAN_FILES = 150;
        const AI_SEARCH_DEFAULT_MAX_FILE_BYTES = 512 * 1024;
        const AI_SEARCH_DEFAULT_MAX_HITS_PER_FILE = 40;
        const AI_SEARCH_DEFAULT_MAX_TOTAL_HITS = 500;
        const AI_SEARCH_DRAWER_MOBILE_MQ = '(max-width: 639px)';
        const aiSearchDrawerSize = ref('55%');
        let aiSearchDrawerMq: MediaQueryList | null = null;
        function syncAiSearchDrawerSize(mq: MediaQueryList | MediaQueryListEvent) {
            aiSearchDrawerSize.value = mq.matches ? '100%' : '55%';
        }
        const { language } = useGlobalStore();
        const drawerVisible = computed({
            get: () => __panelSetupProps.modelValue,
            set: (v: boolean) => ctx.emit('update:modelValue', v),
        });
        const aiSearchQuery = ref('');
        const aiSearchPath = ref('');
        const aiSearchContainSub = ref(true);
        const aiSearchTimePreset = ref<'any' | '3h' | '1d' | '7d' | '30d' | 'custom'>('any');
        const aiSearchSizePreset = ref<'any' | 'lte10mb' | 'mb10_100' | 'mb100_1g' | 'gte1gb' | 'custom'>('any');
        const aiSearchMatchCase = ref(false);
        const aiSearchWholeWord = ref(false);
        const aiSearchUseRegex = ref(false);
        const aiSearchExtensionsInput = ref('');
        const aiSearchMinSize = ref<number | undefined>(undefined);
        const aiSearchMaxSize = ref<number | undefined>(undefined);
        const aiSearchModifiedRange = ref<[Date, Date] | null>(null);
        const aiSearchMaxItems = ref(AI_SEARCH_DEFAULT_MAX_ITEMS);
        const aiSearchMaxScanFiles = ref(AI_SEARCH_DEFAULT_MAX_SCAN_FILES);
        const aiSearchMaxFileBytes = ref(AI_SEARCH_DEFAULT_MAX_FILE_BYTES);
        const aiSearchMaxHitsPerFile = ref(AI_SEARCH_DEFAULT_MAX_HITS_PER_FILE);
        const aiSearchMaxTotalHits = ref(AI_SEARCH_DEFAULT_MAX_TOTAL_HITS);
        const aiSearchAdvancedActiveNames = ref<string[]>([]);
        const aiSearchLoading = ref(false);
        const aiSearchResult = ref<FileAISearchResult | null>(null);
        const aiSearchSelectedHitPath = ref('');
        function hitFileRowClass(p: string) {
            const selected = p === aiSearchSelectedHitPath.value;
            return {
                'font-semibold text-[var(--el-color-primary)] bg-[var(--el-fill-color-light)]': selected,
                'hover:bg-[var(--el-fill-color-light)]': !selected,
            };
        }
        const aiSearchHitPaths = computed(() => {
            const r = aiSearchResult.value;
            if (!r?.hits?.length) {
                return [] as string[];
            }
            const set = new Set<string>();
            for (const h of r.hits) {
                if (h.path) {
                    set.add(h.path);
                }
            }
            return Array.from(set).sort();
        });
        const aiSearchHitsForSelected = computed(() => {
            const r = aiSearchResult.value;
            const p = aiSearchSelectedHitPath.value;
            if (!r?.hits?.length || !p) {
                return [] as FileAIContentHit[];
            }
            return r.hits.filter((h) => h.path === p);
        });
        const aiSearchHasHitPanel = computed(() => {
            const r = aiSearchResult.value;
            if (!r) {
                return false;
            }
            return (r.hits?.length ?? 0) > 0 || (r.contentScannedFiles ?? 0) > 0 || !!r.contentHitsTruncated;
        });
        const aiSearchShowGrepMeta = computed(() => {
            const r = aiSearchResult.value;
            if (!r) {
                return false;
            }
            return r.mode === 'grep';
        });
        const aiSearchShowAiMeta = computed(() => {
            const r = aiSearchResult.value;
            if (!r) {
                return false;
            }
            const sum = (r.summary && String(r.summary).trim()) || '';
            if (!sum || r.mode === 'grep') {
                return false;
            }
            return r.mode === 'ai' || r.mode == null || r.mode === '';
        });
        const aiSearchShowSummaryPanel = computed(() => {
            const r = aiSearchResult.value;
            if (!r) {
                return false;
            }
            if (r.mode === 'grep') {
                return false;
            }
            return !!(r.summary && String(r.summary).trim());
        });
        watch(
            () => aiSearchResult.value,
            (r) => {
                if (!r?.hits?.length) {
                    aiSearchSelectedHitPath.value = '';
                    return;
                }
                const paths = [...new Set(r.hits.map((h) => h.path).filter(Boolean))].sort();
                aiSearchSelectedHitPath.value = paths[0] || '';
            },
        );
        watch(
            () => aiSearchUseRegex.value,
            (on) => {
                if (on) {
                    aiSearchWholeWord.value = false;
                }
            },
        );
        const fileAiDrawerLoading = ref(false);
        const fileAiSettingsSaving = ref(false);
        const fileAiStatus = ref<'Enable' | 'Disable'>('Disable');
        const fileAiAccountId = ref('');
        const fileAiAgentAccountOptions = ref<
            Array<{
                id: number | string;
                name: string;
                provider?: string;
                providerName?: string;
                verified?: boolean;
                validateAvailability?: boolean;
            }>
        >([]);
        const loadFileAiManageSettings = async () => {
            const res = await rpc.agentSetting.getFileAI({});
            fileAiStatus.value = (res.aiStatus === 'Enable' ? 'Enable' : 'Disable') as 'Enable' | 'Disable';
            fileAiAccountId.value = res.aiAccountId || '';
        };
        const loadFileAiAgentAccounts = async () => {
            const res = await pageAgentAccounts({ page: 1, pageSize: 1000, provider: '', textOnly: true, name: '' });
            fileAiAgentAccountOptions.value = res.data?.items || [];
        };
        const fileAiVerificationLabel = (item: {
            provider?: string;
            verified?: boolean;
            validateAvailability?: boolean;
        }) => {
            if (item.validateAvailability === false) return i18n.global.t('aiTools.agents.verifySkipped');
            return item.verified ? 'OK' : 'N/A';
        };
        const fileAiVerificationTagType = (item: {
            provider?: string;
            verified?: boolean;
            validateAvailability?: boolean;
        }) => {
            if (item.validateAvailability === false) return 'info';
            return item.verified ? 'success' : 'warning';
        };
        const saveFileAiManageSettings = async () => {
            if (fileAiStatus.value === 'Enable' && !String(fileAiAccountId.value).trim()) {
                MsgWarning(i18n.global.t('commons.rule.requiredSelect'));
                return;
            }
            fileAiSettingsSaving.value = true;
            try {
                await rpc.agentSetting.updateFileAI({
                    aiStatus: fileAiStatus.value,
                    aiAccountId: fileAiStatus.value === 'Enable' ? fileAiAccountId.value : '',
                });
                if (fileAiStatus.value === 'Disable') {
                    fileAiAccountId.value = '';
                }
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } finally {
                fileAiSettingsSaving.value = false;
            }
        };
        watch(
            () => __panelSetupProps.modelValue,
            (v) => {
                if (!v) {
                    return;
                }
                aiSearchQuery.value = '';
                aiSearchResult.value = null;
                aiSearchPath.value = (__panelSetupProps.listPath || '').trim();
                fileAiDrawerLoading.value = true;
                Promise.all([loadFileAiManageSettings(), loadFileAiAgentAccounts()]).finally(() => {
                    fileAiDrawerLoading.value = false;
                });
            },
        );
        onMounted(() => {
            aiSearchDrawerMq = window.matchMedia(AI_SEARCH_DRAWER_MOBILE_MQ);
            syncAiSearchDrawerSize(aiSearchDrawerMq);
            aiSearchDrawerMq.addEventListener('change', syncAiSearchDrawerSize);
        });
        onUnmounted(() => {
            aiSearchDrawerMq?.removeEventListener('change', syncAiSearchDrawerSize);
        });
        const drawerContentBusy = computed(() => fileAiDrawerLoading.value || aiSearchLoading.value);
        const handleAiSearchDrawerBeforeClose = (done: () => void) => {
            if (aiSearchLoading.value) {
                return;
            }
            done();
        };
        const applyAiSearchTimeToPayload = (payload: FileAISearchReq) => {
            const p = aiSearchTimePreset.value;
            if (p === 'custom') {
                const mr = aiSearchModifiedRange.value;
                if (mr?.[0] instanceof Date) {
                    payload.modifiedAfter = mr[0].toISOString();
                }
                if (mr?.[1] instanceof Date) {
                    payload.modifiedBefore = mr[1].toISOString();
                }
                return;
            }
            if (p === 'any') {
                return;
            }
            const now = Date.now();
            const delta: Record<string, number> = {
                '3h': 3 * 3600000,
                '1d': 86400000,
                '7d': 7 * 86400000,
                '30d': 30 * 86400000,
            };
            const ms = delta[p];
            if (ms) {
                payload.modifiedAfter = new Date(now - ms).toISOString();
                payload.modifiedBefore = new Date(now).toISOString();
            }
        };
        const applyAiSearchSizeToPayload = (payload: FileAISearchReq) => {
            const p = aiSearchSizePreset.value;
            const MB = 1024 * 1024;
            const GB = 1024 * MB;
            if (p === 'custom') {
                if (aiSearchMinSize.value != null && aiSearchMinSize.value > 0) {
                    payload.minSize = aiSearchMinSize.value;
                }
                if (aiSearchMaxSize.value != null && aiSearchMaxSize.value > 0) {
                    payload.maxSize = aiSearchMaxSize.value;
                }
                return;
            }
            if (p === 'any') {
                return;
            }
            if (p === 'lte10mb') {
                payload.maxSize = 10 * MB;
            } else if (p === 'mb10_100') {
                payload.minSize = 10 * MB;
                payload.maxSize = 100 * MB;
            } else if (p === 'mb100_1g') {
                payload.minSize = 100 * MB;
                payload.maxSize = 1024 * MB;
            } else if (p === 'gte1gb') {
                payload.minSize = GB;
            }
        };
        const submitAiSearch = async () => {
            const q = aiSearchQuery.value.trim();
            if (!q) {
                MsgWarning(i18n.global.t('file.aiSearchQueryRequired'));
                return;
            }
            aiSearchLoading.value = true;
            aiSearchResult.value = null;
            try {
                const ext = aiSearchExtensionsInput.value
                    .split(/[,;\s]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                const rootPath =
                    (aiSearchPath.value || __panelSetupProps.listPath || '').trim() || __panelSetupProps.listPath;
                const payload: FileAISearchReq = {
                    path: rootPath,
                    query: q,
                    responseLanguage: language.value,
                    containSub: aiSearchContainSub.value,
                    matchCase: aiSearchMatchCase.value,
                    wholeWord: aiSearchWholeWord.value,
                    useRegex: aiSearchUseRegex.value,
                };
                if (ext.length) {
                    payload.extensions = ext;
                }
                applyAiSearchSizeToPayload(payload);
                applyAiSearchTimeToPayload(payload);
                const limItems = Number(aiSearchMaxItems.value) || AI_SEARCH_DEFAULT_MAX_ITEMS;
                const limTotal = Number(aiSearchMaxTotalHits.value) || AI_SEARCH_DEFAULT_MAX_TOTAL_HITS;
                if (limItems > 0) {
                    payload.maxItems = limItems;
                }
                const limScan = Number(aiSearchMaxScanFiles.value) || AI_SEARCH_DEFAULT_MAX_SCAN_FILES;
                const limBytes = Number(aiSearchMaxFileBytes.value) || AI_SEARCH_DEFAULT_MAX_FILE_BYTES;
                const limPer = Number(aiSearchMaxHitsPerFile.value) || AI_SEARCH_DEFAULT_MAX_HITS_PER_FILE;
                if (limScan > 0) {
                    payload.maxScanFiles = limScan;
                }
                if (limBytes > 0) {
                    payload.maxFileBytes = limBytes;
                }
                if (limPer > 0) {
                    payload.maxHitsPerFile = limPer;
                }
                if (limTotal > 0) {
                    payload.maxTotalHits = limTotal;
                }
                const res = await fileAiSearch(payload);
                aiSearchResult.value = res.data;
            } finally {
                aiSearchLoading.value = false;
            }
        };
        function applyPathFromPicker(path: string | string[]) {
            if (Array.isArray(path)) {
                aiSearchPath.value = (path[0] || '').trim();
                return;
            }
            aiSearchPath.value = (path || '').trim();
        }
        function resetAiSearchLimitsToDefaults() {
            aiSearchMaxItems.value = AI_SEARCH_DEFAULT_MAX_ITEMS;
            aiSearchMaxScanFiles.value = AI_SEARCH_DEFAULT_MAX_SCAN_FILES;
            aiSearchMaxFileBytes.value = AI_SEARCH_DEFAULT_MAX_FILE_BYTES;
            aiSearchMaxHitsPerFile.value = AI_SEARCH_DEFAULT_MAX_HITS_PER_FILE;
            aiSearchMaxTotalHits.value = AI_SEARCH_DEFAULT_MAX_TOTAL_HITS;
        }
        ctx.expose({ applyPathFromPicker });
        return () => (
            <ElDrawer
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                title={$t('file.aiSearchTitle')}
                size={unref(aiSearchDrawerSize)}
                destroy-on-close
                close-on-click-modal={!unref(aiSearchLoading)}
                close-on-press-escape={!unref(aiSearchLoading)}
                show-close={!unref(aiSearchLoading)}
                before-close={handleAiSearchDrawerBeforeClose}
            >
                {withDirectives(
                    <div element-loading-lock class={'ai-search-drawer-inner flex min-h-[50vh] flex-col gap-3'}>
                        <ElAlert type="info" closable={false} show-icon class={'shrink-0'}>
                            {unref(fileAiStatus) === 'Disable'
                                ? $t('file.aiSearchGrepOnlyHint')
                                : $t('file.aiSearchHint')}
                        </ElAlert>
                        <ElCard
                            shadow="never"
                            class={'ai-search-section-card'}
                            v-slots={{
                                header: () => (
                                    <>
                                        <span class={'text-sm font-medium'}>{$t('file.aiSearchAccountTitle')}</span>
                                    </>
                                ),
                            }}
                        >
                            <ElForm label-position="top" class={'ai-search-account-form'}>
                                <ElFormItem label={$t('file.aiSearchAccountEnable')}>
                                    <ElSwitch
                                        modelValue={unref(fileAiStatus)}
                                        onUpdate:modelValue={($v) => {
                                            fileAiStatus.value = $v as any;
                                        }}
                                        active-value="Enable"
                                        inactive-value="Disable"
                                    />
                                </ElFormItem>
                                {unref(fileAiStatus) === 'Enable' ? (
                                    <ElFormItem label={$t('aiTools.agents.account')}>
                                        <ElSelect
                                            modelValue={unref(fileAiAccountId)}
                                            onUpdate:modelValue={($v) => {
                                                fileAiAccountId.value = $v as any;
                                            }}
                                            clearable
                                            filterable
                                            class={'w-full'}
                                        >
                                            {(unref(fileAiAgentAccountOptions) || []).map((item) => (
                                                <ElOption label={item.name} value={String(item.id)} key={item.id}>
                                                    <div class={'flex items-center justify-between gap-3'}>
                                                        <span>{item.name}</span>
                                                        <div class={'flex flex-wrap gap-1'}>
                                                            <ElTag size="small" effect="plain">
                                                                {item.providerName || item.provider}
                                                            </ElTag>
                                                            <ElTag
                                                                size="small"
                                                                effect="plain"
                                                                type={fileAiVerificationTagType(item)}
                                                            >
                                                                {fileAiVerificationLabel(item)}
                                                            </ElTag>
                                                        </div>
                                                    </div>
                                                </ElOption>
                                            ))}
                                        </ElSelect>
                                        <span class={'input-help block'}>{$t('file.aiSearchAccountIntro')}</span>
                                    </ElFormItem>
                                ) : null}
                                <ElFormItem>
                                    <ElButton
                                        type="primary"
                                        plain
                                        loading={unref(fileAiSettingsSaving)}
                                        onClick={($event?: any) => {
                                            (saveFileAiManageSettings as any)($event);
                                        }}
                                    >
                                        {$t('file.aiSearchSaveAccount')}
                                    </ElButton>
                                </ElFormItem>
                            </ElForm>
                        </ElCard>
                        <ElCard
                            shadow="never"
                            class={'ai-search-section-card'}
                            v-slots={{
                                header: () => (
                                    <>
                                        <span class={'text-sm font-medium'}>
                                            {$t('file.aiSearchSectionConditions')}
                                        </span>
                                    </>
                                ),
                            }}
                        >
                            <div class={'ai-search-toolbar flex flex-col gap-4'}>
                                <div class={'flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2'}>
                                    <div class={'ai-search-field-pair flex min-w-0 flex-1 items-center gap-2'}>
                                        <span class={'ai-search-field-label shrink-0'}>
                                            {$t('file.aiSearchContentLabel')}
                                        </span>
                                        <ElInput
                                            modelValue={unref(aiSearchQuery)}
                                            onUpdate:modelValue={($v) => {
                                                aiSearchQuery.value = $v as any;
                                            }}
                                            clearable
                                            placeholder={$t('file.aiSearchPlaceholder')}
                                            onKeyup={($event?: any) => {
                                                if (!($event.key === 'Enter')) return;
                                                (submitAiSearch as any)($event);
                                            }}
                                            class={'ai-search-field-input min-w-0 flex-1'}
                                            v-slots={{
                                                suffix: () => (
                                                    <>
                                                        <ElButtonGroup class={'shrink-0'}>
                                                            <ElTooltip
                                                                content={$t('file.aiSearchMatchCase')}
                                                                placement="top"
                                                            >
                                                                <ElButton
                                                                    type={
                                                                        unref(aiSearchMatchCase) ? 'primary' : 'default'
                                                                    }
                                                                    link
                                                                    onClick={($event?: any) => {
                                                                        aiSearchMatchCase.value =
                                                                            !unref(aiSearchMatchCase);
                                                                    }}
                                                                    class={'!px-2.5 font-semibold'}
                                                                >
                                                                    {' Aa '}
                                                                </ElButton>
                                                            </ElTooltip>
                                                            <ElTooltip
                                                                content={$t('file.aiSearchWholeWord')}
                                                                placement="top"
                                                            >
                                                                <ElButton
                                                                    type={
                                                                        unref(aiSearchWholeWord) ? 'primary' : 'default'
                                                                    }
                                                                    disabled={unref(aiSearchUseRegex)}
                                                                    link
                                                                    onClick={($event?: any) => {
                                                                        aiSearchWholeWord.value =
                                                                            !unref(aiSearchWholeWord);
                                                                    }}
                                                                    class={'!px-2.5 font-mono text-xs'}
                                                                >
                                                                    {' [ab] '}
                                                                </ElButton>
                                                            </ElTooltip>
                                                            <ElTooltip
                                                                content={$t('file.aiSearchUseRegex')}
                                                                placement="top"
                                                            >
                                                                <ElButton
                                                                    link
                                                                    type={
                                                                        unref(aiSearchUseRegex) ? 'primary' : 'default'
                                                                    }
                                                                    onClick={($event?: any) => {
                                                                        aiSearchUseRegex.value =
                                                                            !unref(aiSearchUseRegex);
                                                                    }}
                                                                    class={'!px-2.5 font-mono text-xs'}
                                                                >
                                                                    {' .* '}
                                                                </ElButton>
                                                            </ElTooltip>
                                                        </ElButtonGroup>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </div>
                                    <ElButton
                                        type="primary"
                                        loading={unref(aiSearchLoading)}
                                        onClick={($event?: any) => {
                                            (submitAiSearch as any)($event);
                                        }}
                                        class={'w-full shrink-0 sm:w-auto sm:self-center'}
                                    >
                                        {$t('file.aiSearchRun')}
                                    </ElButton>
                                </div>
                                <div
                                    class={
                                        'grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start lg:gap-x-4 lg:gap-y-3'
                                    }
                                >
                                    <div class={'ai-search-field-pair flex min-w-0 items-center gap-2'}>
                                        <span class={'ai-search-field-label shrink-0'}>
                                            {$t('file.aiSearchDirLabel')}
                                        </span>
                                        <ElInput
                                            modelValue={unref(aiSearchPath)}
                                            onUpdate:modelValue={($v) => {
                                                aiSearchPath.value = $v as any;
                                            }}
                                            class={'ai-search-field-input !w-48 min-w-0 flex-1'}
                                            v-slots={{
                                                prepend: () => (
                                                    <>
                                                        <ElCheckbox
                                                            modelValue={unref(aiSearchContainSub)}
                                                            onUpdate:modelValue={($v) => {
                                                                aiSearchContainSub.value = $v as any;
                                                            }}
                                                            class={'!mr-0 shrink-0'}
                                                        >
                                                            {$t('file.sub')}
                                                        </ElCheckbox>
                                                    </>
                                                ),
                                                append: () => (
                                                    <>
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                ctx.emit(
                                                                    'pick-directory',
                                                                    (
                                                                        unref(aiSearchPath) ||
                                                                        __panelSetupProps.listPath ||
                                                                        ''
                                                                    ).trim(),
                                                                );
                                                            }}
                                                        >
                                                            <ElIcon>
                                                                <Folder />
                                                            </ElIcon>
                                                        </ElButton>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </div>
                                    <div class={'ai-search-field-pair flex min-w-0 items-center gap-2'}>
                                        <span class={'ai-search-field-label shrink-0'}>
                                            {$t('file.aiSearchExtLabel')}
                                        </span>
                                        <ElInput
                                            modelValue={unref(aiSearchExtensionsInput)}
                                            onUpdate:modelValue={($v) => {
                                                aiSearchExtensionsInput.value = $v as any;
                                            }}
                                            clearable
                                            placeholder={$t('file.aiSearchExtensions')}
                                            class={'ai-search-field-input min-w-0 flex-1'}
                                        />
                                    </div>
                                    <div class={'flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2'}>
                                        <div class={'ai-search-field-pair flex min-w-0 items-center gap-2'}>
                                            <span class={'ai-search-field-label shrink-0'}>
                                                {$t('file.aiSearchModifiedPreset')}
                                            </span>
                                            <ElSelect
                                                modelValue={unref(aiSearchTimePreset)}
                                                onUpdate:modelValue={($v) => {
                                                    aiSearchTimePreset.value = $v as any;
                                                }}
                                                class={'!w-44 max-w-full shrink-0'}
                                            >
                                                <ElOption label={$t('file.aiSearchTimeAny')} value="any" />
                                                <ElOption label={$t('file.aiSearchTime3h')} value="3h" />
                                                <ElOption label={$t('file.aiSearchTime1d')} value="1d" />
                                                <ElOption label={$t('file.aiSearchTime7d')} value="7d" />
                                                <ElOption label={$t('file.aiSearchTime30d')} value="30d" />
                                                <ElOption label={$t('file.aiSearchTimeCustom')} value="custom" />
                                            </ElSelect>
                                        </div>
                                        {unref(aiSearchTimePreset) === 'custom' ? (
                                            <ElDatePicker
                                                modelValue={unref(aiSearchModifiedRange)}
                                                onUpdate:modelValue={($v) => {
                                                    aiSearchModifiedRange.value = $v as any;
                                                }}
                                                type="datetimerange"
                                                class={'w-full min-w-0 sm:min-w-[16rem] sm:flex-1'}
                                            />
                                        ) : null}
                                    </div>
                                    <div
                                        class={
                                            'flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2'
                                        }
                                    >
                                        <div class={'ai-search-field-pair flex min-w-0 items-center gap-2'}>
                                            <span class={'ai-search-field-label shrink-0'}>
                                                {$t('file.aiSearchSizePresetLabel')}
                                            </span>
                                            <ElSelect
                                                modelValue={unref(aiSearchSizePreset)}
                                                onUpdate:modelValue={($v) => {
                                                    aiSearchSizePreset.value = $v as any;
                                                }}
                                                class={'!w-48 max-w-full shrink-0'}
                                            >
                                                <ElOption label={$t('file.aiSearchSizeAny')} value="any" />
                                                <ElOption label={$t('file.aiSearchSize0_10mb')} value="lte10mb" />
                                                <ElOption label={$t('file.aiSearchSize10_100mb')} value="mb10_100" />
                                                <ElOption label={$t('file.aiSearchSize100_1gb')} value="mb100_1g" />
                                                <ElOption label={$t('file.aiSearchSizeGte1gb')} value="gte1gb" />
                                                <ElOption label={$t('file.aiSearchSizeCustom')} value="custom" />
                                            </ElSelect>
                                        </div>
                                        {unref(aiSearchSizePreset) === 'custom' ? (
                                            <div class={'flex flex-nowrap items-center gap-2 overflow-x-auto'}>
                                                <ElInputNumber
                                                    modelValue={unref(aiSearchMinSize)}
                                                    onUpdate:modelValue={($v) => {
                                                        aiSearchMinSize.value = $v as any;
                                                    }}
                                                    min={0}
                                                    controls={true}
                                                    placeholder={$t('file.aiSearchMinSize')}
                                                    class={'!w-40 shrink-0'}
                                                />
                                                <span class={'shrink-0 text-xs text-[var(--el-text-color-secondary)]'}>
                                                    {'—'}
                                                </span>
                                                <ElInputNumber
                                                    modelValue={unref(aiSearchMaxSize)}
                                                    onUpdate:modelValue={($v) => {
                                                        aiSearchMaxSize.value = $v as any;
                                                    }}
                                                    min={0}
                                                    controls={true}
                                                    placeholder={$t('file.aiSearchMaxSize')}
                                                    class={'!w-40 shrink-0'}
                                                />
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                <ElCollapse
                                    modelValue={unref(aiSearchAdvancedActiveNames)}
                                    onUpdate:modelValue={($v) => {
                                        aiSearchAdvancedActiveNames.value = $v as any;
                                    }}
                                >
                                    <ElCollapseItem
                                        name="limits"
                                        v-slots={{
                                            title: () => (
                                                <>
                                                    <span class={'text-sm font-medium'}>
                                                        {$t('file.aiSearchSectionAdvanced')}
                                                    </span>
                                                </>
                                            ),
                                        }}
                                    >
                                        <div class={'flex flex-col gap-3'}>
                                            <div>
                                                <ElButton
                                                    type="primary"
                                                    link
                                                    onClick={($event?: any) => {
                                                        (resetAiSearchLimitsToDefaults as any)($event);
                                                    }}
                                                >
                                                    {$t('file.aiSearchAdvancedResetDefaults')}
                                                </ElButton>
                                            </div>
                                            <div
                                                class={
                                                    'grid grid-cols-1 items-center gap-x-4 gap-y-3 min-[480px]:grid-cols-2'
                                                }
                                            >
                                                <div class={'ai-search-field-pair flex min-w-0 items-center gap-2'}>
                                                    <span
                                                        class={
                                                            'w-32 shrink-0 text-sm leading-8 text-[var(--el-text-color-secondary)] sm:w-36'
                                                        }
                                                    >
                                                        {$t('file.aiSearchLimitMaxItems')}
                                                    </span>
                                                    <ElInputNumber
                                                        modelValue={unref(aiSearchMaxItems)}
                                                        onUpdate:modelValue={($v) => {
                                                            aiSearchMaxItems.value = $v as any;
                                                        }}
                                                        min={1}
                                                        max={2000}
                                                        controls={true}
                                                        class={'!max-w-full min-w-0 flex-1 sm:!w-52'}
                                                        v-slots={{
                                                            suffix: () => (
                                                                <>
                                                                    <span
                                                                        class={
                                                                            'pr-1 text-xs text-[var(--el-text-color-secondary)]'
                                                                        }
                                                                    >
                                                                        {$t('file.aiSearchLimitUnitEntries')}
                                                                    </span>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </div>
                                                <div class={'ai-search-field-pair flex min-w-0 items-center gap-2'}>
                                                    <span
                                                        class={
                                                            'w-32 shrink-0 text-sm leading-8 text-[var(--el-text-color-secondary)] sm:w-36'
                                                        }
                                                    >
                                                        {$t('file.aiSearchLimitMaxScan')}
                                                    </span>
                                                    <ElInputNumber
                                                        modelValue={unref(aiSearchMaxScanFiles)}
                                                        onUpdate:modelValue={($v) => {
                                                            aiSearchMaxScanFiles.value = $v as any;
                                                        }}
                                                        min={1}
                                                        max={500}
                                                        controls={true}
                                                        class={'!max-w-full min-w-0 flex-1 sm:!w-52'}
                                                        v-slots={{
                                                            suffix: () => (
                                                                <>
                                                                    <span
                                                                        class={
                                                                            'pr-1 text-xs text-[var(--el-text-color-secondary)]'
                                                                        }
                                                                    >
                                                                        {$t('file.aiSearchLimitUnitFiles')}
                                                                    </span>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </div>
                                                <div class={'ai-search-field-pair flex min-w-0 items-center gap-2'}>
                                                    <span
                                                        class={
                                                            'w-32 shrink-0 text-sm leading-8 text-[var(--el-text-color-secondary)] sm:w-36'
                                                        }
                                                    >
                                                        {$t('file.aiSearchLimitMaxBytes')}
                                                    </span>
                                                    <ElInputNumber
                                                        modelValue={unref(aiSearchMaxFileBytes)}
                                                        onUpdate:modelValue={($v) => {
                                                            aiSearchMaxFileBytes.value = $v as any;
                                                        }}
                                                        min={1024}
                                                        max={4194304}
                                                        step={1024}
                                                        controls={true}
                                                        class={'!max-w-full min-w-0 flex-1 sm:!w-52'}
                                                        v-slots={{
                                                            suffix: () => (
                                                                <>
                                                                    <span
                                                                        class={
                                                                            'pr-1 text-xs text-[var(--el-text-color-secondary)]'
                                                                        }
                                                                    >
                                                                        {$t('file.aiSearchLimitUnitBytes')}
                                                                    </span>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </div>
                                                <div class={'ai-search-field-pair flex min-w-0 items-center gap-2'}>
                                                    <span
                                                        class={
                                                            'w-32 shrink-0 text-sm leading-8 text-[var(--el-text-color-secondary)] sm:w-36'
                                                        }
                                                    >
                                                        {$t('file.aiSearchLimitHitsPerFile')}
                                                    </span>
                                                    <ElInputNumber
                                                        modelValue={unref(aiSearchMaxHitsPerFile)}
                                                        onUpdate:modelValue={($v) => {
                                                            aiSearchMaxHitsPerFile.value = $v as any;
                                                        }}
                                                        min={1}
                                                        max={200}
                                                        controls={true}
                                                        class={'!max-w-full min-w-0 flex-1 sm:!w-52'}
                                                        v-slots={{
                                                            suffix: () => (
                                                                <>
                                                                    <span
                                                                        class={
                                                                            'pr-1 text-xs text-[var(--el-text-color-secondary)]'
                                                                        }
                                                                    >
                                                                        {$t('file.aiSearchLimitUnitLines')}
                                                                    </span>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </div>
                                                <div class={'ai-search-field-pair flex min-w-0 items-center gap-2'}>
                                                    <span
                                                        class={
                                                            'w-32 shrink-0 text-sm leading-8 text-[var(--el-text-color-secondary)] sm:w-36'
                                                        }
                                                    >
                                                        {$t('file.aiSearchLimitTotalHits')}
                                                    </span>
                                                    <ElInputNumber
                                                        modelValue={unref(aiSearchMaxTotalHits)}
                                                        onUpdate:modelValue={($v) => {
                                                            aiSearchMaxTotalHits.value = $v as any;
                                                        }}
                                                        min={1}
                                                        max={2000}
                                                        controls={true}
                                                        class={'!max-w-full min-w-0 flex-1 sm:!w-52'}
                                                        v-slots={{
                                                            suffix: () => (
                                                                <>
                                                                    <span
                                                                        class={
                                                                            'pr-1 text-xs text-[var(--el-text-color-secondary)]'
                                                                        }
                                                                    >
                                                                        {$t('file.aiSearchLimitUnitLines')}
                                                                    </span>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </ElCollapseItem>
                                </ElCollapse>
                            </div>
                        </ElCard>
                        {unref(aiSearchResult) ? (
                            <ElCard
                                shadow="never"
                                class={'ai-search-section-card'}
                                v-slots={{
                                    header: () => (
                                        <>
                                            <span class={'text-sm font-medium'}>
                                                {$t('file.aiSearchResultsSection')}
                                            </span>
                                        </>
                                    ),
                                }}
                            >
                                <div class={'flex flex-col gap-3'}>
                                    {unref(aiSearchResult).truncated ? (
                                        <ElAlert type="warning" closable={false} show-icon>
                                            {$t('file.aiSearchTruncated')}
                                        </ElAlert>
                                    ) : null}
                                    {unref(aiSearchResult).preFiltered ? (
                                        <ElAlert type="info" closable={false} show-icon>
                                            {$t('file.aiSearchPreFiltered')}
                                        </ElAlert>
                                    ) : null}
                                    {unref(aiSearchShowAiMeta) ? (
                                        <ElText size="small" type="info" class={'!block'}>
                                            {$t('file.aiSearchMeta', [
                                                unref(aiSearchResult).itemCount,
                                                unref(aiSearchResult).duration,
                                                unref(aiSearchResult).totalTokens,
                                            ])}
                                        </ElText>
                                    ) : unref(aiSearchShowGrepMeta) ? (
                                        <ElText size="small" type="info" class={'!block'}>
                                            {$t('file.aiSearchGrepMetaContent', [
                                                unref(aiSearchResult).itemCount,
                                                unref(aiSearchResult).contentScannedFiles ?? 0,
                                                unref(aiSearchResult).duration,
                                            ])}
                                        </ElText>
                                    ) : null}
                                    {unref(aiSearchShowSummaryPanel) ? (
                                        <div
                                            class={
                                                'ai-search-summary-box rounded-md border border-[var(--el-border-color)] bg-[var(--el-fill-color-blank)] p-3'
                                            }
                                        >
                                            <MkdownEditor content={unref(aiSearchResult).summary} />
                                        </div>
                                    ) : null}
                                    {unref(aiSearchHasHitPanel) ? (
                                        <>
                                            <div class={'text-sm font-medium text-[var(--el-text-color-primary)]'}>
                                                {$t('file.aiSearchContentHits')}
                                            </div>
                                            {(unref(aiSearchResult).contentScannedFiles ?? 0) > 0 &&
                                            unref(aiSearchResult).mode !== 'grep' ? (
                                                <ElText size="small" type="info" class={'!block'}>
                                                    {$t('file.aiSearchContentScanMeta', [
                                                        unref(aiSearchResult).contentScannedFiles,
                                                    ])}
                                                </ElText>
                                            ) : null}
                                            {unref(aiSearchResult).contentHitsTruncated ? (
                                                <ElAlert type="warning" closable={false} show-icon>
                                                    {$t('file.aiSearchHitsTruncated')}
                                                </ElAlert>
                                            ) : null}
                                            {!unref(aiSearchResult).hits?.length &&
                                            (unref(aiSearchResult).contentScannedFiles ?? 0) > 0 ? (
                                                <ElAlert type="info" closable={false} show-icon>
                                                    {$t('file.aiSearchNoLineHits')}
                                                </ElAlert>
                                            ) : null}
                                            {unref(aiSearchResult).hits?.length ? (
                                                <ElRow gutter={12}>
                                                    <ElCol xs={24} sm={10} class={'mb-2 sm:mb-0'}>
                                                        <div
                                                            class={
                                                                'ai-search-hit-col flex flex-col rounded-md border border-[var(--el-border-color)] p-3'
                                                            }
                                                        >
                                                            <div class={'mb-2 shrink-0 text-sm font-medium'}>
                                                                {$t('file.aiSearchHitFiles')}
                                                            </div>
                                                            <ElScrollbar max-height="200" class={'min-h-0 flex-1'}>
                                                                {(unref(aiSearchHitPaths) || []).map((p) => (
                                                                    <div
                                                                        title={p}
                                                                        onClick={($event?: any) => {
                                                                            aiSearchSelectedHitPath.value = p;
                                                                        }}
                                                                        class={cn(
                                                                            'cursor-pointer truncate rounded px-2 py-1.5 text-sm transition-colors',
                                                                            hitFileRowClass(p),
                                                                        )}
                                                                        key={p}
                                                                    >
                                                                        {p.split('/').pop() || p}
                                                                    </div>
                                                                ))}
                                                            </ElScrollbar>
                                                            <ElButton
                                                                type="primary"
                                                                link
                                                                disabled={!unref(aiSearchSelectedHitPath)}
                                                                onClick={($event?: any) => {
                                                                    ctx.emit('open-editor', {
                                                                        path: unref(aiSearchSelectedHitPath),
                                                                        initialLine:
                                                                            unref(aiSearchHitsForSelected)[0]?.line &&
                                                                            unref(aiSearchHitsForSelected)[0].line > 0
                                                                                ? unref(aiSearchHitsForSelected)[0].line
                                                                                : undefined,
                                                                    });
                                                                }}
                                                                class={'mt-2 mb-1 shrink-0'}
                                                            >
                                                                {$t('file.aiSearchOpenFile')}
                                                            </ElButton>
                                                        </div>
                                                    </ElCol>
                                                    <ElCol xs={24} sm={14}>
                                                        <div
                                                            class={
                                                                'ai-search-hit-col flex flex-col rounded-md border border-[var(--el-border-color)] p-3'
                                                            }
                                                        >
                                                            <div class={'mb-2 shrink-0 text-sm font-medium'}>
                                                                {$t('file.aiSearchHitLines')}
                                                            </div>
                                                            <ElScrollbar max-height="220" class={'min-h-0 flex-1'}>
                                                                {(unref(aiSearchHitsForSelected) || []).map(
                                                                    (h, idx) => (
                                                                        <div
                                                                            class={
                                                                                'flex flex-col gap-1 border-0 border-b border-solid border-[var(--el-border-color-lighter)] py-2 text-xs sm:flex-row sm:items-start sm:justify-between'
                                                                            }
                                                                            key={idx}
                                                                        >
                                                                            <div class={'min-w-0 flex-1'}>
                                                                                <span
                                                                                    class={
                                                                                        'mr-2 shrink-0 text-[var(--el-text-color-secondary)] tabular-nums'
                                                                                    }
                                                                                >
                                                                                    {h.line > 0 ? h.line : '—'}
                                                                                </span>
                                                                                <span class={'font-mono break-all'}>
                                                                                    {h.text}
                                                                                </span>
                                                                            </div>
                                                                            <ElButton
                                                                                type="primary"
                                                                                link
                                                                                onClick={($event?: any) => {
                                                                                    ctx.emit('open-editor', {
                                                                                        path: h.path,
                                                                                        initialLine:
                                                                                            h.line > 0
                                                                                                ? h.line
                                                                                                : undefined,
                                                                                    });
                                                                                }}
                                                                                class={'shrink-0 !p-0 sm:!ml-2'}
                                                                            >
                                                                                {h.line > 0
                                                                                    ? $t('file.aiSearchOpenAtLine')
                                                                                    : $t('file.aiSearchOpenFile')}
                                                                            </ElButton>
                                                                        </div>
                                                                    ),
                                                                )}
                                                            </ElScrollbar>
                                                        </div>
                                                    </ElCol>
                                                </ElRow>
                                            ) : null}
                                        </>
                                    ) : null}
                                </div>
                            </ElCard>
                        ) : null}
                    </div>,
                    [[vLoading, unref(drawerContentBusy)]],
                )}
            </ElDrawer>
        );
    },
    options,
);
