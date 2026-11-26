import { $t } from '@/utils/i18n-t';
import { DownloadFile } from '@/api/modules/container';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { Base64 } from 'js-base64';
import '@xterm/xterm/css/xterm.css';
import i18n from '@/lang';
import { dateFormatForName } from '@/utils/date';
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';
import { ElMessageBox } from 'element-plus';
import { MsgError, MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { checkStreamAuth } from '@/utils/stream-auth';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
    container?: string;
    compose?: string;
    resource?: string;
    highlightDiff?: number;
    node?: string;
    showControl?: boolean;
    defaultFollow?: boolean;
    defaultIsShowTimestamp?: boolean;
}

const emits = {
    'update:loading': (...args: unknown[]) => true,
};

const options = {
    name: 'container',
    props: {
        container: {
            type: String,
            default: '',
        },
        compose: {
            type: String,
            default: '',
        },
        resource: {
            type: String,
            default: '',
        },
        highlightDiff: {
            type: Number,
            default: 320,
        },
        node: {
            type: String,
            default: '',
        },
        showControl: {
            type: Boolean,
            default: true,
        },
        defaultFollow: {
            type: Boolean,
            default: false,
        },
        defaultIsShowTimestamp: {
            type: Boolean,
            default: false,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-036353a2',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode: globalCurrentNode } = useGlobalStore();
        const styleVars = computed(() => ({
            '--custom-height': `${__panelSetupProps.highlightDiff || 320}px`,
        }));
        const terminalElement = ref<HTMLDivElement | null>(null);
        let eventSource: EventSource | null = null;
        let searchVersion = 0;
        let term: Terminal | null = null;
        const fitAddon = new FitAddon();
        const MAX_VIEW_LINES = 20000;
        let followBottom = true;
        const logSearch = reactive({
            isWatch: true,
            isShowTimestamp: __panelSetupProps.defaultIsShowTimestamp,
            container: '',
            mode: 'all',
            tail: __panelSetupProps.defaultFollow ? 0 : 100,
            compose: '',
            resource: '',
        });
        const downloadDialogVisible = ref(false);
        const downloadForm = reactive<{ mode: string; tail: number | string }>({
            mode: 'all',
            tail: 0,
        });
        const timeOptions = ref([
            { label: i18n.global.t('commons.table.all'), value: 'all' },
            {
                label: i18n.global.t('container.lastDay'),
                value: '24h',
            },
            {
                label: i18n.global.t('container.last4Hour'),
                value: '4h',
            },
            {
                label: i18n.global.t('container.lastHour'),
                value: '1h',
            },
            {
                label: i18n.global.t('container.last10Min'),
                value: '10m',
            },
        ]);
        const stopListening = () => {
            searchVersion++;
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
        };
        const clearTerminal = () => {
            // Queue the reset after pending writes so old logs cannot appear in a new search.
            term?.write('\x1bc');
            followBottom = true;
        };
        const showEventSourceAuthError = (message: string) => {
            MsgError(message);
            term?.writeln(message);
        };
        const initTerminal = () => {
            if (!terminalElement.value || term) return;
            term = new Terminal({
                cursorBlink: false,
                cursorStyle: 'block',
                disableStdin: true,
                convertEol: true,
                scrollback: MAX_VIEW_LINES,
                fontSize: 14,
                fontFamily: "'JetBrains Mono', Monaco, Menlo, Consolas, 'Courier New', monospace",
                fontWeight: '500',
                lineHeight: 1.2,
                theme: {
                    background: '#111827',
                    foreground: '#e5e7eb',
                    cursor: '#e5e7eb',
                    black: '#111827',
                    brightBlack: '#6b7280',
                    red: '#f87171',
                    green: '#34d399',
                    yellow: '#fbbf24',
                    blue: '#60a5fa',
                    magenta: '#c084fc',
                    cyan: '#22d3ee',
                    white: '#e5e7eb',
                    brightWhite: '#f9fafb',
                    selectionBackground: 'rgba(102, 178, 255, 0.30)',
                    selectionInactiveBackground: 'rgba(102, 178, 255, 0.20)',
                },
            });
            term.open(terminalElement.value);
            term.loadAddon(fitAddon);
            fitAddon.fit();
            // Terminal.dispose() also disposes these listeners.
            term.onScroll(() => {
                if (!term) return;
                const active = term.buffer.active;
                followBottom = active.viewportY >= active.baseY;
            });
            term.onWriteParsed(() => {
                if (followBottom) term?.scrollToBottom();
            });
        };
        const searchLogs = async () => {
            if (Number(logSearch.tail) < 0) {
                MsgError(i18n.global.t('container.linesHelper'));
                return;
            }
            stopListening();
            const version = searchVersion;
            clearTerminal();

            let currentNode = globalCurrentNode.value;
            if (__panelSetupProps.node && __panelSetupProps.node !== '') {
                currentNode = __panelSetupProps.node;
            }

            let url = `/api/v2/containers/search/log?container=${logSearch.container}&since=${logSearch.mode}&tail=${logSearch.tail}&follow=${logSearch.isWatch}&timestamp=${logSearch.isShowTimestamp}&operateNode=${currentNode}`;
            if (logSearch.compose !== '') {
                url = `/api/v2/containers/search/log?compose=${logSearch.compose}&since=${logSearch.mode}&tail=${logSearch.tail}&follow=${logSearch.isWatch}&timestamp=${logSearch.isShowTimestamp}&operateNode=${currentNode}`;
            }

            const authError = await checkStreamAuth(url, currentNode);
            if (version !== searchVersion) return;
            if (authError) {
                showEventSourceAuthError(authError);
                return;
            }
            const source = new EventSource(url);
            eventSource = source;
            source.onmessage = (event: MessageEvent) => {
                if (version !== searchVersion) return;
                term?.write(Base64.toUint8Array(event.data));
            };
            source.onerror = (event: MessageEvent) => {
                if (version !== searchVersion) return;
                stopListening();
                if (event.data && event.data != '') {
                    MsgError(event.data);
                }
            };
        };
        const openDownloadDialog = () => {
            downloadForm.mode = logSearch.mode;
            downloadForm.tail = logSearch.tail;
            downloadDialogVisible.value = true;
        };
        const onDownload = async () => {
            const customTail = Number(downloadForm.tail);
            if (Number.isNaN(customTail) || customTail < 0) {
                MsgError(i18n.global.t('container.linesHelper'));
                return;
            }
            const container = logSearch.compose === '' ? logSearch.container : logSearch.compose;
            let resource = container;
            if (__panelSetupProps.resource) {
                resource = __panelSetupProps.resource;
            }
            const containerType = logSearch.compose === '' ? 'container' : 'compose';
            const params = {
                container: container,
                since: downloadForm.mode,
                tail: customTail,
                timestamp: logSearch.isShowTimestamp,
                containerType: containerType,
            };
            const addItem = {};
            addItem['name'] = resource + '-' + dateFormatForName(new Date()) + '.log';
            DownloadFile(params).then((res) => {
                const downloadUrl = window.URL.createObjectURL(new Blob([res]));
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = downloadUrl;
                a.download = addItem['name'];
                const event = new MouseEvent('click');
                a.dispatchEvent(event);
            });
            downloadDialogVisible.value = false;
        };
        const onClean = async () => {
            ElMessageBox.confirm(i18n.global.t('container.cleanLogHelper'), i18n.global.t('container.cleanLog'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                let currentNode = globalCurrentNode.value;
                if (__panelSetupProps.node && __panelSetupProps.node !== '') {
                    currentNode = __panelSetupProps.node;
                }
                if (logSearch.compose !== '') {
                    ctx.emit('update:loading', true);
                    await rpc.container
                        .cleanComposeLogs({ name: logSearch.resource, path: logSearch.compose })
                        .then(() => {
                            ctx.emit('update:loading', false);
                            searchLogs();
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        })
                        .finally(() => {
                            ctx.emit('update:loading', false);
                        });
                    return;
                }
                await rpc.container.cleanLogs({ name: logSearch.container });
                searchLogs();
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            });
        };
        const resizeObserver = ref<ResizeObserver | null>(null);
        onMounted(() => {
            logSearch.container = __panelSetupProps.container;
            logSearch.compose = __panelSetupProps.compose;
            logSearch.resource = __panelSetupProps.resource;

            logSearch.tail = 100;

            nextTick(() => {
                initTerminal();
                if (terminalElement.value) {
                    resizeObserver.value = new ResizeObserver(() => {
                        fitAddon.fit();
                    });
                    resizeObserver.value.observe(terminalElement.value);
                }
                searchLogs();
            });
        });
        onUnmounted(() => {
            stopListening();
            if (term) {
                term.dispose();
                term = null;
            }
            resizeObserver.value?.disconnect();
        });
        return () => (
            <>
                {__panelSetupProps.showControl ? (
                    <div class={'log-toolbar'}>
                        <ElSelect
                            onChange={($event?: any) => {
                                (searchLogs as any)($event);
                            }}
                            modelValue={logSearch.mode}
                            onUpdate:modelValue={($v) => {
                                logSearch.mode = $v as any;
                            }}
                            class={'fetchClass'}
                            v-slots={{ prefix: () => <>{$t('container.fetch')}</> }}
                        >
                            {(unref(timeOptions) || []).map((item) => (
                                <ElOption value={item.value} label={item.label} key={item.label} />
                            ))}
                        </ElSelect>
                        <ElSelect
                            onChange={($event?: any) => {
                                (searchLogs as any)($event);
                            }}
                            modelValue={logSearch.tail}
                            onUpdate:modelValue={($v) => {
                                logSearch.tail = $v === '' ? $v : Number($v);
                            }}
                            class={'tailClass'}
                            v-slots={{ prefix: () => <>{$t('container.lines')}</> }}
                        >
                            <ElOption value={0} label={$t('commons.table.all')} />
                            <ElOption value={100} label={100} />
                            <ElOption value={200} label={200} />
                            <ElOption value={500} label={500} />
                            <ElOption value={1000} label={1000} />
                        </ElSelect>
                        <div class={'margin-button float-left'}>
                            <ElCheckbox
                                border
                                onChange={($event?: any) => {
                                    (searchLogs as any)($event);
                                }}
                                modelValue={logSearch.isWatch}
                                onUpdate:modelValue={($v) => {
                                    logSearch.isWatch = $v as any;
                                }}
                            >
                                {$t('commons.button.watch')}
                            </ElCheckbox>
                        </div>
                        <div class={'margin-button float-left'}>
                            <ElCheckbox
                                border
                                onChange={($event?: any) => {
                                    (searchLogs as any)($event);
                                }}
                                modelValue={logSearch.isShowTimestamp}
                                onUpdate:modelValue={($v) => {
                                    logSearch.isShowTimestamp = $v as any;
                                }}
                            >
                                {$t('commons.table.date')}
                            </ElCheckbox>
                        </div>
                        <ElButton
                            onClick={($event?: any) => {
                                (openDownloadDialog as any)($event);
                            }}
                            icon="Download"
                            class={'margin-button'}
                        >
                            {$t('commons.button.download')}
                        </ElButton>
                        {withDirectives(
                            <ElButton
                                onClick={($event?: any) => {
                                    (onClean as any)($event);
                                }}
                                icon="Delete"
                                class={'margin-button'}
                            >
                                {$t('commons.button.clean')}
                            </ElButton>,
                            [[permissionDirective, 'container_manage']],
                        )}
                    </div>
                ) : null}
                <div class={'log-container'} style={unref(styleVars)}>
                    <div ref={terminalElement} class={'xterm-log-viewer'} />
                </div>
                <DialogPro
                    modelValue={unref(downloadDialogVisible)}
                    onUpdate:modelValue={($v) => {
                        downloadDialogVisible.value = $v as any;
                    }}
                    title={$t('commons.button.download')}
                    size="small"
                    close-on-click-modal={true}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        downloadDialogVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (onDownload as any)($event);
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    <ElForm label-position="top">
                        <ElFormItem label={$t('container.fetch')}>
                            <ElSelect
                                modelValue={downloadForm.mode}
                                onUpdate:modelValue={($v) => {
                                    downloadForm.mode = $v as any;
                                }}
                                class={'w-full'}
                            >
                                {(unref(timeOptions) || []).map((item) => (
                                    <ElOption value={item.value} label={item.label} key={item.label} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('container.lines')}>
                            <ElSelect
                                modelValue={downloadForm.tail}
                                onUpdate:modelValue={($v) => {
                                    downloadForm.tail = $v as any;
                                }}
                                filterable
                                allow-create
                                default-first-option
                                reserve-keyword={false}
                                class={'w-full'}
                            >
                                <ElOption value={0} label={$t('commons.table.all')} />
                                <ElOption value={100} label={100} />
                                <ElOption value={200} label={200} />
                                <ElOption value={500} label={500} />
                                <ElOption value={1000} label={1000} />
                            </ElSelect>
                            <div class={'download-tail-helper'}>{$t('container.downloadLinesHelper')}</div>
                        </ElFormItem>
                    </ElForm>
                </DialogPro>
            </>
        );
    },
    options,
);
