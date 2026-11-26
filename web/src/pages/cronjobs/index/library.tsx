import { $t } from '@/utils/i18n-t';
interface ScriptInfo {
    id: number;
    name: string;
    script: string;
    groups: string;
    isInteractive: boolean;
    groupList: Array<number>;
    groupBelong: Array<string>;
    description: string;
    createdAt: Date;
}
interface ScriptOperate {
    id: number;
    name: string;
    script: string;
    groups: string;
    description: string;
}
import { InfoFilled } from '@element-plus/icons-vue';
import { useSearchState } from '@/utils/search-reset';
import { dateFormat, getCurrentDateFormatted } from '@/utils/date';
import { deepCopy } from '@/utils/misc';
import { newUUID } from '@/utils/id';
import GroupDialog from '@/components/group/index';
import TaskLog from '@/components/log/task/index';
import OperateDialog from '@/pages/cronjobs/_components/library/operate/index';
import TerminalDialog from '@/pages/cronjobs/_components/library/run/index';
import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
import CodemirrorDrawer from '@/components/codemirror-pro/drawer';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import '@/pages/cronjobs/_components/library/index.styles.css';
import LayoutContent from '@/components/layout-content/index';
import { ArrowDown } from '@element-plus/icons-vue';
import FuDropdownItem from '@/components/fu/FuDropdownItem';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'library',
    props: {},
    emits: emits,
    __scopeId: 'data-v-97c2e7fc',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { globalStore, currentNode, isAdminOrNodeAdmin, isMobile, isOffline } = useGlobalStore();
        const myDetail = ref();
        const loading = ref();
        const selects = ref<any>([]);
        const opRef = ref();
        const deleteIDs = ref<number[]>([]);
        const runRef = ref();
        const taskLogRef = ref();
        const scriptSync = ref();
        const data = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        const searchInfo = ref<string>('');
        useSearchState(
            'cronjob/library/index',
            {
                search: searchInfo,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const group = ref<string>('');
        const groupOptions = ref();
        const dialogGroupRef = ref();
        const onOpenGroupDialog = () => {
            dialogGroupRef.value!.acceptParams({ type: 'script' });
        };
        const dialogRef = ref();
        const onOpenDialog = async (
            title: string,
            rowData: Partial<ScriptOperate> = {
                name: '',
            },
        ) => {
            let params = {
                title,
                rowData: { ...rowData },
            };
            dialogRef.value!.acceptParams(params);
        };
        const showScript = async (row: any) => {
            let param = {
                header: i18n.global.t('commons.button.view') + ' - ' + row.name,
                detailInfo: row.script,
                mode: 'shell',
            };
            myDetail.value!.acceptParams(param);
        };
        const onDelete = async (row: ScriptInfo | null) => {
            let names = [];
            let ids = [];
            if (row) {
                ids = [row.id];
                names = [row.name];
            } else {
                for (const item of selects.value) {
                    names.push(item.name);
                    ids.push(item.id);
                }
            }
            deleteIDs.value = ids;
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('cronjob.library.script'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: null,
                params: null,
            });
        };
        const onSubmitDelete = async () => {
            await rpc.core.script.delete({ ids: deleteIDs.value });
            MsgSuccess(i18n.global.t('commons.msg.deleteSuccess'));
            search();
        };
        const onSync = async () => {
            ElMessageBox.confirm(
                i18n.global.t('cronjob.library.syncHelper'),
                i18n.global.t('cronjob.library.syncNow'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            ).then(async () => {
                loading.value = true;
                let taskID = newUUID();
                await rpc.core.script
                    .sync({ taskId: taskID })
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        openTaskLog(taskID);
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID, true, 'local');
        };
        const loadSyncStatus = async () => {
            const res = await rpc.core.setting.getBaseInfo({});
            scriptSync.value = res.scriptSync;
        };
        const handleSyncOp = async (command: string) => {
            let val = 'Enable';
            switch (command) {
                case 'sync':
                    onSync();
                    return;
                case 'turnOnSync':
                    val = 'Enable';
                    break;
                case 'turnOffSync':
                    val = 'Disable';
                    break;
                default:
                    return;
            }
            ElMessageBox.confirm(
                i18n.global.t('cronjob.library.' + command + 'Helper'),
                i18n.global.t('cronjob.library.' + command),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                },
            ).then(async () => {
                loading.value = true;
                await rpc.core.setting
                    .updateSetting({ key: 'ScriptSync', value: val })
                    .then(() => {
                        loadSyncStatus();
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const search = async () => {
            let params = {
                info: searchInfo.value,
                groupId: Number(group.value),
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
            };
            loading.value = true;
            await rpc.core.script
                .search(params)
                .then((res) => {
                    loading.value = false;
                    data.value = res.items as any;
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const loadGroupOptions = async () => {
            const res = await rpc.core.group.list({ type: 'script' });
            groupOptions.value = (res.items as any) || [];
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.handle'),
                disabled: () => {
                    return !isAdminOrNodeAdmin.value;
                },
                click: (row: ScriptInfo) => {
                    ElMessageBox.confirm(
                        i18n.global.t('cronjob.library.handleHelper', [
                            currentNode.value === 'local' ? globalStore.getMasterAlias() : currentNode.value,
                            row.name,
                        ]),
                        i18n.global.t('commons.button.handle'),
                        {
                            confirmButtonText: i18n.global.t('commons.button.confirm'),
                            cancelButtonText: i18n.global.t('commons.button.cancel'),
                            type: 'info',
                        },
                    ).then(() => {
                        runRef.value!.acceptParams({ scriptID: row.id, scriptName: row.name });
                    });
                },
            },
            {
                label: i18n.global.t('commons.button.clone'),
                permission: true,
                nodeAdmin: true,
                disabled: (row: any) => {
                    return !row.isSystem;
                },
                click: (row: ScriptInfo) => {
                    let item = deepCopy(row) as ScriptInfo;
                    item.id = 0;
                    item.name += '-' + getCurrentDateFormatted();
                    item.groupList = row.groupList || [];
                    item.groupBelong = row.groupBelong || [];
                    onOpenDialog('clone', item);
                },
            },
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                nodeAdmin: true,
                disabled: (row: any) => {
                    return row.isSystem;
                },
                click: (row: ScriptInfo) => {
                    onOpenDialog('edit', row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                nodeAdmin: true,
                disabled: (row: any) => {
                    return row.isSystem;
                },
                click: (row: ScriptInfo) => {
                    onDelete(row);
                },
            },
        ];
        onMounted(() => {
            search();
            loadSyncStatus();
            loadGroupOptions();
        });
        return () => (
            <div>
                {
                    <LayoutContent
                        title={$t('logs.login')}
                        v-slots={{
                            leftToolBar: () => (
                                <>
                                    {
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                onOpenDialog('create');
                                            }}
                                            v-permission={true}
                                            v-node-admin={true}
                                        >
                                            {$t('commons.button.create')}
                                        </ElButton>
                                    }
                                    <ElDropdown
                                        onCommand={($event?: any) => {
                                            (handleSyncOp as any)($event);
                                        }}
                                        v-slots={{
                                            dropdown: () => (
                                                <>
                                                    <ElDropdownMenu>
                                                        {
                                                            <FuDropdownItem
                                                                command="sync"
                                                                v-permission={true}
                                                                v-node-admin={true}
                                                            >
                                                                {$t('cronjob.library.syncNow')}
                                                            </FuDropdownItem>
                                                        }
                                                        {unref(scriptSync) === 'Disable' ? (
                                                            <FuDropdownItem
                                                                command="turnOnSync"
                                                                v-permission={true}
                                                                v-node-admin={true}
                                                            >
                                                                {$t('cronjob.library.turnOnSync')}
                                                            </FuDropdownItem>
                                                        ) : null}
                                                        {unref(scriptSync) === 'Enable' ? (
                                                            <FuDropdownItem
                                                                command="turnOffSync"
                                                                v-permission={true}
                                                                v-node-admin={true}
                                                            >
                                                                {$t('cronjob.library.turnOffSync')}
                                                            </FuDropdownItem>
                                                        ) : null}
                                                    </ElDropdownMenu>
                                                </>
                                            ),
                                        }}
                                    >
                                        <ElButton type="primary" plain>
                                            {$t('commons.button.sync')}
                                            <ElIcon>
                                                <ArrowDown />
                                            </ElIcon>
                                        </ElButton>
                                    </ElDropdown>
                                    {!unref(isOffline) && unref(scriptSync) ? (
                                        <span class={'sync-status'}>
                                            {$t(
                                                unref(scriptSync) === 'Enable'
                                                    ? 'commons.status.autoSyncEnabled'
                                                    : 'commons.status.autoSyncDisabled',
                                            )}
                                            <ElTooltip content={$t('cronjob.library.autoSyncHelper')} placement="top">
                                                <ElIcon tabindex="0" aria-label={$t('cronjob.library.autoSyncHelper')}>
                                                    <InfoFilled />
                                                </ElIcon>
                                            </ElTooltip>
                                        </span>
                                    ) : null}
                                    {
                                        <ElButton
                                            type="primary"
                                            plain
                                            onClick={($event?: any) => {
                                                onOpenGroupDialog();
                                            }}
                                            v-permission={true}
                                            v-node-admin={true}
                                        >
                                            {$t('commons.table.group')}
                                        </ElButton>
                                    }
                                    {
                                        <ElButton
                                            plain
                                            disabled={unref(selects).length === 0}
                                            onClick={($event?: any) => {
                                                onDelete(null);
                                            }}
                                            v-permission={true}
                                            v-node-admin={true}
                                        >
                                            {$t('commons.button.delete')}
                                        </ElButton>
                                    }
                                </>
                            ),
                            rightToolBar: () => (
                                <>
                                    <ElSelect
                                        v-model={group.value}
                                        onChange={($event?: any) => {
                                            search();
                                        }}
                                        clearable
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('commons.table.group')}</> }}
                                    >
                                        {(unref(groupOptions) || []).map((item) => (
                                            <ElOption label={item.name} value={item.id} key={item.id} />
                                        ))}
                                    </ElSelect>
                                    <TableSearch
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        searchName={unref(searchInfo)}
                                        onUpdate:searchName={($v) => {
                                            searchInfo.value = $v as any;
                                        }}
                                    />
                                    <TableRefresh
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    />
                                    <TableSetting
                                        title="script-refresh"
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    />
                                </>
                            ),
                            main: () => (
                                <>
                                    <ComplexTable
                                        selection-context={() => [unref(searchInfo), unref(group)]}
                                        row-key="id"
                                        selects={unref(selects)}
                                        onUpdate:selects={($v) => {
                                            selects.value = $v as any;
                                        }}
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        data={unref(data)}
                                        onSearch={($event?: any) => {
                                            (search as any)($event);
                                        }}
                                        heightDiff={300}
                                    >
                                        <ElTableColumn type="selection" fix />
                                        <ElTableColumn
                                            label={$t('commons.table.name')}
                                            show-overflow-tooltip
                                            prop="name"
                                            min-width="140"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElText
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                showScript(row);
                                                            }}
                                                            class={'cursor-pointer'}
                                                        >
                                                            {row.name}
                                                        </ElText>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('cronjob.library.isInteractive')}
                                            prop="isInteractive"
                                            min-width="60"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>{$t(row.isInteractive ? 'commons.true' : 'commons.false')}</>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.group')}
                                            min-width="100"
                                            prop="group"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.isSystem ? (
                                                            <ElButton size="small" class={'mr-3'}>
                                                                {$t('menu.system')}
                                                            </ElButton>
                                                        ) : null}
                                                        {row.groupBelong ? (
                                                            <span>
                                                                {(row.groupBelong || []).map((item, index) => (
                                                                    <ElButton size="small" key={index}>
                                                                        {item}
                                                                    </ElButton>
                                                                ))}
                                                            </span>
                                                        ) : null}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            min-width="120"
                                            label={$t('commons.table.description')}
                                            show-overflow-tooltip
                                            prop="description"
                                        />
                                        <ElTableColumn
                                            prop="createdAt"
                                            label={$t('commons.table.date')}
                                            formatter={dateFormat}
                                            show-overflow-tooltip
                                        />
                                        <FuTableOperations
                                            width="300px"
                                            buttons={buttons}
                                            ellipsis={10}
                                            label={$t('commons.table.operate')}
                                            min-width="isMobile ? 'auto' : 200"
                                            fixed={unref(isMobile) ? false : 'right'}
                                            fix
                                        />
                                    </ComplexTable>
                                </>
                            ),
                        }}
                        v-loading={unref(loading)}
                    />
                }
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    onSubmit={($event?: any) => {
                        (onSubmitDelete as any)($event);
                    }}
                />
                <OperateDialog
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    ref={dialogRef}
                />
                <GroupDialog
                    onSearch={($event?: any) => {
                        (loadGroupOptions as any)($event);
                    }}
                    ref={dialogGroupRef}
                />
                <CodemirrorDrawer ref={myDetail} />
                <TerminalDialog ref={runRef} />
                <TaskLog
                    ref={taskLogRef}
                    width="70%"
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);

definePage({
    name: 'Library',
    meta: { activeMenu: '/cronjobs', title: 'cronjob.library.library', permission: 'cronjob_view', hidden: true },
});
