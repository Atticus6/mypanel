import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { useSearchState } from '@/utils/search-reset';
import PruneDialog from '@/pages/views/container/container/prune/index';
import RenameDialog from '@/pages/views/container/container/rename/index';
import UpgradeDialog from '@/pages/views/container/container/upgrade/index';
import CommitDialog from '@/pages/views/container/container/commit/index';
import MonitorDialog from '@/pages/views/container/container/monitor/index';
import TerminalDialog from '@/pages/views/container/container/terminal/index';
import ContainerFileDrawer from '@/pages/views/container/container/file-browser/index';
import ContainerInspectDialog from '@/pages/views/container/container/inspect/index';
import PortJumpDialog from '@/components/port-jump/index';
import TaskLog from '@/components/log/task/index';
import Backups from '@/components/backup/index';
import Uploads from '@/components/upload/index';
import DockerStatus from '@/pages/views/container/docker-status/index';
import ContainerLogDialog from '@/components/log/container-drawer/index';
import Status from '@/components/status/index';
import { Container } from '@/types/container';
import { rpc } from '@/lib/rpc';
import { toContainerView } from '@/lib/rpc/container';
import i18n from '@/lang';
import { MsgSuccess, MsgWarning } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { routerToName, routerToNameWithQuery } from '@/utils/router';
import router from '@/routers';
import { computeSize2 } from '@/utils/size';
import ContainerResource from '@/components/container-resource/index';
import { newUUID } from '@/utils/id';
interface Filters {
    filters?: string;
}
import '@/pages/views/container/container/index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import { cn } from '@/utils/cn';
import LayoutContent from '@/components/layout-content/index';
import TableViewSwitch from '@/components/table/TableViewSwitch';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import FuTableColumnSelect from '@/components/table/TableColumnSelect';
import ComplexTable from '@/components/table/complex/ComplexTable';
import SvgIcon from '@/components/svg-icon/svg-icon';
import { InfoFilled } from '@element-plus/icons-vue';
import FuInputRwSwitch from '@/components/fu/FuInputRwSwitch';
import FuTableOperations from '@/components/table/TableOperations';
import DialogPro from '@/components/dialog-pro/index';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
    filters?: string;
}

const emits = {};

