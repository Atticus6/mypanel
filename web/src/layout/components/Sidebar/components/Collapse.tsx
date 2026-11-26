import { $t } from '@/utils/i18n-t';
import { MenuStore } from '@/store';
import { MsgError, MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import bus from '@/global/bus';
import router from '@/routers';
import { loadProductProFromDB } from '@/utils/xpack';
import { routerToExtensionName, routerToNameWithQuery } from '@/utils/router';
import { changeToLocal, listNodes, setDefaultNodeInfo } from '@/utils/node';
import type { AuthInfo, AuthInfoUpdate } from '@/utils/rbac';
import { syncAuthInfo } from '@/utils/rbac';
import UserInfo from './user-info/index';
import NodeDrawer from './node-drawer/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './Collapse.styles.css';
import SvgIcon from '@/components/svg-icon/svg-icon';
import { Warning } from '@element-plus/icons-vue';
import { ArrowRight } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
    version?: string;
}

const emits = {
    openTask: (...args: unknown[]) => true,
    nodeSwitching: (...args: unknown[]) => true,
    userChange: (...args: unknown[]) => true,
};

const options = {
    name: 'Collapse',
    props: {
        version: { type: String },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-05ebdac9',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const currentUser = ref<AuthInfo>();
        const { globalStore, currentNode, currentNodeAddr, defaultNetwork, entrance, isEnterprise, isXpackOrEE } =
            useGlobalStore();
        const menuStore = MenuStore();
        const nodes = ref([]);
        const nodeOptions = ref([]);
        const loading = ref();
        const switchingNode = ref(false);
        const popoverVisible = ref(false);
        const nodeDrawerVisible = ref(false);
        const userInfoRef = ref();
        const defaultNodeLimit = 8;
        bus.on('refreshTask', () => {
            checkTask();
        });
        const loadCurrentName = () => {
            if (currentNode.value) {
                if (currentNode.value === 'local') {
                    return globalStore.getMasterAlias();
                }
                return currentNode.value;
            }
            return globalStore.getMasterAlias();
        };
        const visibleNodeOptions = computed(() => {
            return nodeOptions.value.slice(0, defaultNodeLimit);
        });
        const showMoreNodes = computed(() => {
            return nodeOptions.value.length > defaultNodeLimit;
        });
        const showPopover = async () => {
            await loadNodes();
        };
        const displayNodeName = (item) => {
            return item.name === 'local' ? globalStore.getMasterAlias() : item.name;
        };
        const openNodeDrawer = () => {
            nodeDrawerVisible.value = true;
            popoverVisible.value = false;
        };
        const handleFavoriteChange = async () => {
            await loadNodes();
        };
        const loadNodes = async () => {
            loading.value = true;
            nodes.value = [];
            if (!isXpackOrEE.value) {
                changeToLocal();
                loading.value = false;
                return;
            }
            await listNodes('all')
                .then((res) => {
                    nodes.value = res || [];
                    if (nodes.value.length === 0) {
                        setDefaultNodeInfo();
                    }
                    nodeOptions.value = nodes.value || [];
                    loading.value = false;
                })
                .catch(() => {
                    setDefaultNodeInfo();
                    loading.value = false;
                });
        };
        const changeNode = async (command: string) => {
            if (currentNode.value === command || switchingNode.value) {
                return;
            }
            switchingNode.value = true;
            ctx.emit('nodeSwitching', true);
            try {
                for (const item of nodes.value) {
                    if (item.name == command) {
                        if (command == 'local') {
                            if (isEnterprise.value) {
                                await loadCurrentUser('local');
                            }
                            await loadGlobalSetting('local');
                            currentNode.value = 'local';
                            currentNodeAddr.value = item.addr;
                            localStorage.removeItem('dashboardCache');
                            localStorage.removeItem('upgradeChecked');
                            loadProductProFromDB();
                            routerToNameWithQuery('home', { t: Date.now() });
                            return;
                        }
                        if (!item.isBound) {
                            MsgError(i18n.global.t('xpack.node.nodeUnbindHelper'));
                            return;
                        }
                        if (item.status !== 'Healthy') {
                            MsgError(i18n.global.t('xpack.node.nodeUnhealthyHelper'));
                            return;
                        }
                        if (__panelSetupProps.version != item.version) {
                            MsgError(i18n.global.t('setting.versionNotSame'));
                            return;
                        }
                        await loadGlobalSetting(command);
                        localStorage.removeItem('dashboardCache');
                        localStorage.removeItem('upgradeChecked');
                        currentNode.value = command;
                        currentNodeAddr.value = item.addr;
                        if (isEnterprise.value) {
                            await loadCurrentUser(command);
                        }
                        loadProductProFromDB();
                        routerToNameWithQuery('home', { t: Date.now() });
                        return;
                    }
                }
            } finally {
                switchingNode.value = false;
                ctx.emit('nodeSwitching', false);
            }
        };
        const loadGlobalSetting = async (currentNode?: string) => {
            await rpc.agentSetting.getInfo({}).then((res) => {
                defaultNetwork.value = res.defaultNetwork;
            });
        };
        const showNodes = () => {
            return nodes.value.length > 0 && isXpackOrEE.value;
        };
        const taskCount = ref(0);
        const checkTask = async () => {
            try {
                const res = await rpc.task.countExecuting({});
                taskCount.value = Number(res.count);
            } catch (error) {}
        };
        const openTask = () => {
            ctx.emit('openTask');
        };
        const openNodeDashboard = () => {
            routerToExtensionName('NodeDashboard', { uncached: 'true' });
        };
        const logout = () => {
            popoverVisible.value = false;
            ElMessageBox.confirm(i18n.global.t('commons.msg.sureLogOut'), i18n.global.t('commons.msg.infoTitle'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'warning',
            })
                .then(async () => {
                    await rpc.core.auth.logout({});
                    globalStore.setLogStatus(false);
                    globalStore.clearAuthInfo();
                    router.push({ name: 'entrance', params: { code: entrance.value } });
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(() => {});
        };
        const loadCurrentUser = async (currentNode?: string) => {
            const authInfo = await syncAuthInfo(currentNode);
            if (authInfo) {
                currentUser.value = authInfo;
                ctx.emit('userChange', authInfo);
            }
        };
        const changeUserInfo = () => {
            popoverVisible.value = false;
            loadCurrentUser();
            userInfoRef.value?.openDrawer();
        };
        onMounted(() => {
            loadNodes();
            checkTask();
            loadCurrentUser();
        });
        ctx.expose({ openUserInfo: changeUserInfo, logout });
        return () => (
            <div>
                <ElPopover
                    visible={unref(popoverVisible)}
                    onUpdate:visible={($v) => {
                        popoverVisible.value = $v as any;
                    }}
                    placement="right-end"
                    show-arrow={false}
                    offset={0}
                    width={200}
                    trigger="click"
                    onBeforeEnter={($event?: any) => {
                        (showPopover as any)($event);
                    }}
                    popper-class="custom-popover-dropdown"
                    v-slots={{
                        reference: () => (
                            <>
                                {!menuStore.isCollapse ? (
                                    <div class={'el-dropdown-link'}>
                                        <ElBadge is-dot value={unref(taskCount)} show-zero={false} offset={[5, 5]}>
                                            <ElButton link>
                                                <SvgIcon iconName="p-pcm" class={'icon'} />
                                                <span class={'ellipsis-text'}>{loadCurrentName()}</span>
                                            </ElButton>
                                        </ElBadge>
                                    </div>
                                ) : (
                                    <div class={'el-dropdown-link'}>
                                        <ElBadge is-dot value={unref(taskCount)} show-zero={false} offset={[-5, 5]}>
                                            <SvgIcon iconName="p-pcm" class={'icon'} />
                                        </ElBadge>
                                    </div>
                                )}
                            </>
                        ),
                    }}
                >
                    {
                        <div class={'dropdown-menu'} v-loading={unref(loading) || unref(switchingNode)}>
                            <div
                                onClick={($event?: any) => {
                                    (openTask as any)($event);
                                }}
                                class={'dropdown-item'}
                            >
                                <SvgIcon iconName="p-renwuzhongxin1" class={'icon'} />
                                {$t('menu.msgCenter')}
                                {unref(taskCount) !== 0 ? (
                                    <ElTag size="small" round class={'msg-tag'}>
                                        {unref(taskCount)}
                                    </ElTag>
                                ) : null}
                            </div>
                            {showNodes() ? <ElDivider class={'divider'} /> : null}
                            {unref(isXpackOrEE) ? (
                                <div
                                    onClick={($event?: any) => {
                                        (openNodeDashboard as any)($event);
                                    }}
                                    class={'dropdown-item'}
                                >
                                    <SvgIcon iconName="p-gailan1" class={'icon'} />
                                    {$t('xpack.node.multiOverview')}
                                </div>
                            ) : null}
                            {unref(isXpackOrEE) ? <ElDivider class={'divider'} /> : null}
                            {showNodes() ? (
                                <div>
                                    <ElScrollbar max-height="288px" noresize={true}>
                                        {(unref(visibleNodeOptions) || []).map((item) => (
                                            <div
                                                onClick={($event?: any) => {
                                                    changeNode(item.name);
                                                }}
                                                disabled={item.status !== 'Healthy'}
                                                class={'dropdown-item'}
                                                key={item.name}
                                            >
                                                <SvgIcon iconName="p-zhuji" class={'icon'} />
                                                <span class={'node-name'}>{displayNodeName(item)}</span>
                                                {item.status !== 'Healthy' || !item.isBound ? (
                                                    <ElTooltip
                                                        content={
                                                            item.isBound
                                                                ? $t('xpack.node.nodeUnhealthy')
                                                                : $t('xpack.node.nodeUnbind')
                                                        }
                                                        placement="right"
                                                    >
                                                        <ElIcon type="danger" class={'icon-status'}>
                                                            <Warning />
                                                        </ElIcon>
                                                    </ElTooltip>
                                                ) : null}
                                            </div>
                                        ))}
                                    </ElScrollbar>
                                    {unref(showMoreNodes) ? (
                                        <div
                                            onClick={($event?: any) => {
                                                $event.stopPropagation();
                                                (openNodeDrawer as any)($event);
                                            }}
                                            class={'dropdown-item more-node-button'}
                                        >
                                            <span class={'more-node-label'}>{$t('tabs.more')}</span>
                                            <span class={'more-node-count'}>
                                                {'+'}
                                                {unref(nodeOptions).length - defaultNodeLimit}
                                            </span>
                                            <ElIcon class={'more-node-arrow'}>
                                                <ArrowRight />
                                            </ElIcon>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    }
                </ElPopover>
                <NodeDrawer
                    v-model={nodeDrawerVisible.value}
                    nodes={unref(nodeOptions)}
                    master-alias={unref(globalStore).getMasterAlias()}
                    onChange={($event?: any) => {
                        (changeNode as any)($event);
                    }}
                    onFavoriteChange={($event?: any) => {
                        (handleFavoriteChange as any)($event);
                    }}
                />
                <UserInfo
                    ref={userInfoRef}
                    currentUser={unref(currentUser)}
                    onSearch={($event?: any) => {
                        loadCurrentUser();
                    }}
                />
            </div>
        );
    },
    options,
);
