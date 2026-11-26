import { $t } from '@/utils/i18n-t';
import { readCachedPageSize } from '@/utils/panel-cache';
import { rpc } from '@/lib/rpc';
import { dateFormat } from '@/utils/date';
import { computeSize } from '@/utils/size';
import i18n from '@/lang';
import Delete from './delete/index';
import Reduce from './reduce/index';
import { MsgSuccess } from '@/utils/message';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import SvgIcon from '@/components/svg-icon/svg-icon';
import FuTableOperations from '@/components/table/TableOperations';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'recycle-bin',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const req = reactive({
            page: 1,
            pageSize: 20,
        });
        const data = ref([]);
        const selects = ref([]);
        const loading = ref(false);
        const files = ref([]);
        const status = ref('Enable');
        const paginationConfig = reactive({
            cacheSizeKey: 'recycle-page-size',
            currentPage: 1,
            pageSize: readCachedPageSize('recycle-page-size') || 20,
            total: 0,
        });
        const deleteRef = ref();
        const reduceRef = ref();
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
        };
        const getFileSize = (size: number | bigint) => {
            // proto 的 size 是 int64（bigint），computeSize 按 number 计算。
            return computeSize(Number(size));
        };
        const acceptParams = () => {
            search();
            getStatus();
        };
        const getStatus = async () => {
            try {
                const res = await rpc.file.getRecycleStatus({});
                status.value = res.status;
            } catch (error) {}
        };
        const changeStatus = async () => {
            try {
                loading.value = true;
                await rpc.agentSetting.updateSetting({ key: 'FileRecycleBin', value: status.value });
                MsgSuccess(
                    i18n.global.t('file.fileRecycleBinMsg', [
                        i18n.global.t('commons.button.' + status.value.toLowerCase()),
                    ]),
                );
                loading.value = false;
            } catch (error) {}
        };
        const search = async () => {
            try {
                req.page = paginationConfig.currentPage;
                req.pageSize = paginationConfig.pageSize;
                const res = await rpc.file.searchRecycle({ page: req.page, pageSize: req.pageSize });
                data.value = res.items;
                paginationConfig.total = Number(res.total);
                open.value = true;
            } catch (error) {}
        };
        const singleDel = (row: any) => {
            files.value = [];
            files.value.push(row);
            deleteRef.value.acceptParams(files.value);
        };
        const patchDelete = () => {
            files.value = selects.value;
            deleteRef.value.acceptParams(files.value);
        };
        const patchReduce = () => {
            files.value = selects.value;
            reduceRef.value.acceptParams(files.value);
        };
        const rdFile = async (row: any) => {
            ElMessageBox.confirm(i18n.global.t('file.reduceHelper'), i18n.global.t('file.reduce'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                try {
                    loading.value = true;
                    await rpc.file.restoreRecycle({ from: row.from, rName: row.rName, name: row.name });
                    loading.value = false;
                    search();
                } catch (error) {}
            });
        };
        const clear = async () => {
            ElMessageBox.confirm(i18n.global.t('commons.msg.delete'), i18n.global.t('file.clearRecycleBinHelper'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                try {
                    loading.value = true;
                    await rpc.file.clearRecycle({});
                    loading.value = false;
                    search();
                } catch (error) {}
            });
        };
        const buttons = [
            {
                label: i18n.global.t('file.reduce'),
                permission: true,
                nodeAdmin: true,
                click: rdFile,
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                nodeAdmin: true,
                click: singleDel,
            },
        ];
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('file.recycleBin')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                v-slots={{
                    content: () => (
                        <>
                            <div class={'flex space-x-4'}>
                                {withDirectives(
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (clear as any)($event);
                                        }}
                                        type="primary"
                                        disabled={unref(data) == null || unref(data).length == 0}
                                    >
                                        {$t('file.clearRecycleBin')}
                                    </ElButton>,
                                    [
                                        [permissionDirective, true],
                                        [nodeAdminDirective, true],
                                    ],
                                )}
                                {withDirectives(
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (patchDelete as any)($event);
                                        }}
                                        disabled={unref(data) == null || unref(selects).length == 0}
                                    >
                                        {$t('commons.button.delete')}
                                    </ElButton>,
                                    [
                                        [permissionDirective, true],
                                        [nodeAdminDirective, true],
                                    ],
                                )}
                                {withDirectives(
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (patchReduce as any)($event);
                                        }}
                                        disabled={unref(data) == null || unref(selects).length == 0}
                                    >
                                        {$t('file.reduce')}
                                    </ElButton>,
                                    [
                                        [permissionDirective, true],
                                        [nodeAdminDirective, true],
                                    ],
                                )}
                                <ElFormItem label={$t('file.fileRecycleBin')}>
                                    {withDirectives(
                                        <ElSwitch
                                            modelValue={unref(status)}
                                            onUpdate:modelValue={($v) => {
                                                status.value = $v as any;
                                            }}
                                            active-value="Enable"
                                            inactive-value="Disable"
                                            onChange={($event?: any) => {
                                                (changeStatus as any)($event);
                                            }}
                                        />,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                </ElFormItem>
                            </div>
                            <ComplexTable
                                pagination-config={paginationConfig}
                                selects={unref(selects)}
                                onUpdate:selects={($v) => {
                                    selects.value = $v as any;
                                }}
                                data={unref(data)}
                                onSearch={($event?: any) => {
                                    (search as any)($event);
                                }}
                                class={'mt-5'}
                            >
                                <ElTableColumn type="selection" fix />
                                <ElTableColumn
                                    prop="name"
                                    label={$t('commons.table.name')}
                                    show-overflow-tooltip
                                    v-slots={{
                                        default: ({ row }) => (
                                            <>
                                                <span type="primary" class={'text-ellipsis'}>
                                                    {row.isDir ? (
                                                        <SvgIcon className="table-icon" iconName="p-file-folder" />
                                                    ) : (
                                                        <SvgIcon className="table-icon" iconName="p-file-normal" />
                                                    )}
                                                    {row.name}
                                                </span>
                                            </>
                                        ),
                                    }}
                                />
                                <ElTableColumn label={$t('file.sourcePath')} show-overflow-tooltip prop="sourcePath" />
                                <ElTableColumn
                                    label={$t('file.size')}
                                    prop="size"
                                    max-width="50"
                                    v-slots={{ default: ({ row }) => <>{getFileSize(row.size)}</> }}
                                />
                                <ElTableColumn
                                    label={$t('file.deleteTime')}
                                    prop="deleteTime"
                                    formatter={dateFormat}
                                    show-overflow-tooltip
                                    sortable
                                />
                                <FuTableOperations buttons={buttons} label={$t('commons.table.operate')} fix />
                            </ComplexTable>
                            <Delete
                                ref={deleteRef}
                                onClose={($event?: any) => {
                                    (search as any)($event);
                                }}
                            />
                            <Reduce
                                ref={reduceRef}
                                onClose={($event?: any) => {
                                    (search as any)($event);
                                }}
                            />
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
