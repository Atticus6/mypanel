import { $t } from '@/utils/i18n-t';
interface Locale {
    zh: string;
    en: string;
    'zh-Hant': string;
    ja: string;
    ms: string;
    'pt-br': string;
    ru: string;
    ko: string;
    tr: string;
    'es-es': string;
    fa: string;
    lo: string;
}
interface NodeItemBase {
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
import DrawerPro from '@/components/drawer-pro/index';
import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
type NodeItem = NodeItemBase & {
    group?: string;
};
import './index.styles.css';
import SvgIcon from '@/components/svg-icon/svg-icon';
import { Warning } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
    modelValue?: boolean;
    nodes?: NodeItem[];
    masterAlias?: string;
}

const emits = {
    'update:modelValue': (arg0?: boolean) => true,
    change: (arg0?: string) => true,
    'favorite-change': () => true,
};

const options = {
    name: 'node-drawer',
    props: {
        modelValue: Boolean,
        nodes: Array,
        masterAlias: String,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-29e0ba65',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isAdmin } = useGlobalStore();
        const keyword = ref('');
        const favoriteLoadingIDs = ref<number[]>([]);
        const drawerVisible = computed({
            get: () => __panelSetupProps.modelValue,
            set: (value: boolean) => ctx.emit('update:modelValue', value),
        });
        const filteredNodes = computed(() => {
            const searchValue = keyword.value.trim().toLowerCase();
            return __panelSetupProps.nodes.filter((item) => {
                const group = displayGroupName(item);
                if (!searchValue) {
                    return true;
                }
                return [item.name, group, item.addr].some((value) =>
                    String(value || '')
                        .toLowerCase()
                        .includes(searchValue),
                );
            });
        });
        const sortedNodes = computed(() => {
            return [...filteredNodes.value];
        });
        const commonNodeLimit = 8;
        const commonNodes = computed(() => {
            return sortedNodes.value.slice(0, commonNodeLimit);
        });
        const nodeGroups = computed(() => {
            const groupMap = new Map<string, { key: string; label: string; items: NodeItem[] }>();
            const commonNodeIDs = new Set(commonNodes.value.map((item) => item.id));
            for (const item of sortedNodes.value.filter((item) => !commonNodeIDs.has(item.id))) {
                const label = displayGroupName(item);
                if (!groupMap.has(label)) {
                    groupMap.set(label, {
                        key: label,
                        label,
                        items: [],
                    });
                }
                groupMap.get(label)!.items.push(item);
            }
            const groups = Array.from(groupMap.values()).sort((a, b) => a.label.localeCompare(b.label));
            if (commonNodes.value.length > 0) {
                groups.unshift({
                    key: 'common',
                    label: i18n.global.t('xpack.node.commonNodes'),
                    items: commonNodes.value,
                });
            }
            return groups;
        });
        const displayNodeName = (item: NodeItem) => {
            return item.name === 'local' ? __panelSetupProps.masterAlias : item.name;
        };
        const displayGroupName = (item: NodeItem) => {
            return item.group || item.groupBelong || i18n.global.t('commons.table.default');
        };
        const selectNode = (name: string) => {
            ctx.emit('change', name);
            ctx.emit('update:modelValue', false);
        };
        const toggleFavorite = async (row: NodeItem) => {
            // 节点收藏属于 xpack 能力，单进程下没有远端节点，保留本地状态即可。
            row.isFavorite = !row.isFavorite;
            ctx.emit('favorite-change');
        };
        const handleClose = () => {
            ctx.emit('update:modelValue', false);
        };
        watch(
            () => __panelSetupProps.modelValue,
            (value) => {
                if (value) {
                    keyword.value = '';
                }
            },
        );
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('setting.selectNode')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    content: () => (
                        <>
                            <div class={'node-drawer'}>
                                <ElInput
                                    modelValue={unref(keyword)}
                                    onUpdate:modelValue={($v) => {
                                        keyword.value = $v as any;
                                    }}
                                    placeholder={$t('xpack.node.searchNodePlaceholder')}
                                    clearable
                                    class={'node-search-input'}
                                />
                                <div class={'node-grid'}>
                                    {(unref(nodeGroups) || []).map((group) => (
                                        <section class={'node-section'} key={group.key}>
                                            <div class={'node-table'}>
                                                <div class={'node-table__header'}>
                                                    <div class={'node-table__cell node-table__cell--node'}>
                                                        <span class={'node-table__group-title'}>{group.label}</span>
                                                        <span class={'node-table__summary'}>{group.items.length}</span>
                                                    </div>
                                                    <div class={'node-table__cell node-table__cell--addr'}>
                                                        {$t('home.ip')}
                                                    </div>
                                                </div>
                                                {(group.items || []).map((row) => (
                                                    <div class={'node-table__row'} key={row.name}>
                                                        <div class={'node-table__cell node-table__cell--node'}>
                                                            <ElTooltip
                                                                content={
                                                                    row.isFavorite
                                                                        ? $t('commons.table.unpin')
                                                                        : $t('commons.table.pin')
                                                                }
                                                                placement="left"
                                                            >
                                                                {unref(isAdmin) ? (
                                                                    <ElButton
                                                                        link
                                                                        type={row.isFavorite ? 'warning' : 'info'}
                                                                        loading={unref(favoriteLoadingIDs).includes(
                                                                            row.id,
                                                                        )}
                                                                        onClick={($event?: any) => {
                                                                            $event.stopPropagation();
                                                                            toggleFavorite(row);
                                                                        }}
                                                                        class={'node-favorite-button'}
                                                                    >
                                                                        <SvgIcon
                                                                            iconName="p-pushpin"
                                                                            className="node-pin-icon"
                                                                        />
                                                                    </ElButton>
                                                                ) : null}
                                                            </ElTooltip>
                                                            <div class={'node-name-cell'}>
                                                                <SvgIcon iconName="p-zhuji" class={'icon'} />
                                                                <ElButton
                                                                    link
                                                                    type="primary"
                                                                    onClick={($event?: any) => {
                                                                        selectNode(row.name);
                                                                    }}
                                                                    class={'node-name-button'}
                                                                >
                                                                    {displayNodeName(row)}
                                                                </ElButton>
                                                                {row.status !== 'Healthy' || !row.isBound ? (
                                                                    <ElTooltip
                                                                        content={
                                                                            row.isBound
                                                                                ? $t('xpack.node.nodeUnhealthy')
                                                                                : $t('xpack.node.nodeUnbind')
                                                                        }
                                                                        placement="left"
                                                                    >
                                                                        <span class={'node-status-wrap'}>
                                                                            <ElIcon type="danger" class={'icon-status'}>
                                                                                <Warning />
                                                                            </ElIcon>
                                                                        </span>
                                                                    </ElTooltip>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                        <div class={'node-table__cell node-table__cell--addr'}>
                                                            <span class={'node-table__addr-text'}>{row.addr}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </section>
                                    ))}
                                </div>
                            </div>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
