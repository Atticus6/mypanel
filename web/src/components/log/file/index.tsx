import { $t } from '@/utils/i18n-t';
import { nextTick, onMounted, onUnmounted, reactive, ref, computed } from 'vue';
import { downloadFile } from '@/utils/file';
import { rpc } from '@/lib/rpc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import bus from '@/global/bus';
import Highlight from '@/components/log/custom-highlight/index';
import { translateTaskText } from '@/utils/task';
interface LogProps {
    id?: number;
    type?: string;
    name?: string;
    tail?: boolean;
    taskID?: string;
    colorMode?: string;
    taskType?: string;
    taskOperate?: string;
    resourceID?: number;

    operateNode?: string;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElCheckbox } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    config?: LogProps | null;
    defaultButton?: boolean;
    loading?: boolean;
    hasContent?: boolean;
    heightDiff?: number;
    showTail?: boolean;
    showDownload?: boolean;
}

const emits = {
    'update:loading': (...args: unknown[]) => true,
    'update:hasContent': (...args: unknown[]) => true,
    'update:isReading': (...args: unknown[]) => true,
    'stop-reading': (...args: unknown[]) => true,
};

type SlotsShape = {
    button: (arg?: unknown) => VNode[];
};

const options = {
    name: 'file',
    props: {
        config: {
            type: Object as () => LogProps | null,
            default: () => ({
                id: 0,
                type: '',
                name: '',
                tail: false,
                colorMode: 'nginx',
                taskType: '',
                taskOperate: '',
                resourceID: 0,
                taskID: '',

                operateNode: '',
            }),
        },
        defaultButton: {
            type: Boolean,
            default: true,
        },
        loading: {
            type: Boolean,
            default: true,
        },
        hasContent: {
            type: Boolean,
            default: false,
        },
        heightDiff: {
            type: Number,
            default: 420,
        },
        showTail: {
            type: Boolean,
            default: true,
        },
        showDownload: {
            type: Boolean,
            default: true,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-880572ba',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const stopSignals = [
            'docker-compose up failed!',
            'docker-compose up successful!',
            'image build failed!',
            'image build successful!',
            'image pull failed!',
            'image pull successful!',
            'image push failed!',
            'image push successful!',
            '[TASK-END]',
        ];
        const tailLog = ref(true);
        const loading = ref(__panelSetupProps.loading);
        const readReq = reactive({
            id: 0,
            type: '',
            name: '',
            page: 1,
            pageSize: 500,
            latest: false,
            taskID: '',
            taskType: '',
            taskOperate: '',
            resourceID: 0,
        });
        const isLoading = ref(false);
        const end = ref(false);
        const lastLogs = ref([]);
        const maxPage = ref(0);
        const minPage = ref(0);
        let timer: ReturnType<typeof setInterval> | null = null;
        const logPath = ref('');
        const showTail = ref(false);
        const isTailDisabled = ref();
        const firstLoading = ref(false);
        const logs = ref<string[]>([]);
        const logContainer = ref<HTMLElement | null>(null);
        const isTaskMode = computed(() => __panelSetupProps.config.colorMode === 'task');
        const logHeight = computed(() => (isTaskMode.value ? 16 : 23));
        const containerHeight = ref(500);
        const scrollTop = ref(0);
        const lastScrollTop = ref(0);
        const totalLines = ref(0);
        const totalPages = ref(0);
        let resizeObserver: ResizeObserver | null = null;
        const isEndOfFile = ref(false);
        const totalHeight = computed(() => logs.value.length * logHeight.value);
        const visibleCount = computed(() => {
            const buffer = 5;
            return Math.ceil(containerHeight.value / logHeight.value) + buffer * 2;
        });
        const startIndex = computed(() => {
            const buffer = 5;
            const index = Math.floor(scrollTop.value / logHeight.value) - buffer;
            return Math.max(0, index);
        });
        const endIndex = computed(() => {
            return Math.min(logs.value.length, startIndex.value + visibleCount.value);
        });
        const visibleLogs = computed(() => {
            return logs.value.slice(startIndex.value, endIndex.value);
        });
        const offsetY = computed(() => {
            return startIndex.value * logHeight.value;
        });
        const updateContainerHeight = () => {
            if (logContainer.value) {
                const rect = logContainer.value.getBoundingClientRect();
                containerHeight.value = rect.height;
            }
        };
        const onScroll = async () => {
            if (!logContainer.value) return;

            scrollTop.value = logContainer.value.scrollTop;
            const scrollHeight = logContainer.value.scrollHeight;
            const clientHeight = logContainer.value.clientHeight;

            lastScrollTop.value = scrollTop.value;

            if (isLoading.value) return;

            if (scrollTop.value <= 50 && readReq.page > 1) {
                if (minPage.value <= 1) {
                    return;
                }
                readReq.page = minPage.value > 1 ? minPage.value - 1 : 1;
                minPage.value = readReq.page;
                await getContent(true);
                return;
            }
            if (scrollHeight - scrollTop.value - clientHeight <= 50 && !end.value && !isEndOfFile.value) {
                if (readReq.page < maxPage.value) {
                    readReq.page = maxPage.value;
                    await getContent(false);
                } else if (readReq.page < totalPages.value) {
                    maxPage.value++;
                    readReq.page = maxPage.value;
                    await getContent(false);
                }
            }
        };
        const changeLoading = () => {
            loading.value = !loading.value;
            ctx.emit('update:loading', loading.value);
        };
        const onDownload = async () => {
            changeLoading();
            downloadFile(logPath.value, __panelSetupProps.config.operateNode || currentNode.value);
            changeLoading();
        };
        const changeTail = (fromOutSide: boolean) => {
            if (fromOutSide) {
                tailLog.value = !tailLog.value;
            }
            if (tailLog.value) {
                timer = setInterval(() => {
                    getContent(false);
                }, 1000 * 3);
            } else {
                onCloseLog();
            }
        };
        const clearLog = (): void => {
            logs.value = [];
            scrollTop.value = 0;
            readReq.page = 1;
            lastLogs.value = [];
        };
        const getContent = async (pre: boolean) => {
            if (isLoading.value) {
                return;
            }
            if (readReq.page < 1) {
                readReq.page = 1;
            }
            isLoading.value = true;
            ctx.emit('update:isReading', true);
            const requestedPage = readReq.page;

            let res: {
                end: boolean;
                path: string;
                total: number;
                taskStatus: string;
                lines: string[];
                scope: string;
                totalLines: number;
            };
            try {
                const operateNode = __panelSetupProps.config.operateNode || currentNode.value;
                if (readReq.type === 'task') {
                    res = await rpc.log.readTaskLogs({
                        page: readReq.page,
                        pageSize: readReq.pageSize,
                        latest: readReq.latest,
                        taskId: readReq.taskID,
                        taskType: readReq.taskType,
                        taskOperate: readReq.taskOperate,
                        resourceId: readReq.resourceID,
                    });
                } else if (readReq.type === 'website') {
                    // 网站日志已迁移到 RPC；把返回的 content 适配成通用日志组件需要的数据结构。
                    const log = await rpc.website.getLog({
                        id: readReq.id,
                        logType: readReq.name,
                        page: readReq.page,
                        pageSize: readReq.pageSize,
                    });
                    const lines = log.content ? log.content.split('\n') : [];
                    res = {
                        lines,
                        totalLines: (requestedPage - 1) * readReq.pageSize + lines.length,
                        total: log.end ? requestedPage : requestedPage + 1,
                        end: log.end,
                        path: log.path,
                        scope: '',
                        taskStatus: '',
                    };
                } else {
                    res = await rpc.file.readFileLines({
                        id: readReq.id,
                        type: readReq.type,
                        name: readReq.name,
                        page: readReq.page,
                        pageSize: readReq.pageSize,
                        latest: readReq.latest,
                        taskId: readReq.taskID,
                        taskType: readReq.taskType,
                        taskOperate: readReq.taskOperate,
                        resourceId: readReq.resourceID,
                    });
                }
            } catch (error) {
                isLoading.value = false;
                firstLoading.value = false;
                return;
            }

            totalLines.value = res.totalLines;

            if (res.scope == 'tail') {
                showTail.value = false;
            }

            if (res.taskStatus && res.taskStatus !== 'Executing') {
                isTailDisabled.value = true;
            }

            logPath.value = res.path;
            firstLoading.value = false;

            if (!end.value && res.end) {
                lastLogs.value = [...logs.value];
            }
            if (res.lines && res.lines.length > 0) {
                res.lines = res.lines.map((line) =>
                    line.replace(/\\u(\w{4})/g, function (match, grp) {
                        return String.fromCharCode(parseInt(grp, 16));
                    }),
                );
                const newLogs = res.lines.map((line) => translateTaskText(line));
                if (tailLog.value && newLogs.length === readReq.pageSize && readReq.page < res.total) {
                    readReq.page++;
                }
                if (
                    readReq.type == 'php' &&
                    logs.value.length > 0 &&
                    newLogs.length > 0 &&
                    newLogs[newLogs.length - 1] === logs.value[logs.value.length - 1]
                ) {
                    isLoading.value = false;
                    return;
                }

                if (stopSignals.some((signal) => newLogs[newLogs.length - 1].endsWith(signal))) {
                    onCloseLog();
                }

                if (logs.value.length == 0) {
                    logs.value = newLogs;
                } else {
                    if (pre) {
                        logs.value = [...newLogs, ...logs.value];
                    } else {
                        if (end.value) {
                            logs.value = [...lastLogs.value, ...newLogs];
                        } else {
                            if (newLogs.length > logs.value.length) {
                                logs.value = newLogs;
                            } else {
                                logs.value = [...logs.value, ...newLogs];
                            }
                        }
                    }
                }

                nextTick(() => {
                    if (logContainer.value) {
                        if (pre) {
                            if (readReq.page > 1) {
                                const addedLines = newLogs.length;
                                const newScrollPosition = lastScrollTop.value + addedLines * logHeight.value;
                                logContainer.value.scrollTop = newScrollPosition;
                            }
                        } else {
                            logContainer.value.scrollTop = logContainer.value.scrollHeight;
                        }
                    }
                });
            }

            end.value = res.end;
            totalPages.value = res.total;
            ctx.emit('update:hasContent', logs.value.length > 0);
            if (readReq.latest) {
                readReq.page = res.total;
                readReq.latest = false;
                maxPage.value = res.total;
                isEndOfFile.value = true;
                if (res.lines && res.lines.length > 500) {
                    minPage.value = res.total - 1;
                } else {
                    minPage.value = res.total;
                }
            } else {
                maxPage.value = Math.max(maxPage.value, readReq.page);
            }
            if (logs.value && logs.value.length > 3000) {
                const removedCount = readReq.pageSize;
                const currentScrollRatio = scrollTop.value / (logs.value.length * logHeight.value);

                if (pre) {
                    logs.value.splice(logs.value.length - removedCount, removedCount);
                    if (maxPage.value > 1) {
                        maxPage.value--;
                    }
                } else {
                    isEndOfFile.value = false;
                    logs.value.splice(0, removedCount);
                    nextTick(() => {
                        if (logContainer.value) {
                            const newScrollTop = currentScrollRatio * (logs.value.length * logHeight.value);
                            logContainer.value.scrollTop = Math.max(0, newScrollTop - removedCount * logHeight.value);
                        }
                    });
                    if (minPage.value > 1) {
                        minPage.value++;
                    }
                }
            }
            isLoading.value = false;
            if (readReq.type === 'task' && res.taskStatus && res.taskStatus !== 'Executing') {
                if (!pre && !res.end && res.scope !== 'tail' && requestedPage < res.total) {
                    readReq.page = requestedPage + 1;
                    await getContent(false);
                } else {
                    onCloseLog();
                }
            }
        };
        const onCloseLog = async () => {
            tailLog.value = false;
            if (timer) {
                clearInterval(Number(timer));
                timer = null;
            }
            timer = null;
            ctx.emit('stop-reading');
            isLoading.value = false;
            ctx.emit('update:isReading', false);
            bus.emit('refreshTask', true);
        };
        watch(
            () => __panelSetupProps.loading,
            (newLoading) => {
                loading.value = newLoading;
            },
        );
        const init = async () => {
            tailLog.value = false;
            if (__panelSetupProps.config.tail) {
                tailLog.value = __panelSetupProps.config.tail;
            }
            if (tailLog.value) {
                changeTail(false);
            }
            readReq.latest = true;
            await getContent(false);
            if (readReq.page > 1 && totalPages.value == maxPage.value) {
                readReq.page--;
                await getContent(true);
            }
        };
        const containerStyle = computed(() => ({
            height: `calc(100vh - ${__panelSetupProps.heightDiff}px)`,
        }));
        onMounted(async () => {
            showTail.value = __panelSetupProps.showTail;
            logs.value = [];
            isTailDisabled.value = false;
            firstLoading.value = true;
            readReq.id = __panelSetupProps.config.id;
            readReq.type = __panelSetupProps.config.type;
            readReq.name = __panelSetupProps.config.name;
            readReq.taskID = __panelSetupProps.config.taskID;
            readReq.taskType = __panelSetupProps.config.taskType;
            readReq.taskOperate = __panelSetupProps.config.taskOperate;
            readReq.resourceID = __panelSetupProps.config.resourceID;
            await init();

            updateContainerHeight();

            if (logContainer.value) {
                resizeObserver = new ResizeObserver(() => {
                    updateContainerHeight();
                });
                resizeObserver.observe(logContainer.value);
            }

            nextTick(() => {
                if (logContainer.value) {
                    logContainer.value.scrollTop = logContainer.value.scrollHeight;
                }
            });
        });
        onUnmounted(() => {
            onCloseLog();
            resizeObserver?.disconnect();
        });
        ctx.expose({ changeTail, onDownload, clearLog });
        return () =>
            withDirectives(
                <div>
                    {__panelSetupProps.defaultButton ? (
                        <div>
                            {!unref(showTail) ? (
                                <ElButton
                                    icon="Refresh"
                                    onClick={($event?: any) => {
                                        getContent(false);
                                    }}
                                >
                                    {$t('commons.button.refresh')}
                                </ElButton>
                            ) : null}
                            {unref(showTail) ? (
                                <ElCheckbox
                                    border
                                    disabled={unref(isTailDisabled)}
                                    modelValue={unref(tailLog)}
                                    onUpdate:modelValue={($v) => {
                                        tailLog.value = $v as any;
                                    }}
                                    onChange={($event?: any) => {
                                        changeTail(false);
                                    }}
                                    class={'float-left'}
                                >
                                    {$t('commons.button.watch')}
                                </ElCheckbox>
                            ) : null}
                            {__panelSetupProps.showDownload ? (
                                <ElButton
                                    onClick={($event?: any) => {
                                        (onDownload as any)($event);
                                    }}
                                    icon="Download"
                                    disabled={unref(logs).length === 0}
                                    class={'ml-2.5'}
                                >
                                    {$t('commons.button.download')}
                                </ElButton>
                            ) : null}
                            {ctx.slots.button ? <span class={'ml-2.5'}>{ctx.slots['button']?.(undefined)}</span> : null}
                        </div>
                    ) : null}
                    <div
                        ref={logContainer}
                        onScroll={($event?: any) => {
                            (onScroll as any)($event);
                        }}
                        class={['log-container', { 'task-mode': unref(isTaskMode) }]}
                        style={unref(containerStyle)}
                    >
                        <div class={'log-spacer'} style={{ height: `${totalHeight}px` }} />
                        <div class={'log-viewport'} style={{ transform: `translateY(${offsetY}px)` }}>
                            {(unref(visibleLogs) || []).map((log, index) => (
                                <div
                                    class={['log-item', { 'task-mode': unref(isTaskMode) }]}
                                    style={{ height: `${logHeight}px` }}
                                    key={`${unref(startIndex) + index}-${log}`}
                                >
                                    <Highlight log={log} type={__panelSetupProps.config.colorMode ?? 'nginx'} />
                                </div>
                            ))}
                        </div>
                        {unref(logs).length === 0 ? <Highlight log={$t('commons.log.noLog')} type="system" /> : null}
                    </div>
                </div>,
                [[vLoading, unref(firstLoading)]],
            );
    },
    options,
);