const options = {
    name: 'container',
    props: {
        filters: String,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-218212d0',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode, isAdminOrNodeAdmin, isMobile } = useGlobalStore();
        const isActive = ref(false);
        const isExist = ref(false);
        const loading = ref(false);
        const viewMode = ref<'table' | 'card'>('table');
        const data = ref<any[]>([]);
        const networkItemsByRow = computed(
            () => new Map(data.value.map((row) => [row, (row.network || []).filter((item: string) => item?.trim())])),
        );
        const portsDialogVisible = ref(false);
        const selectedPorts = ref<string[]>([]);
        const portsDialogContainer = ref('');
        const portFilter = ref('');
        const showIPv6Ports = ref(true);
        const selects = ref<any>([]);
        const defaultSort = { prop: 'name', order: 'ascending' };
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
            state: 'all',
            orderBy: defaultSort.prop,
            order: defaultSort.order,
        });
        const searchName = ref();
        const dialogUpgradeRef = ref();
        const dialogCommitRef = ref();
        const dialogPortJumpRef = ref();
        const dialogBackupRef = ref();
        const opRef = ref();
        const includeAppStore = ref(localStorage.getItem('includeAppStore') !== 'false');
        const columns = ref([]);
        const batchNames = ref();
        const batchOp = ref();
        const batchOperation = ref('');
        const taskLogRef = ref();
        const tags = ref([]);
        const activeTag = ref('all');
        useSearchState(
            'container/container/index',
            {
                search: searchName,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
                state: toRef(paginationConfig, 'state'),
                activeTag,
                orderBy: toRef(paginationConfig, 'orderBy'),
                order: toRef(paginationConfig, 'order'),
            },
            { onRevisit: () => search() },
        );
        const activeDropdownContainerId = ref('');
        const statFields = [
            'cpuTotalUsage',
            'systemUsage',
            'cpuPercent',
            'percpuUsage',
            'memoryCache',
            'memoryUsage',
            'memoryLimit',
            'memoryPercent',
        ] as const;
        const assignFields = (target: Record<string, any>, source: Record<string, any>, skipKeys: string[] = []) => {
            const skipSet = new Set(skipKeys);
            for (const [key, value] of Object.entries(source)) {
                if (skipSet.has(key)) {
                    continue;
                }
                if (target[key] !== value) {
                    target[key] = value;
                }
            }
        };
        const syncContainerRows = (containers: Record<string, any>[]) => {
            const currentMap = new Map(data.value.map((item) => [item.containerID, item]));
            data.value = containers.map((container) => {
                const current = currentMap.get(container.containerID);
                if (!current) {
                    return container;
                }
                assignFields(current, container);
                return current;
            });
        };
        const applyStatsToRows = (stats: Record<string, any>[]) => {
            if (stats.length === 0 || data.value.length === 0) {
                return;
            }
            const statsMap = new Map(stats.map((item) => [item.containerID, item]));
            for (const container of data.value) {
                const stat = statsMap.get(container.containerID);
                if (!stat) {
                    continue;
                }
                if (!container.hasLoad) {
                    container.hasLoad = true;
                }
                for (const field of statFields) {
                    if (container[field] !== stat[field]) {
                        container[field] = stat[field];
                    }
                }
            }
        };
        const updateTags = (status: Record<string, any>) => {
            const nextTags = [];
            if (status.containerCount) {
                nextTags.push({ key: 'all', count: status.containerCount });
            }
            if (status.running) {
                nextTags.push({ key: 'running', count: status.running });
            }
            if (status.paused) {
                nextTags.push({ key: 'paused', count: status.paused });
            }
            if (status.restarting) {
                nextTags.push({ key: 'restarting', count: status.restarting });
            }
            if (status.removing) {
                nextTags.push({ key: 'removing', count: status.removing });
            }
            if (status.created) {
                nextTags.push({ key: 'created', count: status.created });
            }
            if (status.dead) {
                nextTags.push({ key: 'dead', count: status.dead });
            }
            if (status.exited) {
                nextTags.push({ key: 'exited', count: status.exited });
            }
            tags.value = nextTags;
        };
        const handleStatusDropdownVisibleChange = (containerID: string, visible: boolean) => {
            if (visible) {
                activeDropdownContainerId.value = containerID;
                return;
            }
            if (activeDropdownContainerId.value === containerID) {
                activeDropdownContainerId.value = '';
            }
        };
        const goDashboard = async (port: any) => {
            if (port.indexOf('127.0.0.1') !== -1) {
                MsgWarning(i18n.global.t('container.unExposedPort'));
                return;
            }
            if (port.indexOf(':') === -1) {
                MsgWarning(i18n.global.t('commons.msg.errPort'));
                return;
            }
            let portEx = port.match(/:(\d+)/)[1];

            let matches = port.match(new RegExp(':', 'g'));
            let ip = matches && matches.length > 1 ? 'ipv6' : 'ipv4';
            dialogPortJumpRef.value.acceptParams({ port: portEx, ip: ip });
        };
        const openPorts = (row: Container.ContainerInfo) => {
            selectedPorts.value = row.ports || [];
            portsDialogContainer.value = row.name;
            portFilter.value = '';
            showIPv6Ports.value = true;
            portsDialogVisible.value = true;
        };
        const isIPv6Port = (port: string) => {
            const address = port.split('->')[0] || port;
            return address.includes('[') || (address.match(/:/g)?.length || 0) > 1;
        };
        const getNetworkItems = (row: Container.ContainerInfo) => networkItemsByRow.value.get(row) || [];
        const filteredPorts = computed(() => {
            const keyword = portFilter.value.trim().toLowerCase();
            return selectedPorts.value.filter((port) => {
                if (!showIPv6Ports.value && isIPv6Port(port)) {
                    return false;
                }
                return !keyword || port.toLowerCase().includes(keyword);
            });
        });
        const containerInspectRef = ref();
        const dialogContainerLogRef = ref();
        const dialogRenameRef = ref();
        const dialogPruneRef = ref();
        let requestController: AbortController | undefined;
        const cancelRequests = () => {
            requestController?.abort();
            requestController = undefined;
            loading.value = false;
        };
        onBeforeUnmount(cancelRequests);
        onDeactivated(cancelRequests);
        const loadContainers = async (background = false, column?: any) => {
            if (!isActive.value || !isExist.value || (background && requestController)) {
                return;
            }
            requestController?.abort();
            const controller = new AbortController();
            requestController = controller;
            loading.value = !background;
            localStorage.setItem('includeAppStore', includeAppStore.value ? 'true' : 'false');
            if (column) {
                paginationConfig.orderBy = column.order ? column.prop : defaultSort.prop;
                paginationConfig.order = column.order || defaultSort.order;
            }
            const params = {
                name: searchName.value,
                state: paginationConfig.state || 'all',
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                filters: __panelSetupProps.filters || (router.currentRoute.value.query?.filters as string) || '',
                orderBy: paginationConfig.orderBy,
                order: paginationConfig.order,
                excludeAppStore: !includeAppStore.value,
            };
            const statusRequest = rpc.container
                .status({ containersOnly: true })
                .then((res) => {
                    if (!controller.signal.aborted) {
                        updateTags(res || {});
                    }
                })
                .catch(() => {});
            try {
                const res = await rpc.container.search(params);
                if (controller.signal.aborted) {
                    return;
                }
                const containers = (res.items || []).map((item) => toContainerView(item));
                syncContainerRows(containers);
                paginationConfig.total = Number(res.total);
                loading.value = false;
                // Stopped containers no longer produce samples; discard their previous usage.
                for (const row of data.value) {
                    if (row.state !== 'running') {
                        for (const field of statFields) {
                            row[field] = 0;
                        }
                    }
                }
                const ids = containers.filter((item) => item.state === 'running').map((item) => item.containerID);
                if (ids.length > 0) {
                    const stats = await rpc.container.getContainerStats({ ids });
                    if (!controller.signal.aborted) {
                        applyStatsToRows((stats.items || []) as any);
                    }
                }
            } catch {
                // Preserve the last successful rows; the HTTP layer reports the failure.
            } finally {
                if (!controller.signal.aborted) {
                    loading.value = false;
                }
                await statusRequest;
                if (requestController === controller) {
                    requestController = undefined;
                }
            }
        };
        const search = (column?: any) => loadContainers(false, column);
        const searchWithStatus = (item: string) => {
            activeTag.value = item;
            paginationConfig.state = activeTag.value;
            search();
        };
        const searchWithAppShow = (item: any) => {
            includeAppStore.value = item;
            search();
        };
        const changePinned = (row: any, isPinned: boolean) => {
            let params = {
                id: row.containerID,
                type: 'container',
                detailType: '',
                isPinned: row.isPinned,
                description: row.description || '',
            };
            if (isPinned) {
                params.isPinned = !row.isPinned;
            }
            rpc.agentSetting.saveDescription(params).then(() => {
                search();
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            });
        };
        const refresh = () => loadContainers(true);
        const loadSize = async (row: any) => {
            rpc.container.getContainerItemStats({ name: row.containerID }).then((res) => {
                row.sizeRw = Number(res.sizeRw) || 0;
                row.sizeRootFs = Number(res.sizeRootFs) || 0;
                row.hasLoadSize = true;
            });
        };
        const onContainerOperate = async (container: string) => {
            routerToNameWithQuery('ContainerCreate', { name: container });
        };
        const onBackup = (row: Container.ContainerInfo) => {
            dialogBackupRef.value!.acceptParams({
                type: 'container',
                name: row.name,
                detailName: '',
            });
        };
        const uploadRef = ref();
        const onImportCreate = () => {
            uploadRef.value!.acceptParams({
                type: 'container',
                name: '',
                detailName: '',
                remark: '.tar.gz',
                node: currentNode.value,
            });
        };
        const dialogMonitorRef = ref();
        const onMonitor = (row: any) => {
            dialogMonitorRef.value!.acceptParams({ containerID: row.containerID, container: row.name });
        };
        const dialogTerminalRef = ref();
        const onTerminal = (row: any) => {
            const title = i18n.global.t('menu.container') + ' ' + row.name;
            dialogTerminalRef.value!.acceptParams({ containerID: row.containerID, title: title });
        };
        const dialogFileBrowserRef = ref();
        const onOpenFileBrowser = async (row: any) => {
            const title = i18n.global.t('menu.container') + ' ' + row.name;
            let workingDir = '/';
            try {
                const res = await rpc.container.inspect({ id: row.containerID, type: 'container' });
                const data = JSON.parse(res.content);
                if (data?.Config?.WorkingDir) {
                    workingDir = data.Config.WorkingDir;
                }
            } catch (e) {
                /* fallback to root */
            }
            dialogFileBrowserRef.value!.acceptParams({
                containerID: row.containerID,
                title: title,
                workingDir: workingDir,
            });
        };
        const onInspect = async (row: any) => {
            const res = await rpc.container.inspect({ id: row.containerID, type: 'container' });
            containerInspectRef.value!.acceptParams({ data: res.content, ports: row.ports });
        };
        const onClean = () => {
            dialogPruneRef.value!.acceptParams();
        };
        const checkStatus = (operation: string, row: Container.ContainerInfo | null) => {
            let opList = row ? [row] : selects.value;
            if (opList.length < 1) {
                return true;
            }
            switch (operation) {
                case 'start':
                    for (const item of opList) {
                        if (item.state === 'running') {
                            return true;
                        }
                    }
                    return false;
                case 'stop':
                    for (const item of opList) {
                        if (item.state === 'stopped' || item.state === 'exited') {
                            return true;
                        }
                    }
                    return false;
                case 'pause':
                    for (const item of opList) {
                        if (item.state === 'paused' || item.state === 'exited') {
                            return true;
                        }
                    }
                    return false;
                case 'unpause':
                    for (const item of opList) {
                        if (item.state !== 'paused') {
                            return true;
                        }
                    }
                    return false;
            }
        };
        const onOperate = async (op: string, row: Container.ContainerInfo | null) => {
            if (op === 'upgrade') {
                dialogUpgradeRef.value.acceptParams(selects.value);
                return;
            }
            let opList = row ? [row] : selects.value;
            let msg = i18n.global.t('container.operatorHelper', [i18n.global.t('container.' + op)]);
            batchNames.value = [];
            batchOp.value = op;
            for (const item of opList) {
                batchNames.value.push(item.name);
                if (item.isFromApp) {
                    msg =
                        op == 'remove'
                            ? i18n.global.t('container.containerDeleteHelper', [i18n.global.t('container.' + op)])
                            : i18n.global.t('container.operatorAppHelper', [i18n.global.t('container.' + op)]);
                }
            }
            const successMsg = `${i18n.global.t('container.' + op)}${i18n.global.t('commons.status.success')}`;
            opRef.value.acceptParams({
                title: i18n.global.t('container.' + op),
                names: batchNames.value,
                msg: msg,
                api: null,
                params: null,
                successMsg,
            });
        };
        const onSubmitOperate = async () => {
            loading.value = true;
            let taskID = newUUID();
            await rpc.container
                .operateContainers({ names: batchNames.value, operation: batchOp.value as any, taskId: taskID })
                .then(() => {
                    loading.value = false;
                    search();
                    openTaskLog(taskID);
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const buttons = [
            {
                label: i18n.global.t('menu.terminal'),
                disabled: (row: Container.ContainerInfo) => {
                    return row.state !== 'running' || !isAdminOrNodeAdmin.value;
                },
                click: (row: Container.ContainerInfo) => {
                    onTerminal(row);
                },
            },
            {
                label: i18n.global.t('commons.button.log'),
                click: (row: Container.ContainerInfo) => {
                    dialogContainerLogRef.value!.acceptParams({ containerID: row.containerID, container: row.name });
                },
            },
            {
                label: i18n.global.t('home.dir'),
                permission: true,
                disabled: (row: Container.ContainerInfo) => {
                    return row.state !== 'running';
                },
                click: (row: Container.ContainerInfo) => {
                    onOpenFileBrowser(row);
                },
            },
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                click: (row: Container.ContainerInfo) => {
                    onContainerOperate(row.name);
                },
            },
            {
                label: i18n.global.t('commons.button.upgrade'),
                permission: true,
                dot: (row: Container.ContainerInfo) => Boolean(row.hasUpdate),
                click: (row: Container.ContainerInfo) => {
                    dialogUpgradeRef.value!.acceptParams({
                        container: row.name,
                        image: row.imageName,
                        fromApp: row.isFromApp,
                        latestVersion: row.latestVersion,
                        hasUpdate: row.hasUpdate,
                    });
                },
            },
            {
                label: i18n.global.t('commons.button.backup'),
                permission: true,
                click: (row: Container.ContainerInfo) => {
                    onBackup(row);
                },
            },
            {
                label: i18n.global.t('menu.monitor'),
                disabled: (row: Container.ContainerInfo) => {
                    return row.state !== 'running';
                },
                click: (row: Container.ContainerInfo) => {
                    onMonitor(row);
                },
            },
            {
                label: i18n.global.t('container.rename'),
                permission: true,
                click: (row: Container.ContainerInfo) => {
                    dialogRenameRef.value!.acceptParams({ container: row.name });
                },
                disabled: (row: any) => {
                    return row.isFromCompose;
                },
            },
            {
                label: i18n.global.t('container.makeImage'),
                permission: true,
                click: (row: Container.ContainerInfo) => {
                    dialogCommitRef.value!.acceptParams({ containerID: row.containerID, containerName: row.name });
                },
                disabled: (row: any) => {
                    return checkStatus('commit', row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: (row: Container.ContainerInfo) => {
                    onOperate('remove', row);
                },
                disabled: (row: any) => {
                    return checkStatus('remove', row);
                },
            },
        ];
        return () =>
            withDirectives(
                <div>
                    <DockerStatus
                        isActive={unref(isActive)}
                        onUpdate:isActive={($v) => {
                            isActive.value = $v as any;
                        }}
                        isExist={unref(isExist)}
                        onUpdate:isExist={($v) => {
                            isExist.value = $v as any;
                        }}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    {unref(isExist) ? (
                        <LayoutContent
                            title={$t('menu.container', 2)}
                            class={{ mask: !unref(isActive) }}
                            v-slots={{
                                search: () => (
                                    <>
                                        {unref(isExist) && unref(isActive) ? (
                                            <div class={'card-interval'}>
                                                {(unref(tags) || []).map((item) => (
                                                    <div class={'inline'} key={item.key}>
                                                        {item.count ? (
                                                            <ElButton
                                                                onClick={($event?: any) => {
                                                                    searchWithStatus(item.key);
                                                                }}
                                                                type={unref(activeTag) === item.key ? 'primary' : ''}
                                                                plain={unref(activeTag) !== item.key}
                                                                class={cn(
                                                                    'tag-button',
                                                                    unref(activeTag) === item.key ? '' : 'no-active',
                                                                )}
                                                            >
                                                                {item.key === 'all'
                                                                    ? $t('commons.table.all')
                                                                    : $t('commons.status.' + item.key)}
                                                                {' * '}
                                                                {item.count}
                                                            </ElButton>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </>
                                ),
                                leftToolBar: () => (
                                    <>
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    onContainerOperate('');
                                                }}
                                            >
                                                {$t('commons.button.create')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                plain
                                                onClick={($event?: any) => {
                                                    onImportCreate();
                                                }}
                                            >
                                                {$t('commons.button.import')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                        {withDirectives(
                                            <ElButton
                                                type="primary"
                                                plain
                                                onClick={($event?: any) => {
                                                    onClean();
                                                }}
                                            >
                                                {$t('container.containerPrune')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                    </>
                                ),
                                rightToolBar: () => (
                                    <>
                                        <TableViewSwitch
                                            modelValue={unref(viewMode)}
                                            onUpdate:modelValue={($v) => {
                                                viewMode.value = $v as any;
                                            }}
                                            storage-key="container"
                                        />
                                        <TableSearch
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                            searchName={unref(searchName)}
                                            onUpdate:searchName={($v) => {
                                                searchName.value = $v as any;
                                            }}
                                        />
                                        <ElTooltip
                                            content={
                                                unref(includeAppStore)
                                                    ? $t('container.includeAppstore')
                                                    : $t('container.excludeAppstore')
                                            }
                                        >
                                            <ElButton
                                                type={unref(includeAppStore) ? '' : 'primary'}
                                                onClick={($event?: any) => {
                                                    searchWithAppShow(!unref(includeAppStore));
                                                }}
                                                icon={unref(includeAppStore) ? 'View' : 'Hide'}
                                            />
                                        </ElTooltip>
                                        <TableRefresh
                                            onSearch={($event?: any) => {
                                                search();
                                            }}
                                        />
                                        <TableSetting
                                            title="container-refresh"
                                            onSearch={($event?: any) => {
                                                refresh();
                                            }}
                                        />
                                        <FuTableColumnSelect
                                            columns={unref(columns)}
                                            trigger="hover"
                                            title={$t('commons.table.selectColumn')}
                                            popper-class="popper-class"
                                            only-icon={true}
                                        />
                                    </>
                                ),
                                main: () => (
                                    <>
                                        <ComplexTable
                                            selection-context={() => [
                                                unref(searchName),
                                                unref(activeTag),
                                                unref(includeAppStore),
                                                __panelSetupProps.filters,
                                            ]}
                                            cache-pagination={false}
                                            pagination-config={paginationConfig}
                                            view-mode={unref(viewMode)}
                                            onUpdate:view-mode={($v) => {
                                                viewMode.value = $v as any;
                                            }}
                                            selects={unref(selects)}
                                            onUpdate:selects={($v) => {
                                                selects.value = $v as any;
                                            }}
                                            data={unref(data)}
                                            row-key="containerID"
                                            onSortChange={($event?: any) => {
                                                (search as any)($event);
                                            }}
                                            onSearch={($event?: any) => {
                                                (search as any)($event);
                                            }}
                                            row-style={{ height: '65px' }}
                                            columns={unref(columns)}
                                            localKey="containerColumn"
                                            heightDiff={300}
                                            style={'width: 100%'}
                                            v-slots={{
                                                footerLeft: ({ selected, toggleSelection }) => (
                                                    <>
                                                        {withDirectives(
                                                            <div class={'footer-left-button'}>
                                                                <ElSelect
                                                                    modelValue={unref(batchOperation)}
                                                                    onUpdate:modelValue={($v) => {
                                                                        batchOperation.value = $v as any;
                                                                    }}
                                                                    class={'p-w-200'}
                                                                    v-slots={{
                                                                        prefix: () => (
                                                                            <>
                                                                                <ElCheckbox
                                                                                    model-value={selected}
                                                                                    onClick={($event?: any) => {
                                                                                        $event.stopPropagation();
                                                                                    }}
                                                                                    onChange={($event?: any) => {
                                                                                        (toggleSelection as any)(
                                                                                            $event,
                                                                                        );
                                                                                    }}
                                                                                />
                                                                            </>
                                                                        ),
                                                                    }}
                                                                >
                                                                    <ElOption
                                                                        label={$t('commons.button.upgrade')}
                                                                        value="upgrade"
                                                                    />
                                                                    <ElOption
                                                                        label={$t('container.start')}
                                                                        value="start"
                                                                        disabled={checkStatus('start', null)}
                                                                    />
                                                                    <ElOption
                                                                        label={$t('container.stop')}
                                                                        value="stop"
                                                                        disabled={checkStatus('stop', null)}
                                                                    />
                                                                    <ElOption
                                                                        label={$t('container.restart')}
                                                                        value="restart"
                                                                        disabled={checkStatus('restart', null)}
                                                                    />
                                                                    <ElOption
                                                                        label={$t('container.kill')}
                                                                        value="kill"
                                                                        disabled={checkStatus('kill', null)}
                                                                    />
                                                                    <ElOption
                                                                        label={$t('container.pause')}
                                                                        value="pause"
                                                                        disabled={checkStatus('pause', null)}
                                                                    />
                                                                    <ElOption
                                                                        label={$t('container.unpause')}
                                                                        value="unpause"
                                                                        disabled={checkStatus('unpause', null)}
                                                                    />
                                                                    <ElOption
                                                                        label={$t('container.remove')}
                                                                        value="remove"
                                                                        disabled={checkStatus('remove', null)}
                                                                    />
                                                                </ElSelect>
                                                                <ElButton
                                                                    type="primary"
                                                                    disabled={
                                                                        unref(selects).length === 0 ||
                                                                        unref(batchOperation) === '' ||
                                                                        checkStatus(unref(batchOperation), null)
                                                                    }
                                                                    onClick={($event?: any) => {
                                                                        onOperate(unref(batchOperation), null);
                                                                    }}
                                                                >
                                                                    {$t('website.batchOperate')}
                                                                    {unref(selects).length > 0 ? (
                                                                        <span class={'ml-1'}>
                                                                            {'('}
                                                                            {unref(selects).length}
                                                                            {')'}
                                                                        </span>
                                                                    ) : null}
                                                                </ElButton>
                                                            </div>,
                                                            [[permissionDirective, true]],
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        >
                                            <ElTableColumn type="selection" width="32" />
                                            <ElTableColumn
                                                label={$t('commons.table.name')}
                                                min-width="250"
                                                prop="name"
                                                sortable="custom"
                                                card-type="name"
                                                fix
                                                fixed={unref(isMobile) ? false : 'left'}
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
                                                                {row.name}
                                                            </ElText>
                                                            <div class={'float-right'}>
                                                                <ElTooltip
                                                                    content={
                                                                        row.isPinned
                                                                            ? $t('commons.table.unpin')
                                                                            : $t('commons.table.pin')
                                                                    }
                                                                >
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            link
                                                                            size="large"
                                                                            type={row.isPinned ? 'warning' : 'info'}
                                                                            onClick={($event?: any) => {
                                                                                changePinned(row, true);
                                                                            }}
                                                                            class={cn('container-pin-button', {
                                                                                'is-pinned': row.isPinned,
                                                                            })}
                                                                        >
                                                                            <SvgIcon
                                                                                iconName="p-pushpin"
                                                                                className="container-pin-icon"
                                                                            />
                                                                        </ElButton>,
                                                                        [[permissionDirective, true]],
                                                                    )}
                                                                </ElTooltip>
                                                            </div>
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('container.image')}
                                                card-type="description"
                                                show-overflow-tooltip
                                                min-width="180"
                                                prop="imageName"
                                            />
                                            <ElTableColumn
                                                card-type="status"
                                                label={$t('commons.table.status')}
                                                min-width="150"
                                                prop="state"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <ElDropdown
                                                                placement="bottom"
                                                                onVisibleChange={($event?: any) => {
                                                                    (visible) =>
                                                                        handleStatusDropdownVisibleChange(
                                                                            row.containerID,
                                                                            visible,
                                                                        );
                                                                }}
                                                                v-slots={{
                                                                    dropdown: () => (
                                                                        <>
                                                                            {unref(activeDropdownContainerId) ===
                                                                            row.containerID ? (
                                                                                <ElDropdownMenu>
                                                                                    <ElDropdownItem
                                                                                        disabled={checkStatus(
                                                                                            'start',
                                                                                            row,
                                                                                        )}
                                                                                        onClick={($event?: any) => {
                                                                                            onOperate('start', row);
                                                                                        }}
                                                                                    >
                                                                                        {$t('commons.operate.start')}
                                                                                    </ElDropdownItem>
                                                                                    <ElDropdownItem
                                                                                        disabled={checkStatus(
                                                                                            'stop',
                                                                                            row,
                                                                                        )}
                                                                                        onClick={($event?: any) => {
                                                                                            onOperate('stop', row);
                                                                                        }}
                                                                                    >
                                                                                        {$t('commons.operate.stop')}
                                                                                    </ElDropdownItem>
                                                                                    <ElDropdownItem
                                                                                        disabled={checkStatus(
                                                                                            'restart',
                                                                                            row,
                                                                                        )}
                                                                                        onClick={($event?: any) => {
                                                                                            onOperate('restart', row);
                                                                                        }}
                                                                                    >
                                                                                        {$t('commons.button.restart')}
                                                                                    </ElDropdownItem>
                                                                                    <ElDropdownItem
                                                                                        disabled={checkStatus(
                                                                                            'kill',
                                                                                            row,
                                                                                        )}
                                                                                        onClick={($event?: any) => {
                                                                                            onOperate('kill', row);
                                                                                        }}
                                                                                    >
                                                                                        {$t('container.kill')}
                                                                                    </ElDropdownItem>
                                                                                    <ElDropdownItem
                                                                                        disabled={checkStatus(
                                                                                            'pause',
                                                                                            row,
                                                                                        )}
                                                                                        onClick={($event?: any) => {
                                                                                            onOperate('pause', row);
                                                                                        }}
                                                                                    >
                                                                                        {$t('container.pause')}
                                                                                    </ElDropdownItem>
                                                                                    <ElDropdownItem
                                                                                        disabled={checkStatus(
                                                                                            'unpause',
                                                                                            row,
                                                                                        )}
                                                                                        onClick={($event?: any) => {
                                                                                            onOperate('unpause', row);
                                                                                        }}
                                                                                    >
                                                                                        {$t('container.unpause')}
                                                                                    </ElDropdownItem>
                                                                                </ElDropdownMenu>
                                                                            ) : null}
                                                                        </>
                                                                    ),
                                                                }}
                                                            >
                                                                {withDirectives(
                                                                    <Status status={row.state} operate={true} />,
                                                                    [[permissionDirective, true]],
                                                                )}
                                                            </ElDropdown>
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('container.source')}
                                                card-type="content"
                                                show-overflow-tooltip
                                                prop="resource"
                                                min-width="120"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {row.state !== 'running' ? (
                                                                <span>{'—'}</span>
                                                            ) : row.hasLoad ? (
                                                                <ContainerResource
                                                                    stats={row}
                                                                    v-slots={{
                                                                        footer: () => (
                                                                            <>
                                                                                {!row.hasLoadSize ? (
                                                                                    <ElButton
                                                                                        size="small"
                                                                                        link
                                                                                        type="primary"
                                                                                        onClick={($event?: any) => {
                                                                                            loadSize(row);
                                                                                        }}
                                                                                        class={'mt-2'}
                                                                                    >
                                                                                        {$t('container.loadSize')}
                                                                                    </ElButton>
                                                                                ) : null}
                                                                            </>
                                                                        ),
                                                                    }}
                                                                >
                                                                    {row.hasLoadSize ? (
                                                                        <ElDescriptionsItem
                                                                            v-slots={{
                                                                                label: () => (
                                                                                    <>
                                                                                        {$t('container.sizeRw')}
                                                                                        <ElTooltip
                                                                                            content={$t(
                                                                                                'container.sizeRwHelper',
                                                                                            )}
                                                                                        >
                                                                                            <ElIcon class={'icon-item'}>
                                                                                                <InfoFilled />
                                                                                            </ElIcon>
                                                                                        </ElTooltip>
                                                                                    </>
                                                                                ),
                                                                            }}
                                                                        >
                                                                            {computeSize2(row.sizeRw)}
                                                                        </ElDescriptionsItem>
                                                                    ) : null}
                                                                    {row.hasLoadSize ? (
                                                                        <ElDescriptionsItem
                                                                            label={$t('container.sizeRootFs')}
                                                                            v-slots={{
                                                                                label: () => (
                                                                                    <>
                                                                                        {$t('container.sizeRootFs')}
                                                                                        <ElTooltip
                                                                                            content={$t(
                                                                                                'container.sizeRootFsHelper',
                                                                                            )}
                                                                                        >
                                                                                            <ElIcon class={'icon-item'}>
                                                                                                <InfoFilled />
                                                                                            </ElIcon>
                                                                                        </ElTooltip>
                                                                                    </>
                                                                                ),
                                                                            }}
                                                                        >
                                                                            {computeSize2(row.sizeRootFs)}
                                                                        </ElDescriptionsItem>
                                                                    ) : null}
                                                                </ContainerResource>
                                                            ) : (
                                                                <div>
                                                                    <ElButton link loading />
                                                                </div>
                                                            )}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('container.ip')}
                                                width={unref(isMobile) ? 120 : 'auto'}
                                                card-type="content"
                                                min-width="120"
                                                prop="network"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {getNetworkItems(row).length ? (
                                                                <div>
                                                                    {(getNetworkItems(row) || []).map((item, index) => (
                                                                        <div key={index}>{item}</div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span>{'-'}</span>
                                                            )}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('container.related')}
                                                card-type="description"
                                                show-overflow-tooltip
                                                min-width="210"
                                                prop="appName"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {row.appName || row.websites?.length ? (
                                                                <ElButton link icon="Position" />
                                                            ) : null}
                                                            {row.appName ? (
                                                                <ElText
                                                                    link
                                                                    size="small"
                                                                    onClick={($event?: any) => {
                                                                        routerToName('AppInstalled');
                                                                    }}
                                                                    class={'cursor-pointer'}
                                                                >
                                                                    {$t('app.app')}
                                                                    {': '}
                                                                    {row.appName}
                                                                    {' ['}
                                                                    {row.appInstallName}
                                                                    {'] '}
                                                                </ElText>
                                                            ) : null}
                                                            {row.websites?.length ? (
                                                                <ElText
                                                                    link
                                                                    size="small"
                                                                    onClick={($event?: any) => {
                                                                        routerToName('Website');
                                                                    }}
                                                                    class={'cursor-pointer'}
                                                                >
                                                                    {$t('menu.website')}
                                                                    {': '}
                                                                    {row.websites.join(',')}
                                                                </ElText>
                                                            ) : null}
                                                            {!row.appName && !row.websites?.length ? (
                                                                <span>{'-'}</span>
                                                            ) : null}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('commons.table.port')}
                                                width={unref(isMobile) ? 260 : 'auto'}
                                                align="left"
                                                card-type="content-full"
                                                min-width="200"
                                                prop="ports"
                                                v-slots={{
                                                    default: ({ row, viewMode: columnViewMode }) => (
                                                        <>
                                                            {row.ports ? (
                                                                <div
                                                                    class={cn('container-port-list', {
                                                                        'is-card': columnViewMode === 'card',
                                                                    })}
                                                                >
                                                                    {(row.ports.slice(0, 2) || []).map((item) => (
                                                                        <ElTooltip
                                                                            hide-after={20}
                                                                            content={item}
                                                                            {...TABLE_TOOLTIP_OPTIONS}
                                                                            key={item}
                                                                        >
                                                                            {item.indexOf('->') !== -1 ? (
                                                                                <ElButton
                                                                                    onClick={($event?: any) => {
                                                                                        goDashboard(item);
                                                                                    }}
                                                                                    icon="Position"
                                                                                    plain
                                                                                    size="small"
                                                                                >
                                                                                    {item}
                                                                                </ElButton>
                                                                            ) : (
                                                                                <ElButton plain size="small">
                                                                                    {item}
                                                                                </ElButton>
                                                                            )}
                                                                        </ElTooltip>
                                                                    ))}
                                                                    {row.ports.length > 2 ? (
                                                                        <ElButton
                                                                            plain
                                                                            size="small"
                                                                            onClick={($event?: any) => {
                                                                                openPorts(row);
                                                                            }}
                                                                        >
                                                                            {' +'}
                                                                            {row.ports.length - 2}
                                                                        </ElButton>
                                                                    ) : null}
                                                                </div>
                                                            ) : (
                                                                <div class={'container-port-empty'} />
                                                            )}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                min-width="200"
                                                label={$t('commons.table.description')}
                                                card-type="description"
                                                prop="description"
                                                show-overflow-tooltip
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            {withDirectives(
                                                                <FuInputRwSwitch
                                                                    modelValue={row.description}
                                                                    onUpdate:modelValue={($v) => {
                                                                        row.description = $v as any;
                                                                    }}
                                                                    onEnter={($event?: any) => {
                                                                        changePinned(row, false);
                                                                    }}
                                                                    onBlur={($event?: any) => {
                                                                        changePinned(row, false);
                                                                    }}
                                                                />,
                                                                [[permissionDirective, true]],
                                                            )}
                                                        </>
                                                    ),
                                                }}
                                            />
                                            <ElTableColumn
                                                label={$t('container.upTime')}
                                                card-type="description"
                                                min-width="200"
                                                show-overflow-tooltip
                                                prop="runTime"
                                            />
                                            <ElTableColumn
                                                label={$t('commons.table.createdAt')}
                                                card-type="description"
                                                min-width="180"
                                                show-overflow-tooltip
                                                prop="createdAt"
                                                sortable="custom"
                                                sort-orders={['descending', 'ascending', null]}
                                                v-slots={{ default: ({ row }) => <>{row.createTime}</> }}
                                            />
                                            <FuTableOperations
                                                card-type="button"
                                                fix
                                                width="220px"
                                                ellipsis={2}
                                                buttons={buttons}
                                                label={$t('commons.table.operate')}
                                                fixed={unref(isMobile) ? false : 'right'}
                                                prop="operate"
                                            />
                                        </ComplexTable>
                                    </>
                                ),
                            }}
                        >
                            <DialogPro
                                modelValue={unref(portsDialogVisible)}
                                onUpdate:modelValue={($v) => {
                                    portsDialogVisible.value = $v as any;
                                }}
                                title={`${$t('commons.table.port')} - ${portsDialogContainer}`}
                                size="small"
                                v-slots={{
                                    content: () => (
                                        <>
                                            <div class={'container-port-dialog-filters'}>
                                                <ElInput
                                                    modelValue={unref(portFilter)}
                                                    onUpdate:modelValue={($v) => {
                                                        portFilter.value = $v as any;
                                                    }}
                                                    clearable
                                                    placeholder={$t('commons.button.search')}
                                                />
                                                <ElCheckbox
                                                    border
                                                    modelValue={unref(showIPv6Ports)}
                                                    onUpdate:modelValue={($v) => {
                                                        showIPv6Ports.value = $v as any;
                                                    }}
                                                >
                                                    {'IPv6'}
                                                </ElCheckbox>
                                            </div>
                                            {unref(filteredPorts).length ? (
                                                <div class={'container-port-dialog'}>
                                                    {(unref(filteredPorts) || []).map((item) => (
                                                        <ElTooltip content={item} {...TABLE_TOOLTIP_OPTIONS} key={item}>
                                                            <ElButton
                                                                icon={
                                                                    item.indexOf('->') !== -1 ? 'Position' : undefined
                                                                }
                                                                plain
                                                                size="small"
                                                                onClick={($event?: any) => {
                                                                    item.indexOf('->') !== -1 && goDashboard(item);
                                                                }}
                                                            >
                                                                {item}
                                                            </ElButton>
                                                        </ElTooltip>
                                                    ))}
                                                </div>
                                            ) : (
                                                <ElEmpty image-size={80} />
                                            )}
                                        </>
                                    ),
                                }}
                            />
                        </LayoutContent>
                    ) : null}
                    <OpDialog
                        ref={opRef}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        onSubmit={($event?: any) => {
                            (onSubmitOperate as any)($event);
                        }}
                    />
                    <ContainerInspectDialog ref={containerInspectRef} />
                    <PruneDialog
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        ref={dialogPruneRef}
                    />
                    <RenameDialog
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        ref={dialogRenameRef}
                    />
                    <ContainerLogDialog ref={dialogContainerLogRef} highlightDiff={210} />
                    <UpgradeDialog
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        ref={dialogUpgradeRef}
                    />
                    <CommitDialog
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        ref={dialogCommitRef}
                    />
                    <MonitorDialog ref={dialogMonitorRef} />
                    <TerminalDialog ref={dialogTerminalRef} />
                    <ContainerFileDrawer ref={dialogFileBrowserRef} />
                    <PortJumpDialog ref={dialogPortJumpRef} />
                    <Backups ref={dialogBackupRef} />
                    <Uploads
                        ref={uploadRef}
                        onClose={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                    <TaskLog
                        ref={taskLogRef}
                        width="70%"
                        onClose={($event?: any) => {
                            (search as any)($event);
                        }}
                    />
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);

definePage({
    name: 'ContainerItem',
    props: true,
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'menu.container',
        hidden: true,
    },
});
