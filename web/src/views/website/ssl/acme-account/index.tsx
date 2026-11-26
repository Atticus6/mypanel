import { $t } from '@/utils/i18n-t';
import { readCachedPageSize } from '@/utils/panel-cache';
import { Website } from '@/types/website';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { useSearchState } from '@/utils/search-reset';
import Create from './create/index';
import { getAccountName, getKeyName } from '@/utils/ssl';
import { MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import permissionDirective from '@/directives/modules/permission';
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
    name: 'acme-account',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isProductPro } = useGlobalStore();
        const loading = ref(false);
        const data = ref();
        const createRef = ref();
        const paginationConfig = reactive({
            cacheSizeKey: 'acme-account-page-size',
            currentPage: 1,
            pageSize: readCachedPageSize('acme-account-page-size') || 20,
            total: 0,
        });
        const opRef = ref();
        const buttons = [
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Website.AcmeAccount) {
                    deleteAccount(row);
                },
            },
        ];
        const search = async () => {
            const req = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
            };
            await rpc.ssl.searchACMEAccounts(req).then((res) => {
                data.value = res.items;
                paginationConfig.total = Number(res.total);
            });
        };
        const update = (row: Website.AcmeAccount) => {
            rpc.ssl.updateACME({ id: row.id, useProxy: row.useProxy }).then(() => {
                search();
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            });
        };
        const openCreate = () => {
            createRef.value.acceptParams();
        };
        const deleteAccount = async (row: any) => {
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: [row.email],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('website.acmeAccountManage'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { id: number }) => rpc.ssl.deleteACME({ id: params.id }),
                params: { id: row.id },
            });
        };
        const routerButton = [
            { label: i18n.global.t('website.acmeAccountManage'), path: '/websites/ssl/acme-account' },
        ];
        useSearchState(
            'website/ssl/acme-account/index',
            {
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                <RouterButton buttons={routerButton} />
                <LayoutContent
                    backName="SSL"
                    title={$t('website.acmeAccountManage')}
                    v-slots={{
                        leftToolBar: () => (
                            <>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            (openCreate as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.create')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </>
                        ),
                        prompt: () => (
                            <>
                                <ElAlert title={$t('ssl.acmeHelper')} type="info" closable={false} />
                            </>
                        ),
                        main: () => (
                            <>
                                {withDirectives(
                                    <ComplexTable
                                        data={unref(data)}
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    >
                                        <ElTableColumn
                                            label={$t('website.email')}
                                            fix
                                            show-overflow-tooltip
                                            prop="email"
                                            min-width="100px"
                                        />
                                        <ElTableColumn
                                            label={$t('website.acmeAccountType')}
                                            fix
                                            show-overflow-tooltip
                                            prop="type"
                                            v-slots={{ default: ({ row }) => <>{getAccountName(row.type)}</> }}
                                        />
                                        <ElTableColumn
                                            label={$t('website.keyType')}
                                            prop="keyType"
                                            v-slots={{ default: ({ row }) => <>{getKeyName(row.keyType)}</> }}
                                        />
                                        {unref(isProductPro) ? (
                                            <ElTableColumn
                                                label={$t('website.useProxy')}
                                                min-width="100px"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {withDirectives(
                                                                <ElSwitch
                                                                    modelValue={row.useProxy}
                                                                    onUpdate:modelValue={($v) => {
                                                                        row.useProxy = $v as any;
                                                                    }}
                                                                    onChange={($event?: any) => {
                                                                        update(row);
                                                                    }}
                                                                />,
                                                                [[permissionDirective, true]],
                                                            )}
                                                        </>
                                                    ),
                                                }}
                                            />
                                        ) : null}
                                        <ElTableColumn label="URL" show-overflow-tooltip prop="url" min-width="300px" />
                                        <FuTableOperations
                                            ellipsis={1}
                                            buttons={buttons}
                                            label={$t('commons.table.operate')}
                                            fixed="right"
                                            fix
                                        />
                                    </ComplexTable>,
                                    [[vLoading, unref(loading)]],
                                )}
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
