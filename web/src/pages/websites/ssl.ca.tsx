import { $t } from '@/utils/i18n-t';
import { readCachedPageSize } from '@/utils/panel-cache';
import { Website } from '@/types/website';
import { downloadCAFile } from '@/api/modules/website';
import i18n from '@/lang';
import { useSearchState } from '@/utils/search-reset';
import Create from '@/pages/websites/_components/ssl/ca/create/index';
import Upload from '@/pages/websites/_components/ssl/ca/upload/index';
import Detail from '@/pages/websites/_components/ssl/ca/detail/index';
import { getKeyName } from '@/utils/ssl';
import { dateFormat } from '@/utils/date';
import { rpc } from '@/lib/rpc';
import RouterButton from '@/components/router-button/index';
import LayoutContent from '@/components/layout-content/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ssl.ca',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const routerButton = [{ label: i18n.global.t('ssl.selfSigned'), path: '/websites/ssl/ca' }];
        const loading = ref(false);
        const data = ref();
        const createRef = ref();
        const uploadRef = ref();
        const paginationConfig = reactive({
            cacheSizeKey: 'ca-page-size',
            currentPage: 1,
            pageSize: readCachedPageSize('ca-page-size') || 20,
            total: 0,
        });
        const opRef = ref();
        const detailRef = ref();
        const buttons = [
            {
                label: i18n.global.t('ssl.detail'),
                click: function (row: Website.CA) {
                    detailRef.value.acceptParams(row.id);
                },
            },
            {
                label: i18n.global.t('commons.button.download'),
                click: function (row: Website.CA) {
                    onDownload(row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Website.CA) {
                    deleteca(row);
                },
            },
        ];
        useSearchState(
            'website/ssl/ca/index',
            {
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const search = async () => {
            const req = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
            };
            await rpc.ssl.searchCA(req).then((res) => {
                data.value = res.items as any;
                paginationConfig.total = Number(res.total);
            });
        };
        const openCreate = () => {
            createRef.value.acceptParams();
        };
        const deleteca = async (row: any) => {
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: [row.name],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('ssl.ca'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { id: number }) => rpc.ssl.deleteCA({ id: params.id }),
                params: { id: row.id },
            });
        };
        const onDownload = (row: Website.CA) => {
            loading.value = true;
            downloadCAFile({ id: row.id })
                .then((res) => {
                    const downloadUrl = window.URL.createObjectURL(new Blob([res]));
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = downloadUrl;
                    a.download = row.name + '.zip';
                    const event = new MouseEvent('click');
                    a.dispatchEvent(event);
                    window.URL.revokeObjectURL(downloadUrl);
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                <RouterButton buttons={routerButton} />
                <LayoutContent
                    backName="SSL"
                    title={$t('ssl.selfSigned')}
                    v-slots={{
                        leftToolBar: () => (
                            <>
                                {
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (openCreate as any)($event);
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
                                        onClick={($event?: any) => {
                                            unref(uploadRef)?.acceptParams();
                                        }}
                                        v-permission={true}
                                    >
                                        {$t('commons.button.upload')}
                                    </ElButton>
                                }
                            </>
                        ),
                        main: () => (
                            <>
                                {
                                    <ComplexTable
                                        data={unref(data)}
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        v-loading={unref(loading)}
                                    >
                                        <ElTableColumn
                                            label={$t('commons.table.name')}
                                            show-overflow-tooltip
                                            prop="name"
                                        />
                                        <ElTableColumn
                                            label={$t('website.keyType')}
                                            show-overflow-tooltip
                                            prop="keyType"
                                            v-slots={{ default: ({ row }) => <>{getKeyName(row.keyType)}</> }}
                                        />
                                        <ElTableColumn
                                            prop="createdAt"
                                            label={$t('commons.table.date')}
                                            formatter={dateFormat}
                                            show-overflow-tooltip
                                        />
                                        <FuTableOperations
                                            ellipsis={3}
                                            buttons={buttons}
                                            label={$t('commons.table.operate')}
                                            fix
                                            width="250px"
                                        />
                                    </ComplexTable>
                                }
                            </>
                        ),
                    }}
                />
                <Upload
                    ref={uploadRef}
                    onUploaded={($event?: any) => {
                        search();
                    }}
                />
                <Create
                    ref={createRef}
                    onClose={($event?: any) => {
                        search();
                    }}
                />
                <Detail ref={detailRef} />
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);

definePage({
    name: 'SSL-CA',
    meta: {
        activeMenu: '/websites/ssl',
        title: 'menu.ssl',
        detail: 'ssl.selfSigned',
        permission: 'website_cert_view',
        hidden: true,
    },
});
