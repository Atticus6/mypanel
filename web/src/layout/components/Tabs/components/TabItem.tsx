import { $t } from '@/utils/i18n-t';
import { computed, ref } from 'vue';
import { TabsStore, TerminalSessionStore } from '@/store';
import i18n from '@/lang';
import { Close, DArrowLeft, DArrowRight, Lock, More, Unlock } from '@element-plus/icons-vue';
import './TabItem.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { cn } from '@/utils/cn';
import { ElTabPane } from 'element-plus';
import { ElDropdown } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElDropdownMenu } from 'element-plus';
import { ElDropdownItem } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    tabItem?: Record<string, any>;
}

const emits = {
    closeTab: (...args: unknown[]) => true,
    closeOtherTabs: (...args: unknown[]) => true,
    closeTabs: (...args: unknown[]) => true,
    dropdownVisibleChange: (...args: unknown[]) => true,
};

const options = {
    name: 'TabItem',
    props: {
        tabItem: {
            type: Object,
            required: true,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-63be570a',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const tabsStore = TabsStore();
        const terminalSessions = TerminalSessionStore();
        const menuName = computed(() => {
            let title;
            if (__panelSetupProps.tabItem.meta.parent) {
                title =
                    i18n.global.t(__panelSetupProps.tabItem.meta.parent) +
                    '-' +
                    i18n.global.t(__panelSetupProps.tabItem.meta.title);
            } else {
                title = i18n.global.t(__panelSetupProps.tabItem.meta.title);
            }
            if (__panelSetupProps.tabItem.meta.detail) {
                title = title + '-' + i18n.global.t(__panelSetupProps.tabItem.meta.detail);
            }
            // live sessions: off the page only pinned ones survive, under a locked (keep-alive) tab all do
            if (__panelSetupProps.tabItem.path === '/terminal' && terminalSessions.entries.length > 0) {
                title = title + ' (' + i18n.global.t('terminal.sessionCount', [terminalSessions.entries.length]) + ')';
            }
            return title;
        });
        const dropdownRef = ref();
        ctx.expose({
            dropdownRef,
        });
        return () => (
            <ElTabPane
                name={__panelSetupProps.tabItem.path}
                v-slots={{
                    label: () => (
                        <>
                            <ElDropdown
                                size="small"
                                id={__panelSetupProps.tabItem.path}
                                ref={dropdownRef}
                                trigger="contextmenu"
                                onVisibleChange={($event?: any) => {
                                    ctx.emit('dropdownVisibleChange', $event, __panelSetupProps.tabItem.path);
                                }}
                                v-slots={{
                                    dropdown: () => (
                                        <>
                                            <ElDropdownMenu>
                                                <ElDropdownItem
                                                    onClick={($event?: any) => {
                                                        tabsStore.toggleKeepAlive(__panelSetupProps.tabItem.path);
                                                    }}
                                                >
                                                    <ElIcon>
                                                        {__panelSetupProps.tabItem.keepAlive ? <Lock /> : <Unlock />}
                                                    </ElIcon>
                                                    {__panelSetupProps.tabItem.keepAlive
                                                        ? $t('tabs.cancelKeepAlive')
                                                        : $t('tabs.keepAlive')}
                                                </ElDropdownItem>
                                                {tabsStore.hasCloseDropdown(__panelSetupProps.tabItem.path, 'close') ? (
                                                    <ElDropdownItem
                                                        onClick={($event?: any) => {
                                                            ctx.emit('closeTab', __panelSetupProps.tabItem.path);
                                                        }}
                                                    >
                                                        <ElIcon>
                                                            <Close />
                                                        </ElIcon>
                                                        {$t('commons.button.close')}
                                                    </ElDropdownItem>
                                                ) : null}
                                                {tabsStore.hasCloseDropdown(__panelSetupProps.tabItem.path, 'left') ? (
                                                    <ElDropdownItem
                                                        onClick={($event?: any) => {
                                                            ctx.emit(
                                                                'closeTabs',
                                                                __panelSetupProps.tabItem.path,
                                                                'left',
                                                            );
                                                        }}
                                                    >
                                                        <ElIcon>
                                                            <DArrowLeft />
                                                        </ElIcon>
                                                        {$t('tabs.closeLeft')}
                                                    </ElDropdownItem>
                                                ) : null}
                                                {tabsStore.hasCloseDropdown(__panelSetupProps.tabItem.path, 'right') ? (
                                                    <ElDropdownItem
                                                        onClick={($event?: any) => {
                                                            ctx.emit(
                                                                'closeTabs',
                                                                __panelSetupProps.tabItem.path,
                                                                'right',
                                                            );
                                                        }}
                                                    >
                                                        <ElIcon>
                                                            <DArrowRight />
                                                        </ElIcon>
                                                        {$t('tabs.closeRight')}
                                                    </ElDropdownItem>
                                                ) : null}
                                                {tabsStore.hasCloseDropdown(__panelSetupProps.tabItem.path, 'other') ? (
                                                    <ElDropdownItem
                                                        onClick={($event?: any) => {
                                                            ctx.emit('closeOtherTabs', __panelSetupProps.tabItem.path);
                                                        }}
                                                    >
                                                        <ElIcon>
                                                            <More />
                                                        </ElIcon>
                                                        {$t('tabs.closeOther')}
                                                    </ElDropdownItem>
                                                ) : null}
                                            </ElDropdownMenu>
                                        </>
                                    ),
                                }}
                            >
                                <span class={'custom-tabs-label'}>
                                    <span>{unref(menuName)}</span>
                                    <ElTooltip
                                        content={
                                            __panelSetupProps.tabItem.keepAlive
                                                ? $t('tabs.cancelKeepAlive')
                                                : $t('tabs.keepAlive')
                                        }
                                        placement="top"
                                    >
                                        <ElButton
                                            link
                                            type={__panelSetupProps.tabItem.keepAlive ? 'primary' : 'info'}
                                            onClick={($event?: any) => {
                                                $event.stopPropagation();
                                                tabsStore.toggleKeepAlive(__panelSetupProps.tabItem.path);
                                            }}
                                            class={cn('tab-keep-alive-button', {
                                                'is-active': __panelSetupProps.tabItem.keepAlive,
                                            })}
                                        >
                                            <ElIcon>
                                                {__panelSetupProps.tabItem.keepAlive ? <Lock /> : <Unlock />}
                                            </ElIcon>
                                        </ElButton>
                                    </ElTooltip>
                                </span>
                            </ElDropdown>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
