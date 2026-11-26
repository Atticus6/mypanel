import { $t } from '@/utils/i18n-t';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import i18n from '@/lang';
import { TerminalDockSessionStore, TerminalStore } from '@/store';
import { ElMessageBox } from 'element-plus';
import ConnectionMenu from '@/components/terminal/connection-menu/index';
import type { TerminalConnectionOptions } from '@/components/terminal/connection-menu/types';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { cn } from '@/utils/cn';
import { ElBadge } from 'element-plus';
import { ElPopover } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElTabs } from 'element-plus';
import { ElTabPane } from 'element-plus';
import SvgIcon from '@/components/svg-icon/svg-icon';
import DialogPro from '@/components/dialog-pro/index';
import { InfoFilled } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'dock',
    props: {},
    emits: emits,
    __scopeId: 'data-v-46f0350b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const store = TerminalDockSessionStore();
        const terminalStore = TerminalStore();
        const { isAdmin } = useGlobalStore();
        const open = ref(false);
        const active = ref('');
        const showConnections = ref(false);
        let timer: ReturnType<typeof setInterval> | null = null;
        const openConnection = async (options: TerminalConnectionOptions) => {
            if (!isAdmin.value) return;
            active.value = await store.open(options);
        };
        const show = async () => {
            if (!isAdmin.value) return;
            if (!store.find(active.value)) active.value = store.entries[0]?.key || '';
            open.value = true;
            await nextTick();
            if (!open.value || !isAdmin.value) return;
            claim();
            store.sync();
            if (timer) clearInterval(timer);
            timer = setInterval(store.sync, 5000);
        };
        const park = () => {
            showConnections.value = false;
            if (timer) clearInterval(timer);
            timer = null;
            claim();
        };
        watch(open, (value) => {
            if (!value) park();
        });
        watch(isAdmin, (allowed) => {
            if (!allowed) open.value = false;
        });
        watch(
            () => terminalStore.showTerminalButton,
            (visible) => {
                if (!visible) open.value = false;
            },
        );
        onBeforeUnmount(() => {
            if (timer) clearInterval(timer);
        });
        const slotEls: Record<string, HTMLElement> = {};
        const onSlot = (key: string, el: HTMLElement | null) => {
            if (el) slotEls[key] = el;
            else {
                if (store.slots[key] === slotEls[key]) store.setSlot(key, null);
                delete slotEls[key];
            }
        };
        const claim = () => {
            for (const item of store.entries) {
                if (open.value && item.key === active.value) {
                    store.setSlot(item.key, slotEls[item.key] || null);
                } else if (store.slots[item.key] && store.slots[item.key] === slotEls[item.key]) {
                    store.setSlot(item.key, null);
                }
            }
        };
        watch(active, () => nextTick(claim));
        watch(
            () => store.entries.length,
            () => {
                if (!store.find(active.value)) active.value = store.entries[0]?.key || '';
            },
        );
        const closeAll = async () => {
            if (store.entries.length > 0) {
                await ElMessageBox.confirm(
                    i18n.global.t('terminal.closeAllConfirm'),
                    i18n.global.t('terminal.closeAllSessions'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        type: 'warning',
                    },
                );
                store.closeAll();
            }
            open.value = false;
        };
        return () => (
            <>
                {unref(isAdmin) && terminalStore.showTerminalButton ? (
                    <div
                        onClick={($event?: any) => {
                            (show as any)($event);
                        }}
                        class={'terminal-dock-handle'}
                    >
                        <ElBadge
                            value={store.entries.length}
                            hidden={store.entries.length === 0}
                            type="primary"
                            class={'terminal-dock-badge'}
                        >
                            <SvgIcon iconName="p-terminal2" class={'terminal-dock-icon'} />
                        </ElBadge>
                        <span class={'terminal-dock-label'}>{$t('menu.terminal')}</span>
                    </div>
                ) : null}
                {unref(isAdmin) ? (
                    <DialogPro
                        modelValue={unref(open)}
                        onUpdate:modelValue={($v) => {
                            open.value = $v as any;
                        }}
                        title={$t('menu.terminal')}
                        size="w-70"
                        show-close={false}
                        modal={false}
                        modal-penetrable
                        onOpened={($event?: any) => {
                            (claim as any)($event);
                        }}
                        v-slots={{
                            header: () => (
                                <>
                                    <div class={'flex items-center'}>
                                        <div class={'terminal-dock-title flex-1'}>
                                            <span class={'el-dialog__title'}>{$t('menu.terminal')}</span>
                                            <ElPopover
                                                placement="bottom-start"
                                                width={380}
                                                trigger="hover"
                                                show-after={200}
                                                v-slots={{
                                                    reference: () => (
                                                        <>
                                                            <ElIcon tabindex="0" class={'terminal-rules-icon'}>
                                                                <InfoFilled />
                                                            </ElIcon>
                                                        </>
                                                    ),
                                                }}
                                            >
                                                <div class={'terminal-rules-title'}>{$t('terminal.sessionRules')}</div>
                                                <ul class={'terminal-rules-list'}>
                                                    <li>{$t('terminal.sessionRuleClose')}</li>
                                                    <li>{$t('terminal.sessionRuleDisconnect')}</li>
                                                    <li>{$t('terminal.sessionRuleRevalidate')}</li>
                                                    <li>{$t('terminal.sessionRuleResources')}</li>
                                                    <li>{$t('terminal.sessionRuleDisableShortcut')}</li>
                                                </ul>
                                            </ElPopover>
                                        </div>
                                        <ElTooltip content={$t('terminal.minimize')} placement="top">
                                            <ElButton
                                                link
                                                icon="Minus"
                                                onClick={($event?: any) => {
                                                    open.value = false;
                                                }}
                                            />
                                        </ElTooltip>
                                        <ElTooltip content={$t('terminal.closeAllSessions')} placement="top">
                                            <ElButton
                                                link
                                                icon="Close"
                                                onClick={($event?: any) => {
                                                    (closeAll as any)($event);
                                                }}
                                            />
                                        </ElTooltip>
                                    </div>
                                </>
                            ),
                            content: () => (
                                <>
                                    <div class={'terminal-dock-toolbar'}>
                                        <ElTabs
                                            modelValue={unref(active)}
                                            onUpdate:modelValue={($v) => {
                                                active.value = $v as any;
                                            }}
                                            type="card"
                                            addable
                                            onTabAdd={($event?: any) => {
                                                showConnections.value = !unref(showConnections);
                                            }}
                                            onTabRemove={($event?: any) => {
                                                (store.remove as any)($event);
                                            }}
                                            class={'terminal-dock-tabs'}
                                            v-slots={{
                                                'add-icon': () => (
                                                    <>
                                                        <ConnectionMenu
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
                                                    name={item.key}
                                                    closable
                                                    key={item.key}
                                                    v-slots={{
                                                        label: () => (
                                                            <>
                                                                <span
                                                                    class={cn(
                                                                        'terminal-status-dot',
                                                                        item.status === 'online'
                                                                            ? 'is-online'
                                                                            : 'is-offline',
                                                                    )}
                                                                />
                                                                <span title={item.title} class={'terminal-tab-title'}>
                                                                    {item.title}
                                                                </span>
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            ))}
                                        </ElTabs>
                                    </div>
                                    {store.entries.length === 0 ? (
                                        <div class={'terminal-dock-empty'}>{$t('terminal.emptyTerminal')}</div>
                                    ) : null}
                                    {(store.entries || []).map((item) => (
                                        <div
                                            ref={(el: any) => onSlot(item.key, el)}
                                            onClick={($event?: any) => {
                                                store.instances[item.key]?.refit();
                                            }}
                                            class={'terminal-dock-slot'}
                                            style={[{}, { display: item.key === unref(active) ? '' : 'none' }]}
                                            key={item.key}
                                        />
                                    ))}
                                </>
                            ),
                        }}
                    />
                ) : null}
            </>
        );
    },
    options,
);
