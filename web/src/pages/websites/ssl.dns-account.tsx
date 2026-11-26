import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { readCachedPageSize } from '@/utils/panel-cache';
import Create from '@/pages/websites/_components/ssl/dns-account/create/index';
import { Website } from '@/types/website';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { useSearchState } from '@/utils/search-reset';
import { getDNSName } from '@/utils/ssl';
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
    name: 'ssl.dns-account',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const paginationConfig = reactive({
            cacheSizeKey: 'dns-account-page-size',
            currentPage: 1,
            pageSize: readCachedPageSize('dns-account-page-size') || 20,
            total: 0,
        });
        let data = ref<any[]>();
        let createRef = ref();
        const opRef = ref();
        const buttons = [
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                click: function (row: Website.DnsAccount) {
                    openEdit(row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Website.DnsAccount) {
                    deleteAccount(row);
                },
            },
        ];
        const search = () => {
            const req = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
            };
            rpc.ssl.searchDNSAccounts(req).then((res) => {
                data.value = res.items;
                paginationConfig.total = Number(res.total);
            });
        };
        const openCreate = () => {
            createRef.value.acceptParams({ mode: 'create' });
        };
        const openEdit = (form: Website.DnsAccount) => {
            createRef.value.acceptParams({ mode: 'edit', form: form });
        };
        const deleteAccount = async (row: any) => {
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: [row.name],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('website.dnsAccountManage'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { id: number }) => rpc.website.deleteDNSAccount({ id: params.id }),
                params: { id: row.id },
            });
        };
        onMounted(() => {
            search();
        });
        const routerButton = [{ label: i18n.global.t('website.dnsAccountManage'), path: '/websites/ssl/dns-account' }];
        useSearchState(
            'website/ssl/dns-account/index',
            {
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        return () => (
            <div>
                <RouterButton buttons={routerButton} />
                <LayoutContent
                    backName="SSL"
                    title={$t('website.dnsAccountManage')}
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
                            </>
                        ),
                        main: () => (
                            <>
                                <ComplexTable
                                    data={unref(data)}
                                    cache-pagination={false}
                                    pagination-config={paginationConfig}
                                    onSearch={($event?: any) => {
                                        search();
                                    }}
                                >
                                    <ElTableColumn
                                        label={$t('commons.table.name')}
                                        fix
                                        show-overflow-tooltip
                                        prop="name"
                                    />
                                    <ElTableColumn
                                        label={$t('commons.table.type')}
                                        prop="type"
                                        v-slots={{
                                            default: ({ row }) => (
                                                <>
                                                    <span>{getDNSName(row.type)}</span>
                                                    {row.type === 'DnsPod' ? (
                                                        <ElTooltip
                                                            content={$t('ssl.dnsPodRemovedTip')}
                                                            {...TABLE_TOOLTIP_OPTIONS}
                                                        >
                                                            <ElTag type="danger" size="small" class={'ml-2'}>
                                                                {$t('ssl.dnsPodRemoved')}
                                                            </ElTag>
                                                        </ElTooltip>
                                                    ) : null}
                                                </>
                                            ),
                                        }}
                                    />
                                    <FuTableOperations
                                        ellipsis={1}
                                        buttons={buttons}
                                        label={$t('commons.table.operate')}
                                        fixed="right"
                                        fix
                                    />
                                </ComplexTable>
                            </>
                        ),
                    }}
                />
                <Create
                    ref={createRef}
                    onSaved={($event?: any) => {
                        search();
                    }}
                />
                <OpDialog
                    drawer
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
    name: 'SSL-DNS',
    meta: {
        activeMenu: '/websites/ssl',
        title: 'menu.ssl',
        detail: 'website.dnsAccountManage',
        permission: 'website_cert_view',
        hidden: true,
    },
});
