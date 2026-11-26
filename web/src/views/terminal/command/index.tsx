import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import { Command } from '@/types/command';
import GroupDialog from '@/components/group/index';
import OperateDialog from '@/views/terminal/command/operate/index';
import ImportDialog from '@/views/terminal/command/import/index';
import { toRef, reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { downloadFile } from '@/utils/file';
import { rpc } from '@/lib/rpc';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElButtonGroup } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElTableColumn } from 'element-plus';
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
    name: 'command',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const data = ref();
        const selects = ref<any>([]);
        const groupList = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
            orderBy: 'name',
            order: 'ascending',
        });
        const info = ref();
        useSearchState('terminal/command/index', {
            search: info,
            page: toRef(paginationConfig, 'currentPage'),
            pageSize: toRef(paginationConfig, 'pageSize'),
        });
        const group = ref<string>('');
        const dialogRef = ref();
        const opRef = ref();
        const importDialogRef = ref();
        const acceptParams = () => {
            search();
            loadGroups();
        };
        const loadGroups = async () => {
            const res = await rpc.core.group.list({ type: 'command' });
            groupList.value = res.items || [];
        };
        const onOpenDialog = async (
            title: string,
            rowData: Partial<Command.CommandInfo> = {
                type: 'command',
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
            dialogGroupRef.value!.acceptParams({ type: 'command' });
        };
        const updateGroup = async (row: any) => {
            await rpc.core.command.update(row as any);
            search();
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
        };
        const onExport = async () => {
            loading.value = true;
            await rpc.core.command
                .export({})
                .then((res) => {
                    if (res.path) {
                        loading.value = false;
                        downloadFile(res.path, 'local');
                    }
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onImport = () => {
            importDialogRef.value.acceptParams();
        };
        const batchDelete = async (row: Command.CommandInfo | null) => {
            let names = [];
            let ids = [];
            if (row) {
                ids = [row.id];
                names = [row.name];
            } else {
                selects.value.forEach((item: Command.CommandInfo) => {
                    ids.push(item.id);
                    names.push(item.name);
                });
            }
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('terminal.quickCommand'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { ids: number[] }) => rpc.core.command.delete({ ids: params.ids }),
                params: { ids: ids },
            });
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
                click: batchDelete,
            },
        ];
        const search = async (column?: any) => {
            paginationConfig.orderBy = column?.order ? column.prop : paginationConfig.orderBy;
            paginationConfig.order = column?.order ? column.order : paginationConfig.order;
            let params = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                groupID: Number(group.value),
                info: info.value,
                orderBy: paginationConfig.orderBy,
                order: paginationConfig.order,
                type: 'command',
            };
            loading.value = true;
            await rpc.core.command
                .search(params)
                .then((res) => {
                    loading.value = false;
                    data.value = (res.items || []) as any;
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div>
                {withDirectives(
                    <LayoutContent
                        title={$t('terminal.quickCommand')}
                        v-slots={{
                            prompt: () => (
                                <>
                                    <ElAlert type="info" title={$t('terminal.quickCommandHelper')} closable={false} />
                                </>
                            ),
                            leftToolBar: () => (
                                <>
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            onOpenDialog('create');
                                        }}
                                    >
                                        {$t('commons.button.create')}
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
                                            batchDelete(null);
                                        }}
                                    >
                                        {$t('commons.button.delete')}
                                    </ElButton>
                                    <ElButtonGroup>
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (onImport as any)($event);
                                            }}
                                        >
                                            {$t('commons.button.import')}
                                        </ElButton>
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (onExport as any)($event);
                                            }}
                                        >
                                            {$t('commons.button.export')}
                                        </ElButton>
                                    </ElButtonGroup>
                                </>
                            ),
                            rightToolBar: () => (
                                <>
                                    <ElSelect
                                        modelValue={unref(group)}
                                        onUpdate:modelValue={($v) => {
                                            group.value = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            search();
                                        }}
                                        clearable
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('commons.table.group')}</> }}
                                    >
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
                                        onSortChange={($event?: any) => {
                                            (search as any)($event);
                                        }}
                                        onSearch={($event?: any) => {
                                            (search as any)($event);
                                        }}
                                        heightDiff={350}
                                    >
                                        <ElTableColumn type="selection" fix />
                                        <ElTableColumn
                                            label={$t('commons.table.name')}
                                            show-overflow-tooltip
                                            min-width="100"
                                            prop="name"
                                            fix
                                            sortable
                                        />
                                        <ElTableColumn
                                            label={$t('terminal.command')}
                                            min-width="300"
                                            show-overflow-tooltip
                                            prop="command"
                                            sortable
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.group')}
                                            show-overflow-tooltip
                                            min-width="100"
                                            prop="groupBelong"
                                            fix
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <FuSelectRwSwitch
                                                            modelValue={row.groupID}
                                                            onUpdate:modelValue={($v) => {
                                                                row.groupID = $v as any;
                                                            }}
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
                    />,
                    [[vLoading, unref(loading)]],
                )}
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
                <ImportDialog
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    ref={importDialogRef}
                />
                <GroupDialog
                    onSearch={($event?: any) => {
                        (loadGroups as any)($event);
                    }}
                    ref={dialogGroupRef}
                />
            </div>
        );
    },
    options,
);
