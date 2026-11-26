import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import { MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { ArrowRight } from '@element-plus/icons-vue';
import { sortMenu } from '@/utils/misc';
interface DialogProps {
    hideMenu: string;
    menuAccordion: string;
}
type Node = RenderContentContext['node'];
import './index.styles.css';
import { cn } from '@/utils/cn';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: (...args: unknown[]) => true,
};

const options = {
    name: 'hidemenu',
    props: {},
    emits: emits,
    __scopeId: 'data-v-41b4b294',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { menuAccordion } = useGlobalStore();
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            menuAccordion: '',
        });
        const availableMenuLabels = new Set([
            'Home-Menu',
            'App-Menu',
            'Website-Menu',
            'Website',
            'SSL',
            'WebsiteTemplate',
            'Container-Menu',
            'System-Menu',
            'File',
            'Monitorx',
            'FirewallPort',
            'Process',
            'SSH',
            'Disk',
            'Terminal-Menu',
            'Cronjob-Menu',
            'Log-Menu',
            'Setting-Menu',
        ]);
        const filterAvailableMenus = (menus: any[]): any[] =>
            menus
                .filter((item) => availableMenuLabels.has(item.label))
                .map((item) => ({ ...item, children: item.children ? filterAvailableMenus(item.children) : [] }));
        const acceptParams = (params: DialogProps): void => {
            drawerVisible.value = true;
            form.menuAccordion = params.menuAccordion || 'Disable';
            let hideMenu = JSON.parse(params.hideMenu);
            hideMenu = filterAvailableMenus(hideMenu);
            sortMenu(hideMenu);
            treeData.hideMenu = hideMenu;
        };
        const allowDrag = (draggingNode: Node) => {
            const { label } = draggingNode.data;
            const forbidden = ['Home-Menu'];
            return draggingNode.level < 3 && !forbidden.some((key) => label.includes(key));
        };
        const allowDrop = (draggingNode: Node, dropNode: Node, type: AllowDropType) => {
            const restricted = ['App-Menu', 'Setting-Menu'];
            const isDraggingFirstLevel = draggingNode.level === 1;
            const isDraggingSecondLevel = draggingNode.level === 2;
            const isDropFirstLevel = dropNode.level === 1;
            const isDropSecondLevel = dropNode.level === 2;
            if (restricted.includes(draggingNode.data.label) && isDropSecondLevel) {
                return false;
            }
            if (dropNode.data.label === 'Home-Menu') {
                return type !== 'prev' && type !== 'inner';
            }

            if (draggingNode.parent && draggingNode.parent.childNodes.length === 1) {
                return false;
            }

            if (
                (isDraggingSecondLevel && isDropFirstLevel) ||
                (isDraggingFirstLevel && isDropSecondLevel && draggingNode.childNodes?.length === 0)
            ) {
                return type === 'prev' || type === 'next';
            }

            if ((isDropFirstLevel && isDraggingFirstLevel) || (isDropSecondLevel && isDraggingSecondLevel)) {
                return type === 'prev' || type === 'next';
            }

            return false;
        };
        const handleDrop = (draggingNode: Node, dropNode: Node) => {
            const siblingNodes = dropNode.level == 2 ? dropNode.parent.parent.data : dropNode.parent.data;
            const updateSort = (nodes) => {
                nodes.forEach((node, index) => {
                    node.sort = (index + 1) * 100;
                    if (node.children && node.children.length) {
                        updateSort(node.children);
                    }
                });
            };

            if (siblingNodes.length) {
                updateSort(siblingNodes);
            }
        };
        const treeData = reactive({
            hideMenu: [],
            checkedData: [],
        });
        const onChangeShow = async (row: any) => {
            if (row.children) {
                for (const item of row.children) {
                    item.isShow = row.isShow;
                }
                return;
            }
            for (const item of treeData.hideMenu) {
                if (!item.children) {
                    continue;
                }
                let allHide = true;
                for (const item2 of item.children) {
                    if (item2.isShow) {
                        allHide = false;
                    }
                    if (item2.id === row.id && item2.isShow) {
                        item.isShow = true;
                        return;
                    }
                }
                if (allHide) {
                    item.isShow = false;
                }
            }
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        const onSaveSetting = async (key: string, val: string) => {
            loading.value = true;
            try {
                await rpc.core.setting.updateSetting({
                    key,
                    value: val,
                });
                if (key === 'MenuAccordion') {
                    menuAccordion.value = val === 'Enable';
                }
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                ctx.emit('search');
            } finally {
                loading.value = false;
            }
        };
        const saveHideMenus = async () => {
            ElMessageBox.confirm(i18n.global.t('setting.confirmMessage'), i18n.global.t('setting.menuSetting'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                const updateJson = JSON.stringify(treeData.hideMenu);
                await rpc.core.setting
                    .updateMenu({ key: 'HideMenu', value: updateJson })
                    .then(async () => {
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        loading.value = false;
                        drawerVisible.value = false;
                        window.location.reload();
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const defaultHideMenus = async () => {
            ElMessageBox.confirm(i18n.global.t('setting.recoverMessage'), i18n.global.t('setting.menuSetting'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                await rpc.core.setting
                    .defaultMenu({})
                    .then(async () => {
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        loading.value = false;
                        drawerVisible.value = false;
                        window.location.reload();
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={drawerVisible.value}
                header={$t('setting.menuSetting')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="normal"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (defaultHideMenus as any)($event);
                                    }}
                                >
                                    {$t('commons.button.setDefault')}
                                </ElButton>
                                <ElButton
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (saveHideMenus as any)($event);
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                <div class={'menu-setting-cards'}>
                    <ElCard shadow="never" class={'menu-setting-card'}>
                        <div class={'menu-setting-card__row'}>
                            <div>
                                <div class={'menu-setting-card__label'}>{$t('setting.menuAccordion')}</div>
                                <span class={'input-help'}>{$t('setting.menuAccordionHelper')}</span>
                            </div>
                            <ElRadioGroup
                                onChange={($event?: any) => {
                                    onSaveSetting('MenuAccordion', form.menuAccordion);
                                }}
                                v-model={form.menuAccordion}
                            >
                                <ElRadioButton value="Enable">
                                    <span>{$t('commons.button.enable')}</span>
                                </ElRadioButton>
                                <ElRadioButton value="Disable">
                                    <span>{$t('commons.button.disable')}</span>
                                </ElRadioButton>
                            </ElRadioGroup>
                        </div>
                    </ElCard>
                    <ElCard shadow="never" class={'menu-setting-card'}>
                        <div class={'menu-setting-card__label mb-3'}>{$t('setting.menuHide')}</div>
                        <ElAlert closable={false} title={$t('setting.menuSettingHelper')} type="warning" />
                        <ElTree
                            data={treeData.hideMenu}
                            allow-drag={allowDrag}
                            allow-drop={allowDrop}
                            draggable
                            node-key="id"
                            icon={ArrowRight}
                            onNodeDrop={($event?: any) => {
                                (handleDrop as any)($event);
                            }}
                            class={'menu-hide-tree mt-3'}
                            v-slots={{
                                default: ({ node, data }) => (
                                    <>
                                        <div class={'group grid w-full grid-cols-4 items-center gap-4 py-2'}>
                                            <span
                                                class={'col-span-2'}
                                                style={{ paddingLeft: `${(node.level - 1) * 16}px` }}
                                            >
                                                {i18n.global.t(data.title)}
                                            </span>
                                            <span class={'flex w-[60px] justify-center'}>
                                                {!data.disabled ? (
                                                    <ElSwitch
                                                        v-model={data.isShow}
                                                        onChange={($event?: any) => {
                                                            onChangeShow(data);
                                                        }}
                                                        onClick={($event?: any) => {
                                                            $event.stopPropagation();
                                                        }}
                                                        onMousedown={($event?: any) => {
                                                            $event.stopPropagation();
                                                        }}
                                                    />
                                                ) : (
                                                    <span>{'-'}</span>
                                                )}
                                            </span>
                                            <span
                                                class={cn(
                                                    'hidden cursor-move text-right',
                                                    data.label == 'Home-Menu' || data.children?.length > 0
                                                        ? ''
                                                        : 'group-hover:block',
                                                )}
                                            >
                                                {' ⋮⋮ '}
                                            </span>
                                        </div>
                                    </>
                                ),
                            }}
                        />
                    </ElCard>
                </div>
            </DrawerPro>
        );
    },
    options,
);
