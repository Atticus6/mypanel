import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import GroupDialog from '@/components/agent-group/index';
import OperateDialog from '@/pages/terminal/_components/host/operate/index';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { Host } from '@/types/host';
import { MsgSuccess } from '@/utils/message';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuSelectRwSwitch from '@/components/fu/FuSelectRwSwitch';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'host',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const data = ref();
        const groupList = ref();
        const selects = ref<any>([]);
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        const info = ref();
        useSearchState('terminal/host/index', {
            search: info,
            page: toRef(paginationConfig, 'currentPage'),
            pageSize: toRef(paginationConfig, 'pageSize'),
        });
        const group = ref<string>('');
        const opRef = ref();
        const acceptParams = () => {
            search();
        };
        const dialogRef = ref();
        const onOpenDialog = async (
            title: string,
            rowData: Partial<Host.Host> = {
                port: 22,
                user: 'root',
                authMode: 'password',
            },
        ) => {
            let params = {
                title,
                rowData: { ...rowData },
            };
            dialogRef.value!.acceptParams(params);
        };
        const dialogGroupRef = ref();
        const onOpenGroupDialog = () => {
            dialogGroupRef.value!.acceptParams({ type: 'host' });
        };
        const onBatchDelete = async (row: Host.Host | null) => {
            let names = [];
            let ids = [];
            if (row) {
                names = [row.name + '[' + row.addr + ']'];
                ids = [row.id];
            } else {
                selects.value.forEach((item: Host.Host) => {
                    names.push(item.name + '[' + item.addr + ']');
                    ids.push(item.id);
                });
            }
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('terminal.host'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { ids: number[] }) => rpc.host.deleteHosts(params),
                params: { ids: ids },
            });
        };
        const loadGroups = async () => {
            const res = await rpc.group.searchGroups({ type: 'host' });
            groupList.value = res.items;
        };
        const updateGroup = async (row: any) => {
            await rpc.host.updateHostGroup({ id: row.id, groupId: row.groupId });
            search();
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.edit'),
                click: (row: any) => {
                    onOpenDialog('edit', row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                click: (row: Host.Host) => {
                    onBatchDelete(row);
                },
            },
        ];
        const search = async () => {
            loadGroups();
            loading.value = true;
            try {
                // 直接使用生成的 RPC，不再经过 api/modules 的旧 REST 包装。
                const res = await rpc.host.search({
                    page: paginationConfig.currentPage,
                    pageSize: paginationConfig.pageSize,
                    groupId: Number(group.value) || 0,
                    info: info.value || '',
                });
                data.value = res.items || [];
                // proto 的 int64 在 TS 侧是 bigint，分页组件需要 number。
                paginationConfig.total = Number(res.total);
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div>
                {
                    <LayoutContent
                        title={$t('terminal.host', 2)}
                        v-slots={{
                            leftToolBar: () => (
                                <>
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            onOpenDialog('create');
                                        }}
                                    >
                                        {$t('terminal.addHost')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        plain
                                        onClick={($event?: any) => {
                                            onOpenGroupDialog();
                                        }}
                                    >
                                        {$t('commons.table.group')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        plain
                                        disabled={unref(selects).length === 0}
                                        onClick={($event?: any) => {
                                            onBatchDelete(null);
                                        }}
                                    >
                                        {$t('commons.button.delete')}
                                    </ElButton>
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
                                        <ElOption label={$t('commons.table.all')} value />
                                        {(unref(groupList) || []).map((item) => (
                                            <ElOption label={item.name} value={item.id} key={item.id} />
                                        ))}
                                    </ElSelect>
                                    <TableSearch
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        searchName={unref(info)}
                                        onUpdate:searchName={($v) => {
                                            info.value = $v as any;
                                        }}
                                    />
                                    <TableRefresh
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    />
                                </>
                            ),
                            main: () => (
                                <>
                                    <ComplexTable
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        selects={unref(selects)}
                                        onUpdate:selects={($v) => {
                                            selects.value = $v as any;
                                        }}
                                        data={unref(data)}
                                        onSearch={($event?: any) => {
                                            (search as any)($event);
                                        }}
                                    >
                                        <ElTableColumn type="selection" fix />
                                        <ElTableColumn label={$t('terminal.ip')} prop="addr" fix />
                                        <ElTableColumn
                                            label={$t('commons.login.username')}
                                            show-overflow-tooltip
                                            prop="user"
                                        />
                                        <ElTableColumn label={$t('commons.table.port')} prop="port" />
                                        <ElTableColumn
                                            label={$t('commons.table.group')}
                                            prop="group"
                                            min-width="80"
                                            show-overflow-tooltip
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <FuSelectRwSwitch
                                                            v-model={row.groupId}
                                                            onChange={($event?: any) => {
                                                                updateGroup(row);
                                                            }}
                                                            v-slots={{ read: () => <>{row.groupBelong}</> }}
                                                        >
                                                            {(unref(groupList) || []).map((item) => (
                                                                <ElOption
                                                                    label={item.name}
                                                                    value={item.id}
                                                                    key={item.id}
                                                                />
                                                            ))}
                                                        </FuSelectRwSwitch>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.title')}
                                            show-overflow-tooltip
                                            prop="name"
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.description')}
                                            show-overflow-tooltip
                                            prop="description"
                                        />
                                        <FuTableOperations
                                            width="200px"
                                            buttons={buttons}
                                            label={$t('commons.table.operate')}
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
                />
                <OperateDialog
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    ref={dialogRef}
                />
                <GroupDialog
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    ref={dialogGroupRef}
                />
            </div>
        );
    },
    options,
);
