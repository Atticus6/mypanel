import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import { computeSize } from '@/utils/size';
import { dateFormat } from '@/utils/date';
import { downloadFile } from '@/utils/file';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgError } from '@/utils/message';
interface DialogProps {
    cronjob: string;
    cronjobID: number;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'backup',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const selects = ref<any>([]);
        const loading = ref();
        const data = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 10,
            total: 0,
        });
        const backupVisible = ref(false);
        const cronjob = ref();
        const cronjobID = ref();
        const acceptParams = (params: DialogProps): void => {
            cronjob.value = params.cronjob;
            cronjobID.value = params.cronjobID;
            backupVisible.value = true;
            search();
        };
        const handleClose = () => {
            backupVisible.value = false;
        };
        const search = async () => {
            let params = {
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                cronjobId: cronjobID.value,
            };
            loading.value = true;
            await rpc.backup
                .searchBackupRecordsByCronjob(params)
                .then((res) => {
                    loading.value = false;
                    loadSize(params);
                    data.value = res.items || [];
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const loadSize = async (params: any) => {
            params.type = 'cronjob';
            await rpc.backup
                .loadRecordSize(params)
                .then((res) => {
                    let stats = res.items || [];
                    if (stats.length === 0) {
                        return;
                    }
                    for (const backup of data.value) {
                        for (const item of stats) {
                            if (backup.id === item.id) {
                                backup.hasLoad = true;
                                backup.size = Number(item.size);
                                break;
                            }
                        }
                    }
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const onDownload = async (row: any) => {
            if (row.accountType === 'ALIYUN' && row.size < 100 * 1024 * 1024) {
                MsgError(i18n.global.t('setting.ALIYUNHelper'));
                return;
            }
            let params = {
                downloadAccountId: row.downloadAccountId,
                fileDir: row.fileDir,
                fileName: row.fileName,
            };
            loading.value = true;
            await rpc.backup
                .downloadBackupRecord(params)
                .then(async (res) => {
                    loading.value = false;
                    downloadFile(res.path, 'local');
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const buttons = [
            {
                label: i18n.global.t('commons.button.download'),
                disabled: (row: any) => {
                    return row.size === 0;
                },
                click: (row: any) => {
                    onDownload(row);
                },
            },
        ];
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(backupVisible)}
                onUpdate:modelValue={($v) => {
                    backupVisible.value = $v as any;
                }}
                header={$t('commons.button.backup')}
                resource={unref(cronjob)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    content: () => (
                        <>
                            {withDirectives(
                                <ComplexTable
                                    pagination-config={paginationConfig}
                                    selects={unref(selects)}
                                    onUpdate:selects={($v) => {
                                        selects.value = $v as any;
                                    }}
                                    onSearch={($event?: any) => {
                                        (search as any)($event);
                                    }}
                                    data={unref(data)}
                                >
                                    <ElTableColumn
                                        label={$t('commons.table.name')}
                                        prop="fileName"
                                        show-overflow-tooltip
                                    />
                                    <ElTableColumn
                                        label={$t('file.size')}
                                        prop="size"
                                        show-overflow-tooltip
                                        v-slots={{
                                            default: ({ row }) => (
                                                <>
                                                    {row.hasLoad ? (
                                                        <div>
                                                            {row.size ? (
                                                                <span>{computeSize(row.size)}</span>
                                                            ) : (
                                                                <span>{'-'}</span>
                                                            )}
                                                        </div>
                                                    ) : null}
                                                    {!row.hasLoad ? (
                                                        <div>
                                                            <ElButton link loading />
                                                        </div>
                                                    ) : null}
                                                </>
                                            ),
                                        }}
                                    />
                                    <ElTableColumn
                                        label={$t('app.source')}
                                        prop="accountType"
                                        show-overflow-tooltip
                                        v-slots={{
                                            default: ({ row }) => (
                                                <>
                                                    {row.accountType === 'LOCAL' ? (
                                                        <span>{$t('setting.LOCAL')}</span>
                                                    ) : null}
                                                    {row.accountType && row.accountType !== 'LOCAL' ? (
                                                        <span>
                                                            {$t('setting.' + row.accountType) + ' - ' + row.accountName}
                                                        </span>
                                                    ) : null}
                                                    {!row.accountType ? <span>{'-'}</span> : null}
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
                                    <FuTableOperations
                                        width="130px"
                                        buttons={buttons}
                                        label={$t('commons.table.operate')}
                                        fix
                                    />
                                </ComplexTable>,
                                [[vLoading, unref(loading)]],
                            )}
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
