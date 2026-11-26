import { $t } from '@/utils/i18n-t';
import { readCachedPageSize } from '@/utils/panel-cache';
import TaskLog from '@/components/log/task/index';
import NodeSelect from '@/components/node-select/index';
import { dateFormat } from '@/utils/date';
import { Log } from '@/types/log';
import bus from '@/global/bus';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { translateTaskText } from '@/utils/task';
import { rpc } from '@/lib/rpc';
import DrawerPro from '@/components/drawer-pro/index';
import LayoutContent from '@/components/layout-content/index';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import ComplexTable from '@/components/table/complex/ComplexTable';
import Status from '@/components/status/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'task-list',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode } = useGlobalStore();
        const open = ref(false);
        const handleClose = () => {
            open.value = false;
        };
        const loading = ref();
        const data = ref();
        const paginationConfig = reactive({
            cacheSizeKey: 'task-list-page-size',
            currentPage: 1,
            pageSize: readCachedPageSize('task-list-page-size') || 20,
            total: 0,
            small: true,
        });
        const taskLogRef = ref();
        const req = reactive({
            type: '',
            status: 'Executing',
            page: 1,
            pageSize: 10,
        });
        const targeNode = ref('local');
        const search = async () => {
            bus.emit('refreshTask', true);
            req.page = paginationConfig.currentPage;
            req.pageSize = paginationConfig.pageSize;
            loading.value = true;
            try {
                const res = await rpc.task.search({
                    page: req.page,
                    pageSize: req.pageSize,
                    status: req.status,
                    type: req.type,
                });
                loading.value = false;
                data.value = res.items;
                paginationConfig.total = Number(res.total);
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const openTaskLog = (row: Log.Task) => {
            taskLogRef.value.openWithTaskID(row.id, row.status == 'Executing', targeNode.value);
        };
        const acceptParams = () => {
            targeNode.value = currentNode.value;
            search();
            open.value = true;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                size="large"
                header={$t('menu.msgCenter')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    content: () => (
                        <>
                            {
                                <LayoutContent
                                    title={$t('logs.task')}
                                    v-slots={{
                                        leftToolBar: () => (
                                            <>
                                                <NodeSelect
                                                    v-model={targeNode.value}
                                                    onChange={($event?: any) => {
                                                        search();
                                                    }}
                                                />
                                            </>
                                        ),
                                        rightToolBar: () => (
                                            <>
                                                <ElSelect
                                                    v-model={req.status}
                                                    onChange={($event?: any) => {
                                                        search();
                                                    }}
                                                    clearable
                                                    class={'p-w-200'}
                                                    v-slots={{ prefix: () => <>{$t('commons.table.status')}</> }}
                                                >
                                                    <ElOption label={$t('commons.table.all')} value="" />
                                                    <ElOption label={$t('commons.status.success')} value="Success" />
                                                    <ElOption label={$t('commons.status.failed')} value="Failed" />
                                                    <ElOption label={$t('logs.taskRunning')} value="Executing" />
                                                </ElSelect>
                                                <TableRefresh
                                                    onSearch={($event?: any) => {
                                                        search();
                                                    }}
                                                />
                                                <TableSetting
                                                    title="task-refresh"
                                                    onSearch={($event?: any) => {
                                                        search();
                                                    }}
                                                    rate={5}
                                                />
                                            </>
                                        ),
                                        main: () => (
                                            <>
                                                <ComplexTable
                                                    pagination-config={paginationConfig}
                                                    data={unref(data)}
                                                    onSearch={($event?: any) => {
                                                        (search as any)($event);
                                                    }}
                                                    heightDiff={320}
                                                >
                                                    <ElTableColumn
                                                        label={$t('logs.taskName')}
                                                        prop="name"
                                                        min-width="180px"
                                                        v-slots={{
                                                            default: ({ row }) => <>{translateTaskText(row.name)}</>,
                                                        }}
                                                    />
                                                    <ElTableColumn
                                                        label={$t('commons.table.status')}
                                                        prop="status"
                                                        max-width="80px"
                                                        v-slots={{
                                                            default: ({ row }) => (
                                                                <>
                                                                    <Status status={row.status} msg={row.errorMsg} />
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <ElTableColumn
                                                        label={$t('commons.button.log')}
                                                        prop="log"
                                                        max-width="80px"
                                                        v-slots={{
                                                            default: ({ row }) => (
                                                                <>
                                                                    <ElButton
                                                                        onClick={($event?: any) => {
                                                                            openTaskLog(row);
                                                                        }}
                                                                        link
                                                                        type="primary"
                                                                    >
                                                                        {$t('website.check')}
                                                                    </ElButton>
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <ElTableColumn
                                                        width="180px"
                                                        prop="createdAt"
                                                        label={$t('commons.table.date')}
                                                        formatter={dateFormat}
                                                        show-overflow-tooltip
                                                    />
                                                </ComplexTable>
                                            </>
                                        ),
                                    }}
                                    v-loading={unref(loading)}
                                />
                            }
                            <TaskLog ref={taskLogRef} width="70%" />
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
