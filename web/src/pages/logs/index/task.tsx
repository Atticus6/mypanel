import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import LogRouter from '@/pages/logs/_components/router/index';
import { dateFormat } from '@/utils/date';
import { rpc } from '@/lib/rpc';
import { Log } from '@/types/log';
import TaskLog from '@/components/log/task/index';
import bus from '@/global/bus';
import { translateTaskText } from '@/utils/task';
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
    name: 'task',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const data = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        useSearchState(
            'log/task/index',
            {
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const taskLogRef = ref();
        const req = reactive({
            type: '',
            status: '',
            page: 1,
            pageSize: 10,
        });
        const search = async () => {
            req.page = paginationConfig.currentPage;
            req.pageSize = paginationConfig.pageSize;
            loading.value = true;
            try {
                const res = await rpc.task.search(req);
                loading.value = false;
                data.value = res.items;
                paginationConfig.total = Number(res.total);
            } catch (error) {
            } finally {
                bus.emit('refreshTask', true);
                loading.value = false;
            }
        };
        const openTaskLog = (row: Log.Task) => {
            taskLogRef.value.openWithTaskID(row.id, row.status == 'Executing');
        };
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                {
                    <LayoutContent
                        title={$t('logs.task')}
                        v-slots={{
                            search: () => (
                                <>
                                    <LogRouter current="Task" />
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
                                        title="task-log-refresh"
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
                                        <ElTableColumn
                                            label={$t('logs.taskName')}
                                            prop="name"
                                            min-width="180px"
                                            v-slots={{ default: ({ row }) => <>{translateTaskText(row.name)}</> }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.status')}
                                            prop="status"
                                            max-width="100px"
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
                                            max-width="100px"
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
            </div>
        );
    },
    options,
);

definePage({
    name: 'Task',
    meta: { parent: 'menu.logs', title: 'logs.task', activeMenu: '/logs', permission: 'log_view', hidden: true },
});
