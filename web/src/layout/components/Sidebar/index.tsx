import { $t } from '@/utils/i18n-t';
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { RouteRecordRaw, useRoute, useRouter } from 'vue-router';
import { loadingSvg } from '@/utils/svg';
import Logo from './components/Logo';
import Collapse from './components/Collapse';
import SubItem from './components/SubItem';
import { MenuStore } from '@/store';
import { loadMenuList } from '@/utils/menu';
import PrimaryMenu from '@/assets/images/menu-bg.svg?component';
import { useGlobalStore } from '@/composables/useGlobalStore';
import type { AuthInfo, AuthInfoUpdate } from '@/utils/rbac';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { cn } from '@/utils/cn';
import { ElScrollbar } from 'element-plus';
import { ElSkeleton } from 'element-plus';
import { ElMenu } from 'element-plus';
import SvgIcon from '@/components/svg-icon/svg-icon';

interface CodemodProps {
    [key: string]: any;

}

const emits = {
    'menuClick': (...args: unknown[]) => true,
    'openTask': (...args: unknown[]) => true,
};



const options = {
        name: "Sidebar",
        props: {},
        emits: emits,
        __scopeId: "data-v-b4d297d7",
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const route = useRoute();
        const router = useRouter();
        const menuStore = MenuStore();
        const { currentNode, isAdmin, isNodeAdmin, menuAccordion, permissions, masterOnlyPermissions } = useGlobalStore();
        const nodeSelectorRef = ref<InstanceType<typeof Collapse>>();
        const currentUser = ref<AuthInfo>();
        const activeMenu = computed(() => {
            const { meta, path } = route;
            return typeof meta.activeMenu === 'string' ? meta.activeMenu : path;
        });
        const isCollapse = computed((): boolean => menuStore.isCollapse);
        let routerMenus = computed((): RouteRecordRaw[] => {
            return buildRegisteredMenuList(menuStore.menuList as RouteRecordRaw[]).filter(
                (route) => route.meta && !route.meta.hideInSidebar,
            );
        });
        function buildRegisteredMenuList(source: RouteRecordRaw[]): RouteRecordRaw[] {
            return source.reduce<RouteRecordRaw[]>((result, item) => {
                if (!item.name || !router.hasRoute(item.name)) {
                    return result;
                }
        
                const menuItem = { ...item };
                if (Array.isArray(item.children)) {
                    menuItem.children = buildRegisteredMenuList(item.children);
                    if (item.children.length > 0 && menuItem.children.length === 0) {
                        return result;
                    }
                }
                result.push(menuItem);
                return result;
            }, []);
        }
        const screenWidth = ref(0);
        const handleWindowResize = () => {
            screenWidth.value = document.body.clientWidth;
            if (!isCollapse.value && screenWidth.value < 1200) menuStore.setCollapse();
            if (isCollapse.value && screenWidth.value > 1200) menuStore.setCollapse();
        };
        window.addEventListener('resize', handleWindowResize);
        const handleMenuClick = (path) => {
            ctx.emit('menuClick', path);
        };
        const openTask = () => {
            ctx.emit('openTask');
        };
        onMounted(() => {
            screenWidth.value = document.body.clientWidth;
            if (!isCollapse.value && screenWidth.value < 1200) {
                menuStore.setCollapse();
            }
            if (!menuStore.isMenuLoaded) {
                loadMenuList();
            }
        });
        onBeforeUnmount(() => {
            window.removeEventListener('resize', handleWindowResize);
        });
        const menuWatcher = watch(
            [
                () => currentNode.value,
                () => isAdmin.value,
                () => isNodeAdmin.value,
                () => [...permissions.value].sort().join('|'),
                () => [...masterOnlyPermissions.value].sort().join('|'),
            ],
            (values, previousValues) => {
                if (values[0] !== previousValues[0]) {
                    menuStore.resetMenuList();
                }
                loadMenuList();
            },
        );
        const handleNodeSwitching = (switching: boolean) => {
            if (switching) {
                menuWatcher.pause();
            } else {
                menuWatcher.resume();
            }
        };
        return () => (
            <div element-loading-text="Loading..." element-loading-spinner={loadingSvg} element-loading-svg-view-box="-10, -10, 50, 50" element-loading-background="rgba(122, 122, 122, 0.01)" class={cn("sidebar-container", { 'is-collapsed': unref(isCollapse) })}>{(!unref(isCollapse)) ? <div class={"fixed"}><PrimaryMenu /></div> : null}<Logo isCollapse={unref(isCollapse)} /><ElScrollbar>{(!menuStore.isMenuLoaded) ? <ElSkeleton rows={8} animated class={"p-4"} /> : <ElMenu default-active={unref(activeMenu)} router={false} collapse={unref(isCollapse)} collapse-transition={false} unique-opened={!unref(menuAccordion)} onSelect={($event?: any) => { (handleMenuClick as any)($event); }} class={"custom-menu"}><SubItem menuList={unref(routerMenus)} level={0} /></ElMenu>}</ElScrollbar><Collapse ref={nodeSelectorRef} version={menuStore.systemVersion} onOpenTask={($event?: any) => { (openTask as any)($event); }} onNodeSwitching={($event?: any) => { (handleNodeSwitching as any)($event); }} onUserChange={($event?: any) => { currentUser.value = $event; }} class={"node-selector"} /><div class={cn("user-actions", { 'is-collapsed': unref(isCollapse) })}>{(unref(currentUser)) ? <button type="button" aria-label={$t('xpack.user.userInfo') + ' ' + unref(currentUser).name} onClick={($event?: any) => { unref(nodeSelectorRef)?.openUserInfo(); }} class={"user-entry"}><SvgIcon iconName="p-gerenzhongxin1" class={"icon"} />{(!unref(isCollapse)) ? <span class={"user-name"}>{unref(currentUser).name}</span> : null}</button> : null}<button type="button" aria-label={$t('header.exitSystem')} onClick={($event?: any) => { unref(nodeSelectorRef)?.logout(); }} class={"user-entry logout-entry"}><SvgIcon iconName="p-tuichudenglu3" class={"icon"} /></button></div></div>
        );
    },
    options,
);
