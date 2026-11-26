import { $t } from '@/utils/i18n-t';
interface NodeItem {
    id: number;
    groupID?: number;
    groupBelong?: string;
    addr: string;
    status: string;
    version: string;
    isXpack: boolean;
    isBound: boolean;
    isFavorite?: boolean;
    name: string;
}
import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { MsgError } from '@/utils/message';
import type { Host } from '@/types/host';
import HostDialog from '@/components/terminal/host-create';
import type { TerminalConnectionOptions } from './types';
import { rpc } from '@/lib/rpc';
interface ConnectionTreeItem {
    id: string;
    label: string;
    kind: 'group' | 'node' | 'host';
    children?: ConnectionTreeItem[];
    node?: NodeItem;
    wsID?: number;
}
import './index.styles.css';
import { Plus } from '@element-plus/icons-vue';
import { House } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
    openSession?: (options: TerminalConnectionOptions) => Promise<void>;
    modelValue?: boolean;
}

const emits = {
    'update:modelValue': (value: boolean) => true,
};

const options = {
    name: 'connection-menu',
    props: {
        openSession: Function,
        modelValue: { type: Boolean },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-21f7124b',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const visible = computed({
            get: () => __panelSetupProps.modelValue,
            set: ($v) => ctx.emit('update:modelValue', $v),
        });
        const { isNodeAdmin, isXpackOrEE, currentNode, globalStore } = useGlobalStore();
        const hostDialogRef = ref<InstanceType<typeof HostDialog>>();
        const onNewSsh = () => {
            if (isNodeAdmin.value || connecting.value) return;
            visible.value = false;
            hostDialogRef.value?.acceptParams({ isLocal: false });
        };
        const onHostCreated = (title: string, wsID: number) => connect(wsID, title);
        const connectLocal = () => connect(0, i18n.global.t('terminal.localhost'));
        const onLocalConfigured = (nodeName: string) =>
            connect(
                0,
                `${i18n.global.t('terminal.localhost')} (${nodeName === 'local' ? globalStore.getMasterAlias() : nodeName})`,
                nodeName,
            );
        const hostTree = ref<Array<Host.HostTree>>([]);
        const treeRef = ref<InstanceType<typeof ElTree>>();
        const connectionFilter = ref('');
        const nodes = ref<NodeItem[]>([]);
        const loadingConnections = ref(false);
        const connecting = ref(false);
        const connectionTree = computed<ConnectionTreeItem[]>(() => {
            const groups: ConnectionTreeItem[] = [];
            const childNodes = isXpackOrEE.value
                ? nodes.value.filter((node) => node.name !== 'local' && node.status !== 'Deleted')
                : [];
            if (childNodes.length > 0) {
                groups.push({
                    id: 'panel-nodes',
                    label: i18n.global.t('xpack.node.node'),
                    kind: 'group',
                    children: childNodes.map((node) => ({
                        id: `node-${node.id}`,
                        label: node.name,
                        kind: 'node',
                        node,
                    })),
                });
            }
            if (!isNodeAdmin.value) {
                groups.push(
                    ...hostTree.value.map((group): ConnectionTreeItem => ({
                        id: `host-group-${group.id}`,
                        label: group.label,
                        kind: 'group',
                        children: (group.children || []).map((host) => ({
                            id: `host-${host.id}`,
                            label: host.label,
                            kind: 'host',
                            wsID: host.id,
                        })),
                    })),
                );
            }
            return groups;
        });
        const loadNodes = async () => {
            // 多节点属于 xpack 能力，已剔除；单进程下没有远端节点。
            nodes.value = [];
        };
        const loadHosts = async () => {
            hostTree.value = [];
            if (isNodeAdmin.value) return;
            const res = await rpc.host.tree({ info: '' });
            hostTree.value = (res.groups || []) as unknown as Host.HostTree[];
        };
        const loadConnections = async () => {
            loadingConnections.value = true;
            try {
                await Promise.allSettled([loadHosts(), loadNodes()]);
            } finally {
                loadingConnections.value = false;
            }
        };
        watch([connectionFilter, connectionTree], async () => {
            await nextTick();
            treeRef.value?.filter(connectionFilter.value);
        });
        const filterConnection = (value: string, data: ConnectionTreeItem) => {
            const filter = value.trim().toLowerCase();
            return !filter || [data.label, data.node?.addr || ''].some((text) => text.toLowerCase().includes(filter));
        };
        const connectItem = (item: ConnectionTreeItem) => {
            if (item.kind === 'node' && item.node) return connect(0, item.label, item.node.name);
            if (item.kind === 'host' && item.wsID !== undefined) return connect(item.wsID, item.label);
        };
        const connect = async (wsID: number, title: string, nodeName?: string) => {
            if (connecting.value || (wsID > 0 && isNodeAdmin.value)) return;
            connecting.value = true;
            visible.value = false;
            const targetNode = nodeName || currentNode.value || 'local';
            try {
                if (wsID === 0) {
                    const res = await rpc.agentSetting.testLocalConn({});
                    if (!res.ok) {
                        if (!nodeName) {
                            hostDialogRef.value?.acceptParams({ isLocal: true, nodeName: targetNode });
                        } else {
                            MsgError(`${title}: ${i18n.global.t('terminal.connLocalErr')}`);
                        }
                        return;
                    }
                    await __panelSetupProps.openSession({
                        title: nodeName
                            ? title
                            : `${title} (${targetNode === 'local' ? globalStore.getMasterAlias() : targetNode})`,
                        wsID,
                        nodeName: targetNode,
                    });
                    return;
                }
                const res = await rpc.host.testByID({ id: wsID });
                await __panelSetupProps.openSession({
                    title,
                    wsID,
                    error: res.ok ? '' : 'Authentication failed. Please check the host information!',
                });
            } finally {
                connecting.value = false;
            }
        };
        ctx.expose({ connectLocal });
        return () => (
            <>
                <ElPopover
                    visible={unref(visible)}
                    onUpdate:visible={($v) => {
                        visible.value = $v as any;
                    }}
                    trigger="click"
                    placement="bottom-start"
                    width={400}
                    popper-class="terminal-connection-popover"
                    onBeforeEnter={($event?: any) => {
                        (loadConnections as any)($event);
                    }}
                    v-slots={{
                        reference: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        $event.stopPropagation();
                                    }}
                                    onKeydown={($event?: any) => {
                                        $event.stopPropagation();
                                    }}
                                    icon="Plus"
                                    text
                                    aria-label={$t('terminal.createConn')}
                                    class={'terminal-connection-add'}
                                />
                            </>
                        ),
                    }}
                >
                    <div class={'terminal-connection-menu'}>
                        <div class={'terminal-connection-actions'}>
                            {!unref(isNodeAdmin) ? (
                                <ElButton
                                    text
                                    disabled={unref(connecting)}
                                    onClick={($event?: any) => {
                                        (onNewSsh as any)($event);
                                    }}
                                    class={'terminal-connection-action'}
                                >
                                    <ElIcon>
                                        <Plus />
                                    </ElIcon>
                                    {$t('terminal.createConn')}
                                </ElButton>
                            ) : null}
                            <ElButton
                                text
                                disabled={unref(connecting)}
                                onClick={($event?: any) => {
                                    connectLocal();
                                }}
                                class={'terminal-connection-action'}
                            >
                                <ElIcon>
                                    <House />
                                </ElIcon>
                                {$t('terminal.localhost')}
                            </ElButton>
                        </div>
                        {unref(connectionTree).length > 0 || !unref(isNodeAdmin) || unref(loadingConnections) ? (
                            <>
                                <ElInput
                                    modelValue={unref(connectionFilter)}
                                    onUpdate:modelValue={($v) => {
                                        connectionFilter.value = $v as any;
                                    }}
                                    size="small"
                                    clearable
                                    prefix-icon="Search"
                                    placeholder={$t('commons.button.search')}
                                    aria-label={$t('terminal.createConn')}
                                />
                                {withDirectives(
                                    <ElTree
                                        ref={treeRef}
                                        node-key="id"
                                        default-expand-all
                                        expand-on-click-node={false}
                                        data={unref(connectionTree)}
                                        filter-node-method={filterConnection}
                                        empty-text={$t('commons.msg.noneData')}
                                        class={'terminal-connection-tree'}
                                        v-slots={{
                                            default: ({ data }) => (
                                                <>
                                                    {data.kind === 'group' ? (
                                                        <span class={'terminal-connection-group'}>{data.label}</span>
                                                    ) : (
                                                        <ElButton
                                                            text
                                                            disabled={unref(connecting)}
                                                            title={
                                                                data.node
                                                                    ? `${data.label} (${data.node.addr})`
                                                                    : data.label
                                                            }
                                                            onClick={($event?: any) => {
                                                                $event.stopPropagation();
                                                                connectItem(data);
                                                            }}
                                                            class={'terminal-connection-item'}
                                                        >
                                                            <span class={'terminal-connection-label'}>
                                                                {data.label}
                                                            </span>
                                                            {data.node ? (
                                                                <span class={'terminal-connection-address'}>
                                                                    {data.node.addr}
                                                                </span>
                                                            ) : null}
                                                        </ElButton>
                                                    )}
                                                </>
                                            ),
                                        }}
                                    />,
                                    [[vLoading, unref(loadingConnections)]],
                                )}
                            </>
                        ) : null}
                    </div>
                </ElPopover>
                <HostDialog
                    ref={hostDialogRef}
                    onOnConnTerminal={($event?: any) => {
                        (onHostCreated as any)($event);
                    }}
                    onOnNewLocal={($event?: any) => {
                        (onLocalConfigured as any)($event);
                    }}
                    onLoadHostTree={($event?: any) => {
                        (loadHosts as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
