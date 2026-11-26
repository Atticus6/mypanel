import { $t } from '@/utils/i18n-t';
import { prunePanelCache } from '@/utils/panel-cache';
import { onMounted, computed, ref, watch, onBeforeUnmount } from 'vue';
import { Sidebar, Footer, AppMain, MobileHeader, Tabs } from './components';
import TerminalHost from '@/components/terminal/host';
import TerminalDock from '@/components/terminal/dock/index';
import useResize from './hooks/useResize';
import { MenuStore, TabsStore } from '@/store';
import { rpc } from '@/lib/rpc';
import { openMenu } from '@/utils/router';
import { loadMasterProductProFromDB, loadProductProFromDB } from '@/utils/xpack';
import { useTheme } from '@/global/use-theme';
import TaskList from '@/components/task-list/index';
import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { cn } from '@/utils/cn';
import { ElAffix } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElWatermark } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'layout',
    props: {},
    emits: emits,
    __scopeId: 'data-v-e22e721d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const {
            globalStore,
            currentNode,
            currentNodeAddr,
            entrance,
            isDarkTheme,
            isFullScreen,
            isLoading,
            isMobile,
            isXpackOrEE,
            loadingText: globalLoadingText,
            openMenuTabs,
            watermark,
            watermarkShow,
        } = useGlobalStore();
        const { switchTheme } = useTheme();
        useResize();
        const taskListRef = ref();
        const openTask = () => {
            taskListRef.value.acceptParams();
            if (isMobile.value) {
                menuStore.setCollapse();
            }
        };
        const menuStore = MenuStore();
        const tabsStore = TabsStore();
        const loading = ref(false);
        const loadingText = computed(() =>
            globalLoadingText.value ? i18n.global.t(`commons.loadingText.${globalLoadingText.value}`) : '',
        );
        let timer: NodeJS.Timer | null = null;
        let cacheCleanupTimer: ReturnType<typeof setInterval> | undefined;
        const classObj = computed(() => {
            return {
                fullScreen: isFullScreen.value,
                hideSidebar: menuStore.isCollapse,
                openSidebar: !menuStore.isCollapse,
                mobile: isMobile.value,
                openMenuTabs: openMenuTabs.value,
                withoutAnimation: menuStore.withoutAnimation,
            };
        });
        const handleClickOutside = () => {
            menuStore.closeSidebar(false);
        };
        const handleCollapse = () => {
            menuStore.setCollapse();
        };
        const loadContent = () => {
            if (!watermark.value) {
                return '';
            }

            let itemName = watermark.value.content.replaceAll(
                '${nodeName}',
                currentNode.value === 'local' ? globalStore.getMasterAlias() : currentNode.value,
            );
            itemName = itemName.replaceAll('${nodeAddr}', currentNodeAddr.value || '127.0.0.1');
            return itemName;
        };
        watch(
            () => isLoading.value,
            () => {
                if (isLoading.value) {
                    loadStatus();
                } else {
                    loading.value = isLoading.value;
                }
            },
        );
        const handleMenuClick = async (path) => {
            await openMenu(path);
        };
        const toLogin = () => {
            let baseUrl = window.location.origin;
            let newUrl = '';
            if (entrance.value) {
                newUrl = baseUrl + '/' + entrance.value;
            } else {
                newUrl = baseUrl + '/login';
            }
            window.open(newUrl, '_self');
        };
        const loadStatus = async () => {
            loading.value = isLoading.value;
            if (loading.value) {
                timer = setInterval(async () => {
                    await rpc.core.setting
                        .getSystemAvailable({})
                        .then((res) => {
                            if (res) {
                                toLogin();
                                clearInterval(Number(timer));
                                timer = null;
                            }
                        })
                        .catch(() => {
                            toLogin();
                            clearInterval(Number(timer));
                            timer = null;
                        });
                }, 1000 * 10);
            }
        };
        onBeforeUnmount(() => {
            clearInterval(cacheCleanupTimer);
            clearInterval(Number(timer));
            timer = null;
        });
        onMounted(() => {
            cacheCleanupTimer = setInterval(() => prunePanelCache(), 300000);
            if (openMenuTabs.value && !tabsStore.activeTabPath) {
                handleMenuClick('/');
            }

            loadStatus();
            loadProductProFromDB();
            loadMasterProductProFromDB();
            isFullScreen.value = false;

            const mqList = window.matchMedia('(prefers-color-scheme: dark)');
            if (mqList.addEventListener) {
                mqList.addEventListener('change', () => {
                    switchTheme();
                });
            } else if (mqList.addListener) {
                mqList.addListener(() => {
                    switchTheme();
                });
            }
        });
        return () =>
            withDirectives(
                <div
                    element-loading-text={unref(loadingText)}
                    fullscreen
                    class={cn('app-wrapper relative', unref(classObj))}
                >
                    {unref(classObj).mobile && unref(classObj).openSidebar ? (
                        <div
                            onClick={($event?: any) => {
                                (handleClickOutside as any)($event);
                            }}
                            class={'drawer-bg'}
                        />
                    ) : null}
                    {!unref(classObj).mobile ? (
                        <ElAffix offset={unref(classObj).openMenuTabs ? 8 : 15} class={'affix'}>
                            <ElTooltip
                                content={
                                    menuStore.isCollapse ? $t('commons.button.expand') : $t('commons.button.collapse')
                                }
                            >
                                <ElButton
                                    size="small"
                                    circle
                                    icon={menuStore.isCollapse ? 'ArrowRight' : 'ArrowLeft'}
                                    plain
                                    onClick={($event?: any) => {
                                        handleCollapse();
                                    }}
                                    style={{
                                        'margin-left': menuStore.isCollapse ? '63px' : '168px',
                                        position: 'absolute',
                                    }}
                                />
                            </ElTooltip>
                        </ElAffix>
                    ) : null}
                    {!unref(isFullScreen) ? (
                        <div class={'app-sidebar'}>
                            <Sidebar
                                onMenuClick={($event?: any) => {
                                    (handleMenuClick as any)($event);
                                }}
                                menu-router={!unref(classObj).openMenuTabs}
                                onOpenTask={($event?: any) => {
                                    (openTask as any)($event);
                                }}
                            />
                        </div>
                    ) : null}
                    {unref(isXpackOrEE) && unref(watermarkShow) && unref(watermark) ? (
                        <ElWatermark
                            content={loadContent()}
                            font={{
                                fontSize: unref(watermark).fontSize,
                                color: unref(isDarkTheme) ? unref(watermark).darkColor : unref(watermark).lightColor,
                                textBaseline: 'top',
                            }}
                            rotate={unref(watermark).rotate}
                            gap={[unref(watermark).gap, unref(watermark).gap]}
                        >
                            <div class={'main-container'}>
                                {unref(classObj).mobile ? <MobileHeader /> : null}
                                {unref(classObj).openMenuTabs ? <Tabs /> : null}
                                <AppMain
                                    keepAlive={unref(classObj).openMenuTabs ? tabsStore.keepAliveTabs : null}
                                    class={'app-main'}
                                />
                                {!unref(isFullScreen) ? <Footer class={'app-footer'} /> : null}
                            </div>
                        </ElWatermark>
                    ) : (
                        <div class={'main-container'}>
                            {unref(classObj).mobile ? <MobileHeader /> : null}
                            {unref(classObj).openMenuTabs ? <Tabs /> : null}
                            <AppMain
                                keepAlive={unref(classObj).openMenuTabs ? tabsStore.keepAliveTabs : null}
                                class={'app-main'}
                            />
                            {!unref(isFullScreen) ? <Footer class={'app-footer'} /> : null}
                        </div>
                    )}
                    <TaskList ref={taskListRef} />
                    <TerminalHost />
                    <TerminalDock />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
