import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import ConfirmDialog from '@/components/confirm-dialog/index';
import LogRouter from '@/views/log/router/index';
import { dateFormat } from '@/utils/date';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import ComplexTable from '@/components/table/complex/ComplexTable';
import Status from '@/components/status/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'login',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isEnterprise } = useGlobalStore();
        const loading = ref();
        const data = ref();
        const confirmDialogRef = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        const searchInfo = ref<string>('');
        useSearchState(
            'log/login/index',
            {
                search: searchInfo,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const searchStatus = ref<string>('');
        const search = async () => {
            let params = {
                info: searchInfo.value,
                status: searchStatus.value,
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
            };
            loading.value = true;
            await rpc.core.log
                .searchLoginLogs(params)
                .then((res) => {
                    loading.value = false;
                    data.value = res.items as any;
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onClean = async () => {
            let params = {
                header: i18n.global.t('logs.deleteLogs'),
                operationInfo: i18n.global.t('commons.msg.delete'),
                submitInputInfo: i18n.global.t('logs.deleteLogs'),
            };
            confirmDialogRef.value!.acceptParams(params);
        };
        const loadMsg = (msg: string) => {
            if (msg === 'ErrAuth') {
                return i18n.global.t('commons.login.errorAuthInfo');
            }
            if (msg === 'ErrMFA') {
                return i18n.global.t('commons.login.errorMfaInfo');
            }
            return msg;
        };
        const onSubmitClean = async () => {
            await rpc.core.log.cleanLogs({ logType: 'login' });
            search();
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
        };
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                {withDirectives(
                    <LayoutContent
                        title={$t('logs.login')}
                        v-slots={{
                            search: () => (
                                <>
                                    <LogRouter current="LoginLog" />
                                </>
                            ),
                            leftToolBar: () => (
                                <>
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            plain
                                            onClick={($event?: any) => {
                                                onClean();
                                            }}
                                        >
                                            {$t('logs.deleteLogs')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                </>
                            ),
                            rightToolBar: () => (
                                <>
                                    <ElSelect
                                        modelValue={unref(searchStatus)}
                                        onUpdate:modelValue={($v) => {
                                            searchStatus.value = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            search();
                                        }}
                                        clearable
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('commons.table.status')}</> }}
                                    >
                                        <ElOption label={$t('commons.table.all')} value />
                                        <ElOption label={$t('commons.status.success')} value="Success" />
                                        <ElOption label={$t('commons.status.failed')} value="Failed" />
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
                                        title="login-log-refresh"
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
                                        data={unref(data)}
                                        onSearch={($event?: any) => {
                                            (search as any)($event);
                                        }}
                                        heightDiff={330}
                                    >
                                        <ElTableColumn label={$t('logs.loginIP')} prop="ip" />
                                        {unref(isEnterprise) ? (
                                            <ElTableColumn label={$t('commons.login.username')} prop="user" />
                                        ) : null}
                                        <ElTableColumn label={$t('logs.loginAddress')} prop="address" />
                                        <ElTableColumn
                                            label={$t('logs.loginAgent')}
                                            show-overflow-tooltip
                                            prop="agent"
                                        />
                                        <ElTableColumn
                                            label={$t('logs.loginStatus')}
                                            prop="status"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <Status status={row.status} msg={loadMsg(row.message)} />
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            prop="createdAt"
                                            label={$t('commons.table.date')}
                                            formatter={dateFormat}
                                            show-overflow-tooltip
                                        />
                                    </ComplexTable>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
                <ConfirmDialog
                    ref={confirmDialogRef}
                    onConfirm={($event?: any) => {
                        (onSubmitClean as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
