import { $t } from '@/utils/i18n-t';
import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
type Init<T extends DescMessage> = MessageInitShape<T>;
import { ComposeTemplateSchema } from '@/gen/panel/agent/v1/container_pb';
type TemplateInfo = Init<typeof ComposeTemplateSchema>;
interface RepoInfo {
    id: number;
    createdAt?: string;
    name: string;
    downloadUrl: string;
    protocol: string;
    username: string;
    password: string;
    auth: boolean;
}
import { useSearchState } from '@/utils/search-reset';
import { dateFormat, getCurrentDateFormatted } from '@/utils/date';
import { downloadWithContent } from '@/utils/file';
import DetailDialog from '@/pages/containers/_components/template/detail/index';
import ImportDialog from '@/pages/containers/_components/template/import/index';
import OperatorDialog from '@/pages/containers/_components/template/operator/index';
import { rpc } from '@/lib/rpc';
import DockerStatus from '@/pages/containers/_components/docker-status/index';
import i18n from '@/lang';
import LayoutContent from '@/components/layout-content/index';
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
    name: 'template',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const data = ref();
        const selects = ref<any>([]);
        const dialogImportRef = ref();
        const detailRef = ref();
        const dialogRef = ref();
        const opRef = ref();
        const isActive = ref(false);
        const isExist = ref(false);
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        const searchName = ref();
        useSearchState(
            'container/template/index',
            {
                search: searchName,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const search = async () => {
            if (!isActive.value || !isExist.value) {
                return;
            }
            let params = {
                info: searchName.value,
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
            };
            loading.value = true;
            await rpc.container
                .searchComposeTemplates(params)
                .then((res) => {
                    loading.value = false;
                    data.value = res.items || [];
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onOpenDetail = async (row: TemplateInfo) => {
            detailRef.value.acceptParams({ content: row.content });
        };
        const onImport = () => {
            dialogImportRef.value.acceptParams();
        };
        const onExport = () => {
            ElMessageBox.confirm(
                i18n.global.t('container.exportHelper', [selects.value.length]),
                i18n.global.t('commons.button.export'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                },
            ).then(async () => {
                const exportData = selects.value.map((item: TemplateInfo) => ({
                    name: item.name,
                    description: item.description,
                    content: item.content,
                }));
                const content = JSON.stringify(exportData, null, 2);
                const fileName = `1panel-docker-compose-template-${getCurrentDateFormatted()}.json`;
                downloadWithContent(content, fileName);
            });
        };
        const onOpenDialog = async (
            title: string,
            rowData: Partial<TemplateInfo> = {
                name: '',
                content: '',
                description: '',
            },
        ) => {
            let params = {
                title,
                rowData: { ...rowData },
            };
            dialogRef.value!.acceptParams(params);
        };
        const onBatchDelete = async (row: RepoInfo | null) => {
            let ids = [];
            let names = [];
            if (row) {
                names.push(row.name);
                ids.push(row.id);
            } else {
                selects.value.forEach((item: RepoInfo) => {
                    names.push(item.name);
                    ids.push(item.id);
                });
            }
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: names,
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('container.composeTemplate'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { ids: number[] }) => rpc.container.deleteTemplates({ ids: params.ids }),
                params: { ids: ids },
            });
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                disabled: (row: RepoInfo) => {
                    return row.downloadUrl === 'docker.io';
                },
                click: (row: RepoInfo) => {
                    onOpenDialog('edit', row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                disabled: (row: RepoInfo) => {
                    return row.downloadUrl === 'docker.io';
                },
                click: (row: RepoInfo) => {
                    onBatchDelete(row);
                },
            },
        ];
        return () => (
            <div v-loading={unref(loading)}>
                <DockerStatus
                    isActive={unref(isActive)}
                    onUpdate:isActive={($v) => {
                        isActive.value = $v as any;
                    }}
                    isExist={unref(isExist)}
                    onUpdate:isExist={($v) => {
                        isExist.value = $v as any;
                    }}
                    loading={unref(loading)}
                    onUpdate:loading={($v) => {
                        loading.value = $v as any;
                    }}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                {unref(isExist) ? (
                    <LayoutContent
                        title={$t('container.composeTemplate', 2)}
                        class={{ mask: !unref(isActive) }}
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
                                        >
                                            {$t('commons.button.create')}
                                        </ElButton>
                                    }
                                    {
                                        <ElButton
                                            type="primary"
                                            plain
                                            disabled={unref(selects).length === 0}
                                            onClick={($event?: any) => {
                                                onBatchDelete(null);
                                            }}
                                            v-permission={true}
                                        >
                                            {$t('commons.button.delete')}
                                        </ElButton>
                                    }
                                    <ElButtonGroup>
                                        {
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    (onImport as any)($event);
                                                }}
                                                v-permission={true}
                                            >
                                                {$t('commons.button.import')}
                                            </ElButton>
                                        }
                                        {
                                            <ElButton
                                                disabled={unref(selects).length === 0}
                                                onClick={($event?: any) => {
                                                    (onExport as any)($event);
                                                }}
                                                v-permission={true}
                                            >
                                                {$t('commons.button.export')}
                                            </ElButton>
                                        }
                                    </ElButtonGroup>
                                </>
                            ),
                            rightToolBar: () => (
                                <>
                                    <TableSearch
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        searchName={unref(searchName)}
                                        onUpdate:searchName={($v) => {
                                            searchName.value = $v as any;
                                        }}
                                    />
                                    <TableRefresh
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    />
                                    <TableSetting
                                        title="template-refresh"
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    />
                                </>
                            ),
                            main: () => (
                                <>
                                    <ComplexTable
                                        selection-context={() => [unref(searchName)]}
                                        row-key="id"
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
                                        heightDiff={300}
                                    >
                                        <ElTableColumn type="selection" fix />
                                        <ElTableColumn
                                            label={$t('commons.table.name')}
                                            min-width="100"
                                            prop="name"
                                            sortable
                                            fix
                                            show-overflow-tooltip
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElText
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                onOpenDetail(row);
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
                                            label={$t('commons.table.description')}
                                            prop="description"
                                            min-width="200"
                                            fix
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.createdAt')}
                                            min-width="80"
                                            fix
                                            v-slots={{
                                                default: ({ row }) => <>{dateFormat(0, 0, row.createdAt)}</>,
                                            }}
                                        />
                                        <FuTableOperations buttons={buttons} label={$t('commons.table.operate')} />
                                    </ComplexTable>
                                </>
                            ),
                        }}
                    />
                ) : null}
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <ImportDialog
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    ref={dialogImportRef}
                />
                <DetailDialog ref={detailRef} />
                <OperatorDialog
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    ref={dialogRef}
                />
            </div>
        );
    },
    options,
);

definePage({
    name: 'ComposeTemplate',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.composeTemplate',
        hidden: true,
    },
});
