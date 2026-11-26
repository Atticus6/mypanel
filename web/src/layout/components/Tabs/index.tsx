import { onMounted, ref } from 'vue';
import { TabsStore } from '@/store';
import { useRoute, useRouter } from 'vue-router';
import TabsViewItem from './components/TabItem';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElTabs } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'Tabs',
    props: {},
    emits: emits,
    __scopeId: 'data-v-4368914b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const router = useRouter();
        const route = useRoute();
        const tabsStore = TabsStore();
        const tabItems = ref();
        onMounted(() => {
            if (!tabsStore.openedTabs.length) {
                tabsStore.addTab(route);
            }
            tabsStore.activeTabPath = route.path;
        });
        const tabChange = (tabPath) => {
            const tab = tabsStore.findTab(tabPath);
            if (tab) {
                router.push({ path: tab.path, query: { uncached: 'true' } });
                tabsStore.activeTabPath = tab.path;
            }
        };
        const closeTab = (tabPath) => {
            const lastTabPath = tabsStore.removeTab(tabPath);
            if (tabPath !== tabsStore.activeTabPath) {
                return;
            }
            if (lastTabPath) {
                tabChange(lastTabPath);
            }
        };
        const closeOtherTabs = (tabPath) => {
            tabsStore.removeOtherTabs(tabPath);
            tabChange(tabPath);
        };
        const closeTabs = (tabPath, type) => {
            tabsStore.removeTabs(tabPath, type);
            tabChange(tabPath);
        };
        const dropdownVisibleChange = (visible, tabPath) => {
            if (visible) {
                // 关闭其他下拉菜单
                tabItems.value.forEach(({ dropdownRef }) => {
                    if (dropdownRef.id !== tabPath) {
                        dropdownRef.handleClose();
                    }
                });
            }
        };
        return () => (
            <ElTabs
                {...ctx.attrs}
                modelValue={tabsStore.activeTabPath}
                onUpdate:modelValue={($v) => {
                    tabsStore.activeTabPath = $v as any;
                }}
                type="card"
                closable={tabsStore.openedTabs.length > 1}
                onTabChange={($event?: any) => {
                    (tabChange as any)($event);
                }}
                onTabRemove={($event?: any) => {
                    (closeTab as any)($event);
                }}
                class={'common-tabs'}
            >
                {(tabsStore.openedTabs || []).map((item) => (
                    <TabsViewItem
                        ref={tabItems}
                        tab-item={item}
                        onCloseTab={($event?: any) => {
                            (closeTab as any)($event);
                        }}
                        onCloseOtherTabs={($event?: any) => {
                            (closeOtherTabs as any)($event);
                        }}
                        onCloseTabs={($event?: any) => {
                            (closeTabs as any)($event);
                        }}
                        onDropdownVisibleChange={($event?: any) => {
                            (dropdownVisibleChange as any)($event);
                        }}
                        key={item.path}
                    />
                ))}
            </ElTabs>
        );
    },
    options,
);
