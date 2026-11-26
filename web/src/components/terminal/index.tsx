import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { FitAddon } from '@xterm/addon-fit';
import { decodeBase64, encodeBase64 } from '@/utils/base64';
import { TerminalStore } from '@/store';
import { MsgError } from '@/utils/message';
import { checkStreamAuth } from '@/utils/stream-auth';
import { useGlobalStore } from '@/composables/useGlobalStore';
import i18n from '@/lang';
interface WsProps {
    endpoint: string;
    args: string;
    error: string;
    initCmd: string;
    waitForPrompt?: string;
    sessionId?: string;
}
interface TerminalBufferLine {
    isWrapped?: boolean;
    translateToString(trimRight?: boolean, startColumn?: number, endColumn?: number): string;
}
import './index.styles.css';
import { cn } from '@/utils/cn';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    session: (...args: unknown[]) => true,
    expired: (...args: unknown[]) => true,
    reconnect: (...args: unknown[]) => true,
};

const options = {
    name: 'terminal',
    props: {},
    emits: emits,
    __scopeId: 'data-v-1a529c99',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const CLOSE_SESSION_NOT_FOUND = 4404;
        const CLOSE_ATTACHED_ELSEWHERE = 4409;
        const CLOSE_REVALIDATE = 4410;
        const terminalElement = ref<HTMLDivElement | null>(null);
        const fitAddon = new FitAddon();
        const termReady = ref(false);
        const webSocketReady = ref(false);
        const term = shallowRef<Terminal>();
        const terminalSocket = ref<WebSocket>();
        const heartbeatTimer = ref<NodeJS.Timer>();
        let initWebSocketToken = 0;
        const latency = ref(0);
        const sessionId = ref('');
        let wsEndpoint = '';
        let wsArgs = '';
        let closing = false;
        let reconnecting = false;
        let reconnectNoticeShown = false;
        let revalidating = false;
        let expired = false;
        let reconnectStartedAt = 0;
        let reconnectDelay = 1000;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        const reconnectWindow = 30 * 60 * 1000;
        const initCmd = ref('');
        const hideInitCmdEcho = ref(false);
        const initCmdEchoBuffer = ref('');
        const waitForPrompt = ref('');
        const waitForPromptBuffer = ref('');
        const aiNotice = ref({
            visible: false,
            loading: false,
            level: 'info',
            message: '',
        });
        let aiNoticeTimer: ReturnType<typeof setTimeout> | null = null;
        let resizeFrame: number | undefined;
        let lastResizeColumns = 0;
        let lastResizeRows = 0;
        const readyWatcher = watch(
            () => webSocketReady.value && termReady.value,
            (ready) => {
                if (ready) {
                    changeTerminalSize();
                    readyWatcher(); // unwatch self
                }
            },
        );
        const terminalStore = TerminalStore();
        const lineHeight = computed(() => terminalStore.lineHeight);
        const fontSize = computed(() => terminalStore.fontSize);
        const fontFamily = computed(() => terminalStore.fontFamily);
        const backgroundColor = computed(() => terminalStore.backgroundColor);
        const foregroundColor = computed(() => terminalStore.foregroundColor);
        const letterSpacing = computed(() => terminalStore.letterSpacing);
        watch(
            [lineHeight, fontSize, letterSpacing, fontFamily],
            ([newLineHeight, newFontSize, newLetterSpacing, newFontFamily]) => {
                if (!term.value) return;
                term.value.options.lineHeight = newLineHeight;
                term.value.options.letterSpacing = newLetterSpacing;
                term.value.options.fontSize = newFontSize;
                term.value.options.fontFamily = newFontFamily;
                changeTerminalSize();
            },
        );
        watch([backgroundColor, foregroundColor], ([newBackgroundColor, newForegroundColor]) => {
            if (!term.value) return;
            term.value.options.theme = {
                ...(term.value.options.theme || {}),
                background: newBackgroundColor,
                foreground: newForegroundColor,
            };
            applyTerminalBackground(newBackgroundColor);
        });
        const cursorStyle = computed(() => terminalStore.cursorStyle);
        watch(cursorStyle, () => {
            if (!term.value) return;
            term.value.options.cursorStyle = getStyle();
        });
        const cursorBlink = computed(() => terminalStore.cursorBlink);
        watch(cursorBlink, (newCursorBlink) => {
            if (!term.value) return;
            term.value.options.cursorBlink = String(newCursorBlink).toLowerCase() === 'enable';
        });
        const scrollback = computed(() => terminalStore.scrollback);
        watch(scrollback, (newScrollback) => {
            if (!term.value) return;
            term.value.options.scrollback = newScrollback;
        });
        const scrollSensitivity = computed(() => terminalStore.scrollSensitivity);
        watch(scrollSensitivity, (newScrollSensitivity) => {
            if (!term.value) return;
            term.value.options.scrollSensitivity = newScrollSensitivity;
        });
        const acceptParams = (__panelSetupProps: WsProps) => {
            nextTick(() => {
                if (__panelSetupProps.error.length !== 0) {
                    initError(__panelSetupProps.error);
                } else {
                    initCmd.value = __panelSetupProps.initCmd || '';
                    waitForPrompt.value = __panelSetupProps.waitForPrompt || '';
                    waitForPromptBuffer.value = '';
                    sessionId.value = __panelSetupProps.sessionId || '';
                    init(__panelSetupProps.endpoint, __panelSetupProps.args);
                }
            });
        };
        const newTerm = () => {
            const bg = terminalStore.backgroundColor || '#000000';
            const fg = terminalStore.foregroundColor || '#f5f5f5';
            term.value = new Terminal({
                lineHeight: terminalStore.lineHeight || 1.2,
                fontSize: terminalStore.fontSize || 12,
                fontFamily: terminalStore.fontFamily || "Monaco, Menlo, Consolas, 'Courier New', monospace",
                theme: {
                    background: bg,
                    foreground: fg,
                },
                cursorBlink: terminalStore.cursorBlink
                    ? String(terminalStore.cursorBlink).toLowerCase() === 'enable'
                    : true,
                cursorStyle: terminalStore.cursorStyle ? getStyle() : 'underline',
                scrollback: terminalStore.scrollback || 1000,
                scrollSensitivity: terminalStore.scrollSensitivity || 6,
            });
        };
        const applyTerminalBackground = (color: string) => {
            if (!terminalElement.value) return;
            terminalElement.value.style.backgroundColor = color || '#000000';
            terminalElement.value.style.backgroundImage = '';
            terminalElement.value.style.backgroundSize = '';
            terminalElement.value.style.backgroundPosition = '';
            terminalElement.value.style.backgroundRepeat = '';
            terminalElement.value.style.imageRendering = '';
        };
        const getStyle = (): 'underline' | 'block' | 'bar' => {
            switch (terminalStore.cursorStyle) {
                case 'bar':
                    return 'bar';
                case 'block':
                    return 'block';
                default:
                    return 'underline';
            }
        };
        const init = (endpoint: string, args: string) => {
            if (initTerminal(true)) {
                initWebSocket(endpoint, args);
            }
        };
        const initError = (errorInfo: string) => {
            if (initTerminal(false)) {
                term.value.write(errorInfo);
            }
        };
        function onClose(isKeepShow: boolean = false) {
            initWebSocketToken++;
            closing = true;
            stopReconnect();
            window.removeEventListener('resize', changeTerminalSize);
            if (resizeFrame !== undefined) {
                cancelAnimationFrame(resizeFrame);
                resizeFrame = undefined;
            }
            lastResizeColumns = 0;
            lastResizeRows = 0;
            clearAINotice();
            webSocketReady.value = false;
            try {
                // 1000 tells the agent this is deliberate: close the shell now, no grace period
                terminalSocket.value?.close(1000);
            } catch {}
            if (heartbeatTimer.value) {
                clearInterval(Number(heartbeatTimer.value));
                heartbeatTimer.value = undefined;
            }
            terminalSocket.value = undefined;
            if (!isKeepShow) {
                try {
                    term.value.dispose();
                } catch {}
            }
            if (terminalElement.value) {
                terminalElement.value.innerHTML = '';
            }
        }
        const initTerminal = (online: boolean = false): boolean => {
            newTerm();
            lastResizeColumns = 0;
            lastResizeRows = 0;
            if (terminalElement.value) {
                term.value.open(terminalElement.value);
                applyTerminalBackground(terminalStore.backgroundColor);
                term.value.loadAddon(fitAddon);
                window.addEventListener('resize', changeTerminalSize);
                if (online) {
                    term.value.onData((data) => onTermData(data));
                }
                termReady.value = true;
            }
            return termReady.value;
        };
        function changeTerminalSize() {
            if (resizeFrame !== undefined) {
                return;
            }
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = undefined;
                resizeTerminal();
            });
        }
        function resizeTerminal() {
            if (!terminalElement.value || !term.value) return;
            if (terminalElement.value.clientWidth <= 0 || terminalElement.value.clientHeight <= 0) {
                return;
            }
            if (terminalElement.value.closest('.terminal-host')) return;

            fitAddon.fit();
            if (isWsOpen()) {
                const { cols, rows } = term.value;
                if (cols === lastResizeColumns && rows === lastResizeRows) {
                    return;
                }
                lastResizeColumns = cols;
                lastResizeRows = rows;
                terminalSocket.value!.send(
                    JSON.stringify({
                        type: 'resize',
                        cols: cols,
                        rows: rows,
                    }),
                );
            }
        }
        const initWebSocket = async (endpoint_: string, args: string = '') => {
            const token = ++initWebSocketToken;
            closing = false;
            wsEndpoint = endpoint_;
            wsArgs = args;
            const href = window.location.href;
            const protocol = href.split('//')[0] === 'http:' ? 'ws' : 'wss';
            const host = href.split('//')[1].split('/')[0];
            const endpoint = endpoint_.replace(/^\/+/, '');
            const params = new URLSearchParams(args);
            const node = params.has('id') ? 'local' : currentNode.value;
            let conn = `${protocol}://${host}/${endpoint}?cols=${term.value.cols}&rows=${term.value.rows}&${args}&operateNode=${node}`;
            if (params.has('operateNode')) {
                conn = `${protocol}://${host}/${endpoint}?cols=${term.value.cols}&rows=${term.value.rows}&${args}`;
            }
            if (sessionId.value) {
                conn += `&session=${encodeURIComponent(sessionId.value)}`;
            }
            if (revalidating) {
                conn += '&terminalRevalidate=1';
            }
            const authError = await checkStreamAuth(conn);
            if (token !== initWebSocketToken || !termReady.value) {
                return;
            }
            if (authError) {
                reconnecting = false;
                revalidating = false;
                sessionId.value = '';
                showWebSocketAuthError(authError);
                ctx.emit('expired');
                return;
            }
            if (heartbeatTimer.value) {
                clearInterval(Number(heartbeatTimer.value));
            }
            terminalSocket.value = new WebSocket(conn);
            terminalSocket.value.onopen = runRealTerminal;
            terminalSocket.value.onmessage = onWSReceive;
            terminalSocket.value.onclose = closeRealTerminal;
            terminalSocket.value.onerror = errorRealTerminal;
            heartbeatTimer.value = setInterval(() => {
                if (isWsOpen()) {
                    terminalSocket.value!.send(
                        JSON.stringify({
                            type: 'heartbeat',
                            timestamp: `${new Date().getTime()}`,
                        }),
                    );
                }
            }, 1000 * 10);
        };
        const showWebSocketAuthError = (message: string) => {
            clearAINotice();
            MsgError(message);
            term.value?.write(`\x1b[31m${message}\x1b[m\r\n`);
        };
        const runRealTerminal = () => {
            webSocketReady.value = true;
            changeTerminalSize();
            term.value?.focus();
            // a reattached shell already ran its init command
            if (initCmd.value !== '' && !sessionId.value) {
                hideInitCmdEcho.value = true;
                initCmdEchoBuffer.value = '';
                sendMsg(initCmd.value);
            }
        };
        const stripInitCmdEchoLine = (message: string) => {
            if (!hideInitCmdEcho.value) {
                return message;
            }
            initCmdEchoBuffer.value += message;
            const lineBreakIndex = initCmdEchoBuffer.value.search(/\r?\n/);
            if (lineBreakIndex === -1) {
                return '';
            }

            const lineBreakLength = initCmdEchoBuffer.value[lineBreakIndex] === '\r' ? 2 : 1;
            const remaining = initCmdEchoBuffer.value.slice(lineBreakIndex + lineBreakLength);
            hideInitCmdEcho.value = false;
            initCmdEchoBuffer.value = '';
            initCmd.value = '';
            return remaining;
        };
        const flushPromptBuffer = (message: string) => {
            if (!waitForPrompt.value) {
                return message;
            }
            waitForPromptBuffer.value += message;
            const promptIndex = waitForPromptBuffer.value.indexOf(waitForPrompt.value);
            if (promptIndex === -1) {
                return '';
            }

            const visible = waitForPromptBuffer.value.slice(promptIndex);
            waitForPrompt.value = '';
            waitForPromptBuffer.value = '';
            return visible;
        };
        const onWSReceive = (message: MessageEvent) => {
            const wsMsg = JSON.parse(message.data);
            switch (wsMsg.type) {
                case 'cmd': {
                    if (wsMsg.data) {
                        let receiveMsg = decodeBase64(wsMsg.data);
                        if (hideInitCmdEcho.value) {
                            receiveMsg = stripInitCmdEchoLine(receiveMsg);
                        }
                        if (receiveMsg && waitForPrompt.value) {
                            receiveMsg = flushPromptBuffer(receiveMsg);
                        }
                        if (!receiveMsg) {
                            break;
                        }
                        term.value.write(receiveMsg);
                    }
                    break;
                }
                case 'heartbeat': {
                    latency.value = new Date().getTime() - wsMsg.timestamp;
                    break;
                }
                case 'session': {
                    const wasReconnect = reconnecting;
                    const wasRevalidate = revalidating;
                    reconnecting = false;
                    revalidating = false;
                    reconnectDelay = 1000;
                    sessionId.value = wsMsg.id || '';
                    if (wasReconnect && !wasRevalidate) {
                        // replay is a tail of recent output, start from a clean screen
                        term.value?.reset();
                    }
                    ctx.emit('session', sessionId.value);
                    break;
                }
                case 'ai_notice': {
                    const message = wsMsg.message?.trim();
                    if (!message) {
                        break;
                    }
                    showAINotice(wsMsg.level || 'info', message);
                    break;
                }
            }
        };
        const errorRealTerminal = (ex: any) => {
            clearAINotice();
            if (reconnecting) return;
            let message = ex.message;
            if (!message) message = 'disconnected';
            term.value.write(`\x1b[31m${message}\x1b[m\r\n`);
        };
        const closeRealTerminal = (ev: CloseEvent) => {
            clearAINotice();
            webSocketReady.value = false;
            if (heartbeatTimer.value) {
                clearInterval(Number(heartbeatTimer.value));
                heartbeatTimer.value = undefined;
            }
            terminalSocket.value = undefined;
            if (closing || !sessionId.value) {
                term.value?.write('The connection has been disconnected.');
                term.value?.write(ev.reason);
                return;
            }
            switch (ev.code) {
                case 1000: // the shell exited or the agent closed it
                case CLOSE_SESSION_NOT_FOUND:
                    sessionId.value = '';
                    reconnecting = false;
                    writeNotice(
                        '31',
                        ev.code === 1000
                            ? 'The connection has been disconnected.'
                            : i18n.global.t('terminal.sessionExpired'),
                    );
                    expired = true;
                    ctx.emit('expired');
                    return;
                case CLOSE_ATTACHED_ELSEWHERE:
                    reconnecting = false;
                    writeNotice('31', i18n.global.t('terminal.sessionKicked'));
                    return;
                case CLOSE_REVALIDATE:
                    revalidating = true;
                    scheduleReconnect(true);
                    return;
                default:
                    scheduleReconnect();
            }
        };
        const writeNotice = (color: string, message: string) => {
            term.value?.write(`\r\n\x1b[${color}m${message}\x1b[m\r\n`);
        };
        const scheduleReconnect = (forRevalidation = false) => {
            const now = Date.now();
            if (!reconnecting) {
                reconnecting = true;
                reconnectStartedAt = now;
                reconnectDelay = 1000;
                reconnectNoticeShown = false;
            } else if (now - reconnectStartedAt > reconnectWindow) {
                reconnecting = false;
                sessionId.value = '';
                writeNotice('31', i18n.global.t('terminal.sessionExpired'));
                ctx.emit('expired');
                return;
            }
            if (!forRevalidation && !reconnectNoticeShown) {
                writeNotice('33', i18n.global.t('terminal.sessionReconnecting'));
                reconnectNoticeShown = true;
            }
            if (forRevalidation) {
                if (!closing && sessionId.value) {
                    initWebSocket(wsEndpoint, wsArgs);
                }
                return;
            }
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                if (closing || !sessionId.value) return;
                initWebSocket(wsEndpoint, wsArgs);
            }, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, 8000);
        };
        const stopReconnect = () => {
            reconnecting = false;
            revalidating = false;
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };
        const isWsOpen = () => {
            const readyState = terminalSocket.value && terminalSocket.value.readyState;
            return readyState === 1;
        };
        function isEnterInputData(data: string): boolean {
            return data === '\r' || data === '\n' || data === '\r\n';
        }
        function getCurrentTerminalLine(): string {
            const xterm = term.value;
            if (!xterm?.buffer?.active) return '';
            const buffer = xterm.buffer.active;
            const cursorRow = buffer.baseY + buffer.cursorY;
            let startRow = cursorRow;
            let endRow = cursorRow;

            for (let row = cursorRow; row > 0; row--) {
                const line = buffer.getLine(row) as TerminalBufferLine | undefined;
                if (!line?.isWrapped) {
                    startRow = row;
                    break;
                }
                startRow = row - 1;
            }

            for (let row = cursorRow + 1; row < buffer.length; row++) {
                const line = buffer.getLine(row) as TerminalBufferLine | undefined;
                if (!line?.isWrapped) {
                    break;
                }
                endRow = row;
            }

            let content = '';
            for (let row = startRow; row <= endRow; row++) {
                const line = buffer.getLine(row) as TerminalBufferLine | undefined;
                if (!line) continue;
                content += line.translateToString(false);
            }
            return content.trimEnd();
        }
        function sendMsg(data: string, line: string = '') {
            if (isWsOpen()) {
                terminalSocket.value!.send(
                    JSON.stringify({
                        type: 'cmd',
                        data: encodeBase64(data),
                        line,
                    }),
                );
            }
        }
        function onTermData(data: string) {
            if (!data) return;
            if (expired) {
                if (isEnterInputData(data)) {
                    expired = false;
                    ctx.emit('reconnect');
                }
                return;
            }
            if (aiNotice.value.loading) return;
            sendMsg(data, isEnterInputData(data) ? getCurrentTerminalLine() : '');
        }
        function clearAINotice() {
            if (aiNoticeTimer) {
                clearTimeout(aiNoticeTimer);
                aiNoticeTimer = null;
            }
            aiNotice.value = {
                ...aiNotice.value,
                visible: false,
                loading: false,
            };
        }
        function showAINotice(level: string, message: string) {
            if (aiNoticeTimer) {
                clearTimeout(aiNoticeTimer);
                aiNoticeTimer = null;
            }
            const resolvedLevel = ['success', 'error', 'info'].includes(level) ? level : 'info';
            aiNotice.value = {
                visible: true,
                loading: resolvedLevel === 'info',
                level: resolvedLevel,
                message,
            };
            if (resolvedLevel === 'info') {
                return;
            }
            aiNoticeTimer = setTimeout(() => {
                aiNotice.value = {
                    ...aiNotice.value,
                    visible: false,
                    loading: false,
                };
                aiNoticeTimer = null;
            }, 2600);
        }
        const resizeObserver = ref<ResizeObserver>();
        onMounted(() => {
            // 使用 ResizeObserver 监听容器大小变化
            resizeObserver.value = new ResizeObserver(() => {
                if (termReady.value && webSocketReady.value) {
                    changeTerminalSize();
                }
            });

            if (terminalElement.value) {
                resizeObserver.value.observe(terminalElement.value);
            }
        });
        onBeforeUnmount(() => {
            onClose();
            resizeObserver.value?.disconnect();
        });
        onActivated(() => {
            nextTick(changeTerminalSize);
        });
        ctx.expose({
            acceptParams,
            onClose,
            isWsOpen,
            sendMsg,
            getLatency: () => latency.value,
            // re-fit after the element was moved back into a visible container
            refit: () => changeTerminalSize(),
        });
        return () => (
            <div class={'terminal-shell'}>
                <div ref={terminalElement} class={'terminal-container'} />
                <transition name="ai-mask-fade">
                    {unref(aiNotice).loading ? <div class={'ai-notice-mask'} /> : null}
                </transition>
                <transition name="ai-notice-fade">
                    {unref(aiNotice).visible ? (
                        <div
                            class={cn('ai-notice', [
                                `ai-notice--${unref(aiNotice).level}`,
                                { 'ai-notice--loading': unref(aiNotice).loading },
                            ])}
                        >
                            {unref(aiNotice).message}
                        </div>
                    ) : null}
                </transition>
            </div>
        );
    },
    options,
);
