import { $t } from '@/utils/i18n-t';
import screenfull from 'screenfull';
import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
import router from '@/routers';
import { rpc } from '@/lib/rpc';
import AiSetting from '@/pages/terminal/_components/setting/ai/index';
import { TerminalSessionStore } from '@/store';
import ConnectionMenu from '@/components/terminal/connection-menu/index';
import type { TerminalConnectionOptions } from '@/components/terminal/connection-menu/types';
import './index.styles.css';
import { cn } from '@/utils/cn';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'terminal',
    props: {},
    emits: emits,
    __scopeId: 'data-v-57898941',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isFullScreen, isMobile, isNodeAdmin, openMenuTabs } = useGlobalStore();
        const store = TerminalSessionStore();
        const connectionMenuRef = ref<InstanceType<typeof ConnectionMenu>>();
        const toggleFullscreen = () => {
            if (screenfull.isEnabled) {
                screenfull.toggle();
            }
        };
        const loadTooltip = () => {
            return i18n.global.t('commons.button.' + (isFullScreen.value ? 'quitFullscreen' : 'fullscreen'));
        };
        let timer: ReturnType<typeof setInterval> | null = null;
        const terminalValue = ref();
        const commandTree = ref();
        const quickCommandProps = {
            expandTrigger: 'hover' as const,
        };
        let quickCmd = ref();
        let batchVal = ref();
        let isBatch = ref<boolean>(false);
        const showConnections = ref(false);
        const initCmd = ref('');
        const acceptParams = async () => {
            isFullScreen.value = false;
            loadCommandTree();
            if (store.entries.length === 0) {
                await openDefaultLocalConn();
            } else {
                if (!store.find(terminalValue.value)) {
                    terminalValue.value = store.entries[0].key;
                }
                await claim();
                store.sync();
            }
            cleanTimer();
            timer = setInterval(store.sync, 1000 * 5);
        };
        const openDefaultLocalConn = async () => {
            await nextTick();
            if (isNodeAdmin.value) {
                await connectionMenuRef.value?.connectLocal();
                return;
            }
            await rpc.agentSetting.getInfo({}).then(async (res) => {
                if (res.localSshConnShow === 'Enable') {
                    await connectionMenuRef.value?.connectLocal();
                }
            });
        };
        const cleanTimer = () => {
            clearInterval(Number(timer));
            timer = null;
        };
        const slotEls: Record<string, HTMLElement> = {};
        const onSlot = (key: string, el: HTMLElement | null) => {
            if (el) slotEls[key] = el;
            else delete slotEls[key];
        };
        let pageVisible = true;
        const claim = async () => {
            for (const item of store.entries) {
                if (pageVisible) {
                    store.setSlot(item.key, slotEls[item.key] || null);
                } else if (store.slots[item.key] && store.slots[item.key] === slotEls[item.key]) {
                    store.setSlot(item.key, null);
                }
            }
            if (!pageVisible) return;
            await nextTick();
            for (const item of store.entries) {
                store.instances[item.key]?.refit();
            }
        };
        watch(
            () => store.entries.length,
            () => nextTick(claim),
        );
        onActivated(() => {
            pageVisible = true;
            claim();
        });
        onDeactivated(() => {
            pageVisible = false;
            claim();
        });
        const loadHeight = () => {
            return openMenuTabs.value ? '250px' : '210px';
        };
        const loadEmptyHeight = () => {
            return openMenuTabs.value ? '201px' : '156px';
        };
        const handleTabsRemove = async (targetName: string, action: 'remove' | 'add') => {
            if (action !== 'remove') {
                return;
            }
            if (!store.find(targetName)) {
                return;
            }
            const tabs = store.entries;
            let activeName = terminalValue.value;
            if (activeName === targetName) {
                tabs.forEach((tab, index) => {
                    if (tab.key === targetName) {
                        const nextTab = tabs[index + 1] || tabs[index - 1];
                        if (nextTab) {
                            activeName = nextTab.key;
                        }
                    }
                });
            }
            terminalValue.value = activeName;
            store.remove(targetName);
        };
        const loadCommandTree = async () => {
            const res = await rpc.core.command.tree({ type: 'command' });
            commandTree.value = res.items || [];
        };
        const sendToTerminals = (command: string, all: boolean) => {
            const keys = all ? store.entries.map((e) => e.key) : [terminalValue.value];
            for (const key of keys) {
                store.instances[key]?.sendMsg(command);
            }
        };
        const handleQuickCommandChange = (val: Array<string>) => {
            if (!val?.length) {
                return;
            }
            sendToTerminals(val[val.length - 1] + '\n', isBatch.value);
            quickCmd.value = '';
        };
        function batchInput() {
            if (batchVal.value === '') {
                return;
            }
            sendToTerminals(batchVal.value + '\n', isBatch.value);
            batchVal.value = '';
        }
        const connectionError = 'Failed to set up the connection. Please check the host information';
        const openConnection = async (options: TerminalConnectionOptions) => {
            const cmd = initCmd.value;
            initCmd.value = '';
            terminalValue.value = await store.open({ ...options, initCmd: cmd });
        };
        const onReconnect = async (item: any) => {
            const nodeName = new URLSearchParams(item.args).get('operateNode') || undefined;
            const res =
                item.wsID === 0 ? await rpc.agentSetting.testLocalConn({}) : await rpc.host.testByID({ id: item.wsID });
            const cmd = initCmd.value;
            initCmd.value = '';
            const ok = res.ok;
            await store.reconnect(item.key, ok ? '' : connectionError, cmd);
            store.sync();
        };
        const changeFullScreen = () => {
            isFullScreen.value = screenfull.isFullscreen;
        };
        onBeforeUnmount(() => {
            document.removeEventListener('fullscreenchange', changeFullScreen);
            cleanTimer();
            pageVisible = false;
            claim();
            store.closeAll();
        });
        onMounted(() => {
            if (router.currentRoute.value.query.path) {
                const path = String(router.currentRoute.value.query.path);
                initCmd.value = `cd "${path}" \n`;
            }
            document.addEventListener('fullscreenchange', changeFullScreen);
        });
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div class={cn('terminal-page', { 'is-mobile': unref(isMobile) })}>
                <ElTabs
                    type="card"
                    modelValue={unref(terminalValue)}
                    onUpdate:modelValue={($v) => {
                        terminalValue.value = $v as any;
                    }}
                    addable
                    onTabAdd={($event?: any) => {
                        showConnections.value = !unref(showConnections);
                    }}
                    onTabChange={($event?: any) => {
                        quickCmd.value = '';
                    }}
                    onEdit={($event?: any) => {
                        (handleTabsRemove as any)($event);
                    }}
                    class={'terminal-tabs'}
                    style={'background-color: var(--panel-terminal-tag-bg-color)'}
                    v-slots={{
                        'add-icon': () => (
                            <>
                                <ConnectionMenu
                                    ref={connectionMenuRef}
                                    modelValue={unref(showConnections)}
                                    onUpdate:modelValue={($v) => {
                                        showConnections.value = $v as any;
                                    }}
                                    open-session={openConnection}
                                />
                            </>
                        ),
                    }}
                >
                    {(store.entries || []).map((item) => (
                        <ElTabPane
                            closable={true}
                            label={item.title}
                            name={item.key}
                            key={item.key}
                            v-slots={{
                                label: () => (
                                    <>
                                        <ElTooltip
                                            content={`${item.title} · ${
                                                item.status === 'online'
                                                    ? `${item.latency} ms`
                                                    : $t('commons.button.reconnect')
                                            }`}
                                            placement="top-start"
                                            show-after={300}
                                        >
                                            <span class={'terminal-tab-label'}>
                                                {item.status === 'online' ? (
                                                    <span aria-hidden="true" class={'terminal-tab-status'}>
                                                        <span class={'terminal-status-dot'} />
                                                    </span>
                                                ) : (
                                                    <ElButton
                                                        icon="Refresh"
                                                        aria-label={$t('commons.button.reconnect')}
                                                        link
                                                        onClick={($event?: any) => {
                                                            $event.stopPropagation();
                                                            onReconnect(item);
                                                        }}
                                                        class={'terminal-tab-reconnect'}
                                                    />
                                                )}
                                                <span class={'terminal-tab-title'}>{item.title}</span>
                                                {item.key === unref(terminalValue) && item.status === 'online' ? (
                                                    <span class={'terminal-tab-latency'}>
                                                        {item.latency}
                                                        {' ms '}
                                                    </span>
                                                ) : null}
                                            </span>
                                        </ElTooltip>
                                    </>
                                ),
                            }}
                        >
                            <div
                                ref={(el: any) => onSlot(item.key, el)}
                                class={'terminal-slot'}
                                style={{
                                    height: `calc(100vh - ${loadHeight()})`,
                                    'background-color': `var(--panel-logs-bg-color)`,
                                }}
                            />
                            <div class={'flex w-full flex-wrap items-center gap-2 py-2'}>
                                {!unref(isMobile) ? <AiSetting class={'shrink-0'} /> : null}
                                <ElCascader
                                    modelValue={unref(quickCmd)}
                                    onUpdate:modelValue={($v) => {
                                        quickCmd.value = $v as any;
                                    }}
                                    options={unref(commandTree)}
                                    props={quickCommandProps}
                                    show-all-levels={false}
                                    filterable
                                    clearable
                                    placeholder={$t('terminal.quickCommand')}
                                    onChange={($event?: any) => {
                                        (handleQuickCommandChange as any)($event);
                                    }}
                                    class={'quick-command-cascader max-w-[260px] min-w-[180px] shrink-0'}
                                    v-slots={{
                                        default: ({ data }) => (
                                            <>
                                                {!data.children?.length ? (
                                                    <ElTooltip
                                                        placement="right"
                                                        popper-class="command-detail-tooltip"
                                                        v-slots={{
                                                            content: () => (
                                                                <>
                                                                    <div class={'command-detail-content'}>
                                                                        {data.value}
                                                                    </div>
                                                                </>
                                                            ),
                                                        }}
                                                    >
                                                        <div class={'cascader-option'}>
                                                            <span class={'cascader-option-label'}>{data.label}</span>
                                                        </div>
                                                    </ElTooltip>
                                                ) : (
                                                    <div class={'cascader-option'}>
                                                        <span class={'cascader-option-label'}>{data.label}</span>
                                                    </div>
                                                )}
                                            </>
                                        ),
                                    }}
                                />
                                <ElInput
                                    modelValue={unref(batchVal)}
                                    onUpdate:modelValue={($v) => {
                                        batchVal.value = $v as any;
                                    }}
                                    onKeydown={($event?: any) => {
                                        $event.preventDefault();
                                        if (!($event.key === 'Enter')) return;
                                        (batchInput as any)($event);
                                    }}
                                    type="textarea"
                                    autosize={{ minRows: 1, maxRows: 3 }}
                                    placeholder=">"
                                    class={'min-w-[200px] flex-1 basis-[300px]'}
                                />
                                <ElCheckbox
                                    label={$t('terminal.batchInput')}
                                    modelValue={unref(isBatch)}
                                    onUpdate:modelValue={($v) => {
                                        isBatch.value = $v as any;
                                    }}
                                    class={'shrink-0 whitespace-nowrap'}
                                />
                            </div>
                        </ElTabPane>
                    ))}
                    {store.entries.length === 0 ? (
                        <div>
                            <ElEmpty
                                description={$t('terminal.emptyTerminal')}
                                style={{ height: `calc(100vh - ${loadEmptyHeight()})`, 'background-color': '#000' }}
                            />
                        </div>
                    ) : null}
                </ElTabs>
                {!unref(isMobile) ? (
                    <div class={'terminal-actions'}>
                        <ElTooltip content={loadTooltip()} placement="top">
                            <ElButton
                                icon="FullScreen"
                                text
                                aria-label={loadTooltip()}
                                onClick={($event?: any) => {
                                    (toggleFullscreen as any)($event);
                                }}
                                class={'terminal-action'}
                            />
                        </ElTooltip>
                    </div>
                ) : null}
            </div>
        );
    },
    options,
);
