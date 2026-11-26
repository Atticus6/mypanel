import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { useSearchState } from '@/utils/search-reset';
import { dateFormat } from '@/utils/date';
import { rpc } from '@/lib/rpc';
import Operate from '@/pages/views/setting/backup-account/operate/index';
import DetailShow from '@/components/detail-show/index';
import { Backup } from '@/types/backup';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { Base64 } from 'js-base64';
import { useGlobalStore } from '@/composables/useGlobalStore';
import permissionDirective from '@/directives/modules/permission';
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
    name: 'backup-account',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isProductPro, docsUrl, isMobile } = useGlobalStore();
        const loading = ref();
        const data = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
            type: '',
            name: '',
        });
        useSearchState(
            'setting/backup-account/index',
            {
                search: toRef(paginationConfig, 'name'),
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const opRef = ref();
        const dialogRef = ref();
        const detailRef = ref();
        const search = async () => {
            let params = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                type: paginationConfig.type,
                info: paginationConfig.name,
            };
            loading.value = true;
            await rpc.backup
                .search(params)
                .then((res) => {
                    loading.value = false;
                    data.value = res.items || [];
                    for (const bac of data.value) {
                        if (bac.vars) {
                            bac.varsJson = JSON.parse(bac.vars);
                        }
                    }
                    data.value.sort((a, b) => {
                        if (a.name === 'localhost') return -1;
                        if (b.name === 'localhost') return 1;
                        return 0;
                    });
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const loadEndpoint = (row: any) => {
            if (row.type === 'COS' || row.type === 'MINIO' || row.type === 'OSS' || row.type === 'S3') {
                return row.varsJson['endpoint'];
            }
            if (row.type === 'KODO') {
                return row.varsJson['domain'];
            }
            return '';
        };
        const hasTokenRefresh = (row: any) => {
            return row.type === 'OneDrive' || row.type === 'ALIYUN';
        };
        const onDelete = async (row: Backup.BackupInfo) => {
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: ['[ ' + row.type + ' ] ' + row.name],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('setting.backupAccount'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { id: number; name: string; isPublic: boolean }) =>
                    params.isPublic
                        ? rpc.core.backups.delete({ name: params.name })
                        : rpc.backup.deleteBackupAccount({ id: params.id }),
                params: { id: row.id, name: row.name, isPublic: row.isPublic },
            });
        };
        const onOpenDialog = async (
            title: string,
            rowData: Partial<Backup.BackupInfo> = {
                id: 0,
                isPublic: false,
                varsJson: {},
            },
        ) => {
            let params = {
                title,
                rowData: { ...rowData },
            };
            dialogRef.value!.acceptParams(params);
        };
        const onInspect = (row: any) => {
            let list = [];
            list.push({ label: i18n.global.t('commons.table.name'), value: row.name, hideCopy: true });
            list.push({
                label: i18n.global.t('commons.table.type'),
                value: i18n.global.t('setting.' + row.type),
                hideCopy: true,
            });
            if (row.type === 'S3') {
                list.push({ label: i18n.global.t('setting.mode'), value: row.varsJson['mode'] });
            }
            if (
                row.type === 'COS' ||
                row.type === 'KODO' ||
                row.type === 'MINIO' ||
                row.type === 'OSS' ||
                row.type === 'S3'
            ) {
                if (row.rememberAuth) {
                    list.push({ label: 'Access Key ID', value: Base64.decode(row.accessKey) });
                    list.push({ label: 'Secret Key', value: Base64.decode(row.credential) });
                }
            }
            if (row.type === 'UPYUN') {
                if (row.rememberAuth) {
                    list.push({ label: i18n.global.t('setting.operator'), value: Base64.decode(row.accessKey) });
                    list.push({ label: i18n.global.t('commons.login.password'), value: Base64.decode(row.credential) });
                }
            }
            if (row.type === 'WebDAV' || row.type === 'SFTP') {
                list.push({ label: i18n.global.t('setting.address'), value: row.varsJson['address'] || '' });
                list.push({ label: i18n.global.t('commons.login.username'), value: Base64.decode(row.accessKey) });
            }
            if (row.type === 'SFTP') {
                list.push({ label: i18n.global.t('commons.table.port'), value: row.varsJson['port'] || '' });
                if (row.rememberAuth) {
                    list.push({ label: i18n.global.t('terminal.authMode'), value: row.varsJson['authMode'] });
                    if (row.varsJson['authMode'] === 'key') {
                        list.push({ label: i18n.global.t('terminal.key'), value: Base64.decode(row.credential) });
                        list.push({ label: i18n.global.t('terminal.keyPassword'), value: row.varsJson['passPhrase'] });
                    } else {
                        list.push({
                            label: i18n.global.t('commons.login.password'),
                            value: Base64.decode(row.credential),
                        });
                    }
                }
            }
            if (row.type === 'COS' || row.type === 'S3') {
                list.push({ label: 'Region', value: row.varsJson['region'] || '' });
            }
            if (
                row.type === 'COS' ||
                row.type === 'KODO' ||
                row.type === 'MINIO' ||
                row.type === 'OSS' ||
                row.type === 'S3'
            ) {
                list.push({
                    label: row.type === 'KODO' ? i18n.global.t('setting.domain') : 'Endpoint',
                    value: row.varsJson['endpoint'] || '',
                });
                list.push({ label: 'Bucket', value: row.bucket });
            }
            if (row.type === 'UPYUN') {
                list.push({ label: i18n.global.t('setting.serviceName'), value: row.bucket });
            }
            if (row.type === 'COS' || row.type === 'OOS' || row.type === 'S3') {
                list.push({ label: i18n.global.t('setting.scType'), value: row.varsJson['scType'] });
            }
            if (row.type === 'KODO') {
                list.push({ label: i18n.global.t('cronjob.requestExpirationTime'), value: row.varsJson['timeout'] });
            }
            list.push({ label: i18n.global.t('setting.backupLabel'), value: row.backupPath });
            detailRef.value.acceptParams({ list: list });
        };
        const refreshItemToken = async (row: any) => {
            loading.value = true;
            await rpc.backup
                .refreshBackupToken({ id: row.id })
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    search();
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                click: (row: Backup.BackupInfo) => {
                    onOpenDialog('edit', row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                disabled: (row: Backup.BackupInfo) => {
                    return row.type === 'LOCAL';
                },
                click: (row: Backup.BackupInfo) => {
                    onDelete(row);
                },
            },
        ];
        onMounted(() => {
            search();
        });
        return () =>
            withDirectives(
                <div>
                    <LayoutContent
                        title={$t('setting.backupAccount')}
                        v-slots={{
                            leftToolBar: () => (
                                <>
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                onOpenDialog('create');
                                            }}
                                        >
                                            {$t('commons.button.add')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                </>
                            ),
                            rightToolBar: () => (
                                <>
                                    <TableSearch
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        searchName={paginationConfig.name}
                                        onUpdate:searchName={($v) => {
                                            paginationConfig.name = $v as any;
                                        }}
                                    />
                                    <TableRefresh
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    />
                                    <TableSetting
                                        title="backup-account-refresh"
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    />
                                </>
                            ),
                            main: () => (
                                <>
                                    <ElAlert
                                        type="info"
                                        closable={false}
                                        class={'common-div'}
                                        v-slots={{
                                            title: () => (
                                                <>
                                                    <span>
                                                        {$t('setting.backupAlert')}
                                                        <ElLink
                                                            type="primary"
                                                            target="_blank"
                                                            href={unref(docsUrl) + '/user_manual/settings/#4'}
                                                            class={'ml-1 text-xs'}
                                                        >
                                                            {$t('commons.button.helpDoc')}
                                                        </ElLink>
                                                    </span>
                                                </>
                                            ),
                                        }}
                                    />
                                    <ComplexTable
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        onSortChange={($event?: any) => {
                                            (search as any)($event);
                                        }}
                                        onSearch={($event?: any) => {
                                            (search as any)($event);
                                        }}
                                        data={unref(data)}
                                        scrollbar-always-on={unref(isMobile)}
                                    >
                                        <ElTableColumn
                                            label={$t('commons.table.name')}
                                            min-width={unref(isMobile) ? 140 : 80}
                                            prop="name"
                                            show-overflow-tooltip
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElText
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                onInspect(row);
                                                            }}
                                                            class={'cursor-pointer'}
                                                        >
                                                            {row.name === 'localhost' ? $t('terminal.local') : row.name}
                                                        </ElText>
                                                    </>
                                                ),
                                            }}
                                        />
                                        {unref(isProductPro) ? (
                                            <ElTableColumn
                                                label={$t('setting.scope')}
                                                min-width={80}
                                                prop="isPublic"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <ElButton plain size="small">
                                                                {row.isPublic
                                                                    ? $t('setting.public')
                                                                    : $t('setting.private')}
                                                            </ElButton>
                                                        </>
                                                    ),
                                                }}
                                            />
                                        ) : null}
                                        <ElTableColumn
                                            label={$t('commons.table.type')}
                                            min-width={100}
                                            prop="type"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElTag>{$t('setting.' + row.type)}</ElTag>
                                                        {hasTokenRefresh(row) ? (
                                                            <ElTooltip
                                                                {...TABLE_TOOLTIP_OPTIONS}
                                                                v-slots={{
                                                                    content: () => (
                                                                        <>
                                                                            {$t('setting.clickToRefresh')}
                                                                            <br />
                                                                            {row.varsJson['refresh_status'] ===
                                                                            'Success' ? (
                                                                                <span>
                                                                                    {$t('setting.refreshStatus') +
                                                                                        ':' +
                                                                                        $t('commons.status.success')}
                                                                                </span>
                                                                            ) : (
                                                                                <div>
                                                                                    <span>
                                                                                        {$t('setting.refreshStatus') +
                                                                                            ':' +
                                                                                            $t('commons.status.failed')}
                                                                                    </span>
                                                                                    <br />
                                                                                    <span>
                                                                                        {$t('commons.table.message') +
                                                                                            ':' +
                                                                                            row.varsJson['refresh_msg']}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                            <br />
                                                                            {$t('setting.refreshTime') +
                                                                                ':' +
                                                                                row.varsJson['refresh_time']}
                                                                        </>
                                                                    ),
                                                                }}
                                                            >
                                                                {withDirectives(
                                                                    <ElButton
                                                                        type="primary"
                                                                        link
                                                                        icon="Refresh"
                                                                        onClick={($event?: any) => {
                                                                            refreshItemToken(row);
                                                                        }}
                                                                        class={'ml-1'}
                                                                    />,
                                                                    [[permissionDirective, true]],
                                                                )}
                                                            </ElTooltip>
                                                        ) : null}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            prop="bucket"
                                            label="Bucket"
                                            show-overflow-tooltip
                                            v-slots={{ default: ({ row }) => <>{row.bucket || '-'}</> }}
                                        />
                                        <ElTableColumn
                                            prop="endpoint"
                                            label="Endpoint"
                                            show-overflow-tooltip
                                            v-slots={{ default: ({ row }) => <>{loadEndpoint(row)}</> }}
                                        />
                                        <ElTableColumn
                                            prop="backupPath"
                                            label={$t('setting.backupDir')}
                                            show-overflow-tooltip
                                        />
                                        <ElTableColumn
                                            prop="createdAt"
                                            label={$t('commons.table.date')}
                                            formatter={dateFormat}
                                            show-overflow-tooltip
                                        />
                                        <FuTableOperations
                                            width={unref(isMobile) ? 100 : 300}
                                            buttons={buttons}
                                            ellipsis={unref(isMobile) ? 0 : 10}
                                            label={$t('commons.table.operate')}
                                            fix
                                        />
                                    </ComplexTable>
                                </>
                            ),
                        }}
                    />
                    <Operate
                        ref={dialogRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <DetailShow ref={detailRef} />
                    <OpDialog
                        ref={opRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
