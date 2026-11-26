import { $t } from '@/utils/i18n-t';
import { TABLE_OVERFLOW_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { useSearchState } from '@/utils/search-reset';
import CodemirrorPro from '@/components/codemirror-pro/index';
import ContainerLog from '@/components/log/container/index';
import TaskLog from '@/components/log/task/index';
import FileList from '@/components/file-list/index';
import ContainerInspectDialog from '@/pages/containers/_components/container/inspect/index';
import TerminalDialog from '@/pages/containers/_components/container/terminal/index';
import ContainerLogDialog from '@/components/log/container-drawer/index';
import DeleteDialog from '@/pages/containers/_components/compose/delete/index';
import Backups from '@/components/backup/index';
import Uploads from '@/components/upload/index';
import DockerStatus from '@/pages/containers/_components/docker-status/index';
import i18n from '@/lang';
import { Container } from '@/types/container';
import { routerToFileWithPath } from '@/utils/router';
import { MsgError, MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { computeCPU, computeSize2, computeSizeForDocker } from '@/utils/size';
import { newUUID } from '@/utils/id';
import { Rules } from '@/global/form-rules';
import { useGlobalStore } from '@/composables/useGlobalStore';
type FormInstance = InstanceType<typeof ElForm>;
import '@/pages/containers/_components/compose/index.styles.css';
import { cn } from '@/utils/cn';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import { WarningFilled } from '@element-plus/icons-vue';
import SvgIcon from '@/components/svg-icon/svg-icon';
import Status from '@/components/status/index';
import { InfoFilled } from '@element-plus/icons-vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'compose',
    props: {},
    emits: emits,
    __scopeId: 'data-v-78c587a1',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode, isAdminOrNodeAdmin } = useGlobalStore();
        const data = ref<any[]>([]);
        const loading = ref(false);
        const detailLoading = ref(false);
        const currentCompose = ref<Container.ComposeInfo | null>(null);
        const currentYamlPath = ref('');
        const composeContainers = ref([]);
        const composeContent = ref('');
        const dialogDelRef = ref();
        const containerInspectRef = ref();
        const terminalDialogRef = ref();
        const containerLogDialogRef = ref();
        const dialogBackupRef = ref();
        const uploadRef = ref();
        const searchName = ref('');
        useSearchState('container/compose/index', { search: searchName }, { onRevisit: () => search() });
        const includeAppStore = ref(localStorage.getItem('includeAppStore') !== 'false');
        const showType = ref('compose');
        const containerStats = ref<any[]>([]);
        const env = ref();
        const isOnCreate = ref();
        const oldFrom = ref('edit');
        const templateOptions = ref();
        const baseDir = ref();
        const composeFile = ref();
        const taskLogRef = ref();
        const fileRef = ref();
        const formRef = ref<FormInstance>();
        const form = reactive({
            taskID: '',
            name: '',
            dirName: '',
            from: 'edit',
            path: '',
            file: '',
            template: null as number,
            env: '',
            forcePull: false,
        });
        const optionalComposeNameRule = {
            validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
                if (!value || /^[a-z0-9][a-z0-9_-]{0,255}$/.test(value)) {
                    callback();
                    return;
                }
                callback(new Error(i18n.global.t('commons.rule.composeName')));
            },
            trigger: 'blur',
        };
        const rules = computed(() => ({
            name: [optionalComposeNameRule],
            dirName: [Rules.requiredInput, Rules.composeName],
            path: [Rules.requiredInput],
            template: [Rules.requiredSelect],
        }));
        const isActive = ref(false);
        const isExist = ref(false);
        const isAppStoreCompose = computed(() => currentCompose.value?.createdBy === 'Apps');
        const tableData = computed(() => {
            return composeContainers.value.map((container) => {
                const stats = containerStats.value.find((s) => s.containerID === container.containerID);
                return {
                    ...container,
                    hasLoad: !!stats,
                    cpuPercent: stats?.cpuPercent || 0,
                    memoryPercent: stats?.memoryPercent || 0,
                    cpuTotalUsage: stats?.cpuTotalUsage || 0,
                    systemUsage: stats?.systemUsage || 0,
                    percpuUsage: stats?.percpuUsage || 0,
                    memoryCache: stats?.memoryCache || 0,
                    memoryUsage: stats?.memoryUsage || 0,
                    memoryLimit: stats?.memoryLimit || 0,
                    sizeRw: stats?.sizeRw || 0,
                    sizeRootFs: stats?.sizeRootFs || 0,
                };
            });
        });
        const loadFrom = (row: any) => {
            switch (row.createdBy) {
                case '1Panel':
                    return '1Panel';
                case 'Apps':
                    return i18n.global.t('menu.apps');
                default:
                    return i18n.global.t('commons.table.local');
            }
        };
        const getComposeStatus = (row: { containerCount: number; runningCount: number }) => {
            if (row.runningCount === 0) {
                return 'exited';
            }
            if (row.containerCount === row.runningCount) {
                return 'running';
            }
            return 'partial';
        };
        const loadTableHeight = () => {
            if (currentCompose.value?.createdBy === '1Panel') {
                return `calc(100vh - 120px)`;
            } else {
                return `calc(100vh - 240px)`;
            }
        };
        const refresh = async () => {
            if (!isActive.value || !isExist.value) {
                return;
            }
            let params = {
                info: searchName.value,
                page: 1,
                pageSize: 100,
                excludeAppStore: !includeAppStore.value,
            };
            await rpc.container
                .searchCompose({ info: params.info, page: params.page, pageSize: params.pageSize })
                .then((res) => {
                    data.value = res.items || [];
                });
        };
        const search = async (withRefreshDetail?: boolean) => {
            if (!isActive.value || !isExist.value) {
                return;
            }
            localStorage.setItem('includeAppStore', includeAppStore.value ? 'true' : 'false');
            let params = {
                info: searchName.value,
                page: 1,
                pageSize: 100,
                excludeAppStore: !includeAppStore.value,
            };
            loading.value = true;
            await rpc.container
                .searchCompose({ info: params.info, page: params.page, pageSize: params.pageSize })
                .then((res) => {
                    loading.value = false;
                    data.value = res.items || [];
                    if (data.value.length > 0 && withRefreshDetail) {
                        loadDetail(data.value[0], true);
                    }
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const searchWithAppShow = (item: boolean) => {
            includeAppStore.value = item;
            search();
        };
        const changePinned = async (row: Container.ComposeInfo) => {
            await rpc.container.pinCompose({
                name: row.name,
                isPinned: !row.isPinned,
            });
            await search(true);
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
        };
        const loadDetail = async (row: Container.ComposeInfo, withRefresh: boolean) => {
            if (currentCompose.value?.name === row.name && withRefresh !== true) {
                return;
            }
            form.forcePull = false;
            isOnCreate.value = false;
            detailLoading.value = true;
            currentCompose.value = row;
            currentYamlPath.value = row.path.indexOf(',') !== -1 ? row.path.split(',')[0] : row.path;
            env.value = row.env || '';
            composeContainers.value = row.containers || [];
            inspectCompose(row.name, currentYamlPath.value);
        };
        const inspectCompose = async (name: string, detailPath: string) => {
            composeContent.value = '';
            if (!currentCompose.value?.composeFileExists) {
                loadContainerStats();
                detailLoading.value = false;
                return;
            }
            detailLoading.value = true;
            await rpc.container
                .inspect({ id: name, type: 'compose', detail: detailPath })
                .then((res) => {
                    if (currentCompose.value?.name !== name || currentYamlPath.value !== detailPath) {
                        return;
                    }
                    composeContent.value = res.content;
                })
                .finally(() => {
                    if (currentCompose.value?.name !== name || currentYamlPath.value !== detailPath) {
                        return;
                    }
                    loadContainerStats();
                    detailLoading.value = false;
                });
        };
        const loadContainerStats = async () => {
            try {
                const res = await rpc.container.getContainerStats({});
                containerStats.value = (res.items || []) as any;
            } catch (error) {
                containerStats.value = [];
            }
        };
        const onOpenDialog = async () => {
            isOnCreate.value = true;
            loadTemplates();
            form.name = '';
            form.dirName = '';
            form.from = 'edit';
            form.path = '';
            form.file = '';
            form.template = null;
            form.env = '';
            form.forcePull = false;
            loadPath();
            loadTemplates();
        };
        const onEdit = (item: string) => {
            if (item === 'template') {
                changeTemplate();
            }
            if (item === 'form') {
                changeFrom();
            }
        };
        const changeTemplate = () => {
            for (const item of templateOptions.value) {
                if (form.template === item.id) {
                    form.file = item.content;
                    break;
                }
            }
        };
        const changeFrom = () => {
            if ((oldFrom.value === 'edit' || oldFrom.value === 'template') && form.file) {
                ElMessageBox.confirm(i18n.global.t('container.fromChangeHelper'), i18n.global.t('app.source'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                })
                    .then(() => {
                        if (oldFrom.value === 'template') {
                            form.template = null;
                            form.file = '';
                        }
                        if (oldFrom.value === 'edit') {
                            form.file = '';
                        }
                        oldFrom.value = form.from;
                    })
                    .catch(() => {
                        form.from = oldFrom.value;
                    });
            } else {
                oldFrom.value = form.from;
            }
        };
        const loadTemplates = async () => {
            const res = await rpc.container.listTemplates({});
            templateOptions.value = res.items as any;
        };
        const loadPath = async () => {
            const pathRes = await rpc.agentSetting.getBaseDir({});
            baseDir.value = pathRes.path;
            changePath();
        };
        const changePath = async () => {
            composeFile.value = baseDir.value + '/docker/compose/' + form.dirName;
        };
        const loadDir = async (path: string) => {
            form.path = path;
            await rpc.container.getComposeEnv({ name: path }).then((res) => {
                form.env = res.content || '';
            });
        };
        const handleClose = () => {
            search(true);
            taskLogRef.value?.handleClose();
        };
        const closeTask = () => {
            taskLogRef.value?.handleClose();
        };
        const onDelete = (row: any) => {
            dialogDelRef.value.acceptParams({
                name: row.name,
                path: row.path,
            });
        };
        const onBackupList = (row: Container.ComposeInfo) => {
            dialogBackupRef.value?.acceptParams({
                type: 'compose',
                name: row.name,
                detailName: '',
                node: currentNode.value,
            });
        };
        const onImportCompose = () => {
            uploadRef.value?.acceptParams({
                type: 'compose',
                name: '',
                detailName: '',
                remark: '.tar.gz',
                node: currentNode.value,
            });
        };
        const handleComposeOperate = async (operation: 'up' | 'stop' | 'restart' | 'rebuild', row: any) => {
            const mes = i18n.global.t('container.composeOperatorHelper', [
                row.name,
                i18n.global.t('commons.operate.' + operation),
            ]);
            ElMessageBox.confirm(mes, i18n.global.t('commons.operate.' + operation), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                loading.value = true;
                const params = {
                    name: row.name,
                    path: row.path,
                    operation: operation,
                    withFile: false,
                    force: false,
                };
                await rpc.container
                    .operateCompose(params)
                    .then(async () => {
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        await search();
                        if (currentCompose.value) {
                            const updated = data.value.find((item) => item.name === currentCompose.value.name);
                            if (updated) {
                                await loadDetail(updated, true);
                            }
                        }
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const loadSize = async (row: any) => {
            rpc.container.getContainerItemStats({ name: row.containerID }).then((res) => {
                row.sizeRw = Number(res.sizeRw) || 0;
                row.sizeRootFs = Number(res.sizeRootFs) || 0;
                row.hasLoadSize = true;
            });
        };
        const onSubmitEdit = async () => {
            const forcePull = ref(false);
            try {
                await ElMessageBox({
                    title: i18n.global.t('commons.button.save'),
                    message: h('div', { class: 'w-full' }, [
                        h(
                            ElCheckbox,
                            {
                                onChange: (value: string | number | boolean) => {
                                    forcePull.value = Boolean(value);
                                },
                            },
                            {
                                default: () => i18n.global.t('container.forcePull'),
                            },
                        ),
                        h('div', { class: 'input-help mt-1' }, i18n.global.t('container.forcePullHelper')),
                        h('div', { class: 'mt-2 leading-6' }, i18n.global.t('container.updateHelper4')),
                    ]),
                    showCancelButton: true,
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    closeOnClickModal: false,
                });
            } catch {
                return;
            }

            const taskID = newUUID();
            const param = {
                taskID: taskID,
                name: currentCompose.value.name,
                path: currentCompose.value.path,
                detailPath: currentYamlPath.value,
                content: composeContent.value,
                createdBy: currentCompose.value.createdBy,
                env: env.value || '',
                forcePull: forcePull.value,
            };
            loading.value = true;
            await rpc.container
                .updateCompose({ payloadJson: JSON.stringify(param) })
                .then(async () => {
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    openTaskLog(taskID);
                    await search();
                    if (currentCompose.value) {
                        const updated = data.value.find((item) => item.name === currentCompose.value.name);
                        if (updated) {
                            await loadDetail(updated, true);
                        }
                    }
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const onSubmit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                if ((form.from === 'edit' || form.from === 'template') && form.file.length === 0) {
                    MsgError(i18n.global.t('container.contentEmpty'));
                    return;
                }
                loading.value = true;
                await rpc.container
                    .testCompose(form)
                    .then(async (res) => {
                        loading.value = false;
                        if (res.ok) {
                            form.taskID = newUUID();
                            await rpc.container.createCompose({ payloadJson: JSON.stringify(form) });
                            openTaskLog(form.taskID);
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        }
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const openTaskLog = (taskID: string) => {
            taskLogRef.value.openWithTaskID(taskID);
        };
        const openComposeFolder = (row: any) => {
            if (row?.workdir) {
                routerToFileWithPath(row.workdir);
            }
        };
        const onInspectContainer = async (item: any) => {
            if (!item.containerID) {
                return;
            }
            const res = await rpc.container.inspect({ id: item.containerID, type: 'container', detail: '' });
            containerInspectRef.value!.acceptParams({ data: res.content, ports: item.ports || [] });
        };
        const onOpenTerminal = (row: any) => {
            if (!row.containerID) {
                return;
            }
            const title = i18n.global.t('menu.container') + ' ' + row.name;
            terminalDialogRef.value?.acceptParams({ containerID: row.containerID, title });
        };
        const onOpenLog = (row: any) => {
            containerLogDialogRef.value?.acceptParams({ container: row.name });
        };
        return () => (
            <div v-loading={unref(loading)}>
                <DockerStatus
                    isActive={unref(isActive)}
                    onUpdate:isActive={($v) => {
                        isActive.value = $v as any;
                    }}
                    isExist={unref(isExist)}
                    onUpdate:isExist={($v) => {
                        isExist.value = $v as any;
                    }}
                    loading={unref(loading)}
                    onUpdate:loading={($v) => {
                        loading.value = $v as any;
                    }}
                    onSearch={($event?: any) => {
                        search(true);
                    }}
                />
                {unref(isExist) ? (
                    <LayoutContent
                        title={$t('container.compose', 2)}
                        class={{ mask: !unref(isActive) }}
                        v-slots={{
                            leftToolBar: () => (
                                <>
                                    {
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                onOpenDialog();
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
                                                onImportCompose();
                                            }}
                                            v-permission={true}
                                        >
                                            {$t('commons.button.import')}
                                        </ElButton>
                                    }
                                </>
                            ),
                            rightToolBar: () => (
                                <>
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
                                </>
                            ),
                            main: () => (
                                <>
                                    {unref(data).length > 0 || unref(isOnCreate) ? (
                                        <ElRow gutter={20} class={'row-box'}>
                                            <ElCol xs={24} sm={24} md={8} lg={8} xl={6}>
                                                <ElCard>
                                                    <ElTable
                                                        max-height={loadTableHeight()}
                                                        show-header={false}
                                                        onRowClick={($event?: any) => {
                                                            (row, column, event) => loadDetail(row, true);
                                                        }}
                                                        data={unref(data)}
                                                    >
                                                        <ElTableColumn
                                                            prop="name"
                                                            v-slots={{
                                                                default: ({ row }) => (
                                                                    <>
                                                                        <div
                                                                            class={cn('compose-item', {
                                                                                'is-active':
                                                                                    unref(currentCompose)?.name ===
                                                                                        row.name && !unref(isOnCreate),
                                                                            })}
                                                                        >
                                                                            <div
                                                                                class={
                                                                                    'compose-title text-base font-medium'
                                                                                }
                                                                            >
                                                                                <span class={'compose-title__name'}>
                                                                                    {row.name}
                                                                                </span>
                                                                                {!row.composeFileExists ? (
                                                                                    <ElTooltip
                                                                                        content={$t(
                                                                                            'container.composeFileMissing',
                                                                                        )}
                                                                                    >
                                                                                        <ElButton
                                                                                            link
                                                                                            icon="WarningFilled"
                                                                                            onClick={($event?: any) => {
                                                                                                $event.stopPropagation();
                                                                                            }}
                                                                                        >
                                                                                            <WarningFilled />
                                                                                        </ElButton>
                                                                                    </ElTooltip>
                                                                                ) : null}
                                                                                <ElTooltip
                                                                                    content={
                                                                                        row.isPinned
                                                                                            ? $t('commons.table.unpin')
                                                                                            : $t('commons.table.pin')
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        <ElButton
                                                                                            link
                                                                                            type={
                                                                                                row.isPinned
                                                                                                    ? 'warning'
                                                                                                    : 'info'
                                                                                            }
                                                                                            onClick={($event?: any) => {
                                                                                                $event.stopPropagation();
                                                                                                changePinned(row);
                                                                                            }}
                                                                                            class={cn(
                                                                                                'compose-pin-button',
                                                                                                {
                                                                                                    'is-pinned':
                                                                                                        row.isPinned,
                                                                                                },
                                                                                            )}
                                                                                            v-permission={true}
                                                                                        >
                                                                                            <SvgIcon
                                                                                                iconName="p-pushpin"
                                                                                                className="compose-pin-icon"
                                                                                            />
                                                                                        </ElButton>
                                                                                    }
                                                                                </ElTooltip>
                                                                            </div>
                                                                            <div class={'mb-1'}>
                                                                                <ElText
                                                                                    link
                                                                                    size="small"
                                                                                    type="info"
                                                                                    class={'w-12'}
                                                                                >
                                                                                    {loadFrom(row)}
                                                                                </ElText>
                                                                                <ElDivider direction="vertical" />
                                                                                <ElText
                                                                                    link
                                                                                    size="small"
                                                                                    type="info"
                                                                                    class={'ml-2'}
                                                                                >
                                                                                    {row.createdAt}
                                                                                </ElText>
                                                                                <ElDivider direction="vertical" />
                                                                                {row.containerCount === 0 ? (
                                                                                    <ElText
                                                                                        link
                                                                                        type="danger"
                                                                                        size="small"
                                                                                    >
                                                                                        {$t('container.exited')}
                                                                                    </ElText>
                                                                                ) : (
                                                                                    <ElText
                                                                                        link
                                                                                        type={
                                                                                            row.containerCount ===
                                                                                            row.runningCount
                                                                                                ? 'success'
                                                                                                : 'warning'
                                                                                        }
                                                                                        size="small"
                                                                                    >
                                                                                        {$t('container.running', [
                                                                                            row.runningCount,
                                                                                            row.containerCount,
                                                                                        ])}
                                                                                    </ElText>
                                                                                )}
                                                                            </div>
                                                                            <div
                                                                                onClick={($event?: any) => {
                                                                                    $event.stopPropagation();
                                                                                }}
                                                                                class={'compose-actions'}
                                                                            >
                                                                                <ElDropdown
                                                                                    placement="bottom"
                                                                                    v-slots={{
                                                                                        dropdown: () => (
                                                                                            <>
                                                                                                <ElDropdownMenu>
                                                                                                    <ElDropdownItem
                                                                                                        disabled={
                                                                                                            row.containerCount ===
                                                                                                                row.runningCount &&
                                                                                                            row.runningCount >
                                                                                                                0
                                                                                                        }
                                                                                                        onClick={(
                                                                                                            $event?: any,
                                                                                                        ) => {
                                                                                                            handleComposeOperate(
                                                                                                                'up',
                                                                                                                row,
                                                                                                            );
                                                                                                        }}
                                                                                                    >
                                                                                                        {$t(
                                                                                                            'commons.operate.start',
                                                                                                        )}
                                                                                                    </ElDropdownItem>
                                                                                                    <ElDropdownItem
                                                                                                        disabled={
                                                                                                            row.runningCount ===
                                                                                                            0
                                                                                                        }
                                                                                                        onClick={(
                                                                                                            $event?: any,
                                                                                                        ) => {
                                                                                                            handleComposeOperate(
                                                                                                                'stop',
                                                                                                                row,
                                                                                                            );
                                                                                                        }}
                                                                                                    >
                                                                                                        {$t(
                                                                                                            'commons.operate.stop',
                                                                                                        )}
                                                                                                    </ElDropdownItem>
                                                                                                    <ElDropdownItem
                                                                                                        onClick={(
                                                                                                            $event?: any,
                                                                                                        ) => {
                                                                                                            handleComposeOperate(
                                                                                                                'restart',
                                                                                                                row,
                                                                                                            );
                                                                                                        }}
                                                                                                    >
                                                                                                        {$t(
                                                                                                            'commons.button.restart',
                                                                                                        )}
                                                                                                    </ElDropdownItem>
                                                                                                    <ElDropdownItem
                                                                                                        onClick={(
                                                                                                            $event?: any,
                                                                                                        ) => {
                                                                                                            handleComposeOperate(
                                                                                                                'rebuild',
                                                                                                                row,
                                                                                                            );
                                                                                                        }}
                                                                                                    >
                                                                                                        {$t(
                                                                                                            'commons.operate.rebuild',
                                                                                                        )}
                                                                                                    </ElDropdownItem>
                                                                                                </ElDropdownMenu>
                                                                                            </>
                                                                                        ),
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        <Status
                                                                                            status={getComposeStatus(
                                                                                                row,
                                                                                            )}
                                                                                            operate={true}
                                                                                            v-permission={true}
                                                                                        />
                                                                                    }
                                                                                </ElDropdown>
                                                                                {
                                                                                    <ElButton
                                                                                        plain
                                                                                        round
                                                                                        size="small"
                                                                                        disabled={!row?.workdir}
                                                                                        onClick={($event?: any) => {
                                                                                            openComposeFolder(row);
                                                                                        }}
                                                                                        class={'round-btn ml-3'}
                                                                                        v-permission={'host_file_view'}
                                                                                    >
                                                                                        {$t('home.dir')}
                                                                                    </ElButton>
                                                                                }
                                                                                {
                                                                                    <ElButton
                                                                                        plain
                                                                                        round
                                                                                        size="small"
                                                                                        onClick={($event?: any) => {
                                                                                            onBackupList(row);
                                                                                        }}
                                                                                        class={'round-btn'}
                                                                                        v-permission={true}
                                                                                    >
                                                                                        {$t('commons.button.backup')}
                                                                                    </ElButton>
                                                                                }
                                                                                {
                                                                                    <ElButton
                                                                                        plain
                                                                                        round
                                                                                        size="small"
                                                                                        onClick={($event?: any) => {
                                                                                            onDelete(row);
                                                                                        }}
                                                                                        class={'round-btn'}
                                                                                        v-permission={true}
                                                                                    >
                                                                                        {$t('commons.operate.delete')}
                                                                                    </ElButton>
                                                                                }
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                    </ElTable>
                                                </ElCard>
                                            </ElCol>
                                            <ElCol xs={24} sm={24} md={16} lg={16} xl={18}>
                                                {unref(currentCompose) && !unref(isOnCreate) ? (
                                                    <ElCard v-loading={unref(detailLoading)}>
                                                        <div class={'flex items-center justify-between'}>
                                                            <div class={'flex items-center gap-2.5'}>
                                                                <span class={'text-base font-medium'}>
                                                                    {unref(currentCompose).name}
                                                                </span>
                                                                <ElTag size="small" effect="plain" round>
                                                                    {loadFrom(unref(currentCompose))}
                                                                </ElTag>
                                                                <ElDivider direction="vertical" />
                                                                <ElText size="small" type="info">
                                                                    {unref(currentCompose).createdAt}
                                                                </ElText>
                                                            </div>
                                                            {unref(currentCompose).containerCount === 0 ? (
                                                                <ElTag type="danger" effect="light" round>
                                                                    {$t('container.exited')}
                                                                </ElTag>
                                                            ) : (
                                                                <ElTag
                                                                    type={
                                                                        unref(currentCompose).containerCount ===
                                                                        unref(currentCompose).runningCount
                                                                            ? 'success'
                                                                            : 'warning'
                                                                    }
                                                                    effect="light"
                                                                    round
                                                                >
                                                                    {$t('container.running', [
                                                                        unref(currentCompose).runningCount,
                                                                        unref(currentCompose).containerCount,
                                                                    ])}
                                                                </ElTag>
                                                            )}
                                                        </div>
                                                        <ElDivider class={'!my-3'} />
                                                        {unref(composeContainers).length > 0 ? (
                                                            <ElTable
                                                                tooltip-options={TABLE_OVERFLOW_TOOLTIP_OPTIONS}
                                                                data={unref(tableData)}
                                                                size="small"
                                                                max-height="230"
                                                                stripe
                                                                class={'compose-container-table'}
                                                            >
                                                                <ElTableColumn
                                                                    label={$t('commons.table.name')}
                                                                    prop="name"
                                                                    show-overflow-tooltip
                                                                    fixed="left"
                                                                    v-slots={{
                                                                        default: ({ row }) => (
                                                                            <>
                                                                                <ElText
                                                                                    type="primary"
                                                                                    onClick={($event?: any) => {
                                                                                        onInspectContainer(row);
                                                                                    }}
                                                                                    class={'cursor-pointer'}
                                                                                >
                                                                                    {row.name}
                                                                                </ElText>
                                                                            </>
                                                                        ),
                                                                    }}
                                                                />
                                                                <ElTableColumn
                                                                    label={$t('commons.table.status')}
                                                                    prop="state"
                                                                    width="120"
                                                                    v-slots={{
                                                                        default: ({ row }) => (
                                                                            <>
                                                                                <Status
                                                                                    status={row.state}
                                                                                    key={row.state}
                                                                                />
                                                                            </>
                                                                        ),
                                                                    }}
                                                                />
                                                                <ElTableColumn
                                                                    label={$t('container.source')}
                                                                    show-overflow-tooltip
                                                                    prop="resource"
                                                                    v-slots={{
                                                                        default: ({ row }) => (
                                                                            <>
                                                                                {row.hasLoad ? (
                                                                                    <div>
                                                                                        <div class={'source-font'}>
                                                                                            {'CPU: '}
                                                                                            {row.cpuPercent.toFixed(2)}
                                                                                            {'%'}
                                                                                        </div>
                                                                                        <div
                                                                                            class={
                                                                                                'source-font float-left'
                                                                                            }
                                                                                        >
                                                                                            {$t('monitor.memory')}
                                                                                            {': '}
                                                                                            {row.memoryPercent.toFixed(
                                                                                                2,
                                                                                            )}
                                                                                            {'% '}
                                                                                        </div>
                                                                                        <ElPopover
                                                                                            placement="right"
                                                                                            width="500px"
                                                                                            class={'float-right'}
                                                                                            v-slots={{
                                                                                                reference: () => (
                                                                                                    <>
                                                                                                        <SvgIcon
                                                                                                            iconName="p-xiangqing"
                                                                                                            className="resource-detail-icon"
                                                                                                        />
                                                                                                    </>
                                                                                                ),
                                                                                                default: () => (
                                                                                                    <>
                                                                                                        <ElDescriptions
                                                                                                            direction="vertical"
                                                                                                            border
                                                                                                            column={3}
                                                                                                            size="small"
                                                                                                        >
                                                                                                            <ElDescriptionsItem
                                                                                                                label={$t(
                                                                                                                    'container.cpuUsage',
                                                                                                                )}
                                                                                                            >
                                                                                                                {computeCPU(
                                                                                                                    row.cpuTotalUsage,
                                                                                                                )}
                                                                                                            </ElDescriptionsItem>
                                                                                                            <ElDescriptionsItem
                                                                                                                label={$t(
                                                                                                                    'container.cpuTotal',
                                                                                                                )}
                                                                                                            >
                                                                                                                {computeCPU(
                                                                                                                    row.systemUsage,
                                                                                                                )}
                                                                                                            </ElDescriptionsItem>
                                                                                                            <ElDescriptionsItem
                                                                                                                label={$t(
                                                                                                                    'container.core',
                                                                                                                )}
                                                                                                            >
                                                                                                                {
                                                                                                                    row.percpuUsage
                                                                                                                }
                                                                                                            </ElDescriptionsItem>
                                                                                                            <ElDescriptionsItem
                                                                                                                label={$t(
                                                                                                                    'container.memUsage',
                                                                                                                )}
                                                                                                            >
                                                                                                                {computeSizeForDocker(
                                                                                                                    row.memoryUsage,
                                                                                                                )}
                                                                                                            </ElDescriptionsItem>
                                                                                                            <ElDescriptionsItem
                                                                                                                label={$t(
                                                                                                                    'container.memCache',
                                                                                                                )}
                                                                                                            >
                                                                                                                {computeSizeForDocker(
                                                                                                                    row.memoryCache,
                                                                                                                )}
                                                                                                            </ElDescriptionsItem>
                                                                                                            <ElDescriptionsItem
                                                                                                                label={$t(
                                                                                                                    'container.memTotal',
                                                                                                                )}
                                                                                                            >
                                                                                                                {computeSizeForDocker(
                                                                                                                    row.memoryLimit,
                                                                                                                )}
                                                                                                            </ElDescriptionsItem>
                                                                                                            {row.hasLoadSize ? (
                                                                                                                <ElDescriptionsItem
                                                                                                                    v-slots={{
                                                                                                                        label: () => (
                                                                                                                            <>
                                                                                                                                {$t(
                                                                                                                                    'container.sizeRw',
                                                                                                                                )}
                                                                                                                                <ElTooltip
                                                                                                                                    content={$t(
                                                                                                                                        'container.sizeRwHelper',
                                                                                                                                    )}
                                                                                                                                >
                                                                                                                                    <ElIcon
                                                                                                                                        class={
                                                                                                                                            'icon-item'
                                                                                                                                        }
                                                                                                                                    >
                                                                                                                                        <InfoFilled />
                                                                                                                                    </ElIcon>
                                                                                                                                </ElTooltip>
                                                                                                                            </>
                                                                                                                        ),
                                                                                                                    }}
                                                                                                                >
                                                                                                                    {computeSize2(
                                                                                                                        row.sizeRw,
                                                                                                                    )}
                                                                                                                </ElDescriptionsItem>
                                                                                                            ) : null}
                                                                                                            {row.hasLoadSize ? (
                                                                                                                <ElDescriptionsItem
                                                                                                                    label={$t(
                                                                                                                        'container.sizeRootFs',
                                                                                                                    )}
                                                                                                                    v-slots={{
                                                                                                                        label: () => (
                                                                                                                            <>
                                                                                                                                {$t(
                                                                                                                                    'container.sizeRootFs',
                                                                                                                                )}
                                                                                                                                <ElTooltip
                                                                                                                                    content={$t(
                                                                                                                                        'container.sizeRootFsHelper',
                                                                                                                                    )}
                                                                                                                                >
                                                                                                                                    <ElIcon
                                                                                                                                        class={
                                                                                                                                            'icon-item'
                                                                                                                                        }
                                                                                                                                    >
                                                                                                                                        <InfoFilled />
                                                                                                                                    </ElIcon>
                                                                                                                                </ElTooltip>
                                                                                                                            </>
                                                                                                                        ),
                                                                                                                    }}
                                                                                                                >
                                                                                                                    {computeSize2(
                                                                                                                        row.sizeRootFs,
                                                                                                                    )}
                                                                                                                </ElDescriptionsItem>
                                                                                                            ) : null}
                                                                                                        </ElDescriptions>
                                                                                                        {!row.hasLoadSize ? (
                                                                                                            <ElButton
                                                                                                                size="small"
                                                                                                                link
                                                                                                                type="primary"
                                                                                                                onClick={(
                                                                                                                    $event?: any,
                                                                                                                ) => {
                                                                                                                    loadSize(
                                                                                                                        row,
                                                                                                                    );
                                                                                                                }}
                                                                                                                class={
                                                                                                                    'mt-2'
                                                                                                                }
                                                                                                            >
                                                                                                                {$t(
                                                                                                                    'container.loadSize',
                                                                                                                )}
                                                                                                            </ElButton>
                                                                                                        ) : null}
                                                                                                    </>
                                                                                                ),
                                                                                            }}
                                                                                        />
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
                                                                    label={$t('commons.table.operate')}
                                                                    width="160"
                                                                    v-slots={{
                                                                        default: ({ row }) => (
                                                                            <>
                                                                                <ElButton
                                                                                    type="primary"
                                                                                    link
                                                                                    disabled={
                                                                                        !unref(isAdminOrNodeAdmin)
                                                                                    }
                                                                                    onClick={($event?: any) => {
                                                                                        onOpenTerminal(row);
                                                                                    }}
                                                                                >
                                                                                    {$t('menu.terminal')}
                                                                                </ElButton>
                                                                                <ElButton
                                                                                    type="primary"
                                                                                    link
                                                                                    onClick={($event?: any) => {
                                                                                        onOpenLog(row);
                                                                                    }}
                                                                                >
                                                                                    {$t('commons.button.log')}
                                                                                </ElButton>
                                                                            </>
                                                                        ),
                                                                    }}
                                                                />
                                                            </ElTable>
                                                        ) : null}
                                                        {unref(composeContainers).length > 0 ? (
                                                            <ElDivider class={'!my-2'} />
                                                        ) : null}
                                                        <div class={'mb-2 flex items-center justify-between'}>
                                                            <ElRadioGroup v-model={showType.value}>
                                                                <ElRadioButton value="compose">
                                                                    {$t('container.compose')}
                                                                </ElRadioButton>
                                                                <ElRadioButton value="log">
                                                                    {$t('commons.button.log')}
                                                                </ElRadioButton>
                                                                <ElRadioButton value="env">
                                                                    {$t('container.env')}
                                                                </ElRadioButton>
                                                            </ElRadioGroup>
                                                            {unref(showType) !== 'log' &&
                                                            !(unref(showType) === 'env' && unref(isAppStoreCompose)) ? (
                                                                <ElButton
                                                                    type="primary"
                                                                    disabled={
                                                                        unref(detailLoading) || !unref(composeContent)
                                                                    }
                                                                    onClick={($event?: any) => {
                                                                        (onSubmitEdit as any)($event);
                                                                    }}
                                                                    v-permission={true}
                                                                >
                                                                    {$t('commons.button.save')}
                                                                </ElButton>
                                                            ) : null}
                                                        </div>
                                                        {unref(currentCompose).path.indexOf(',') !== -1 ? (
                                                            <ElSelect
                                                                v-model={currentYamlPath.value}
                                                                onChange={($event?: any) => {
                                                                    inspectCompose(
                                                                        unref(currentCompose).name,
                                                                        unref(currentYamlPath),
                                                                    );
                                                                }}
                                                                class={'p-w-300 mb-2'}
                                                                v-slots={{
                                                                    prefix: () => <>{$t('container.composeFile')}</>,
                                                                }}
                                                            >
                                                                {(unref(currentCompose).path.split(',') || []).map(
                                                                    (item) => (
                                                                        <ElOption
                                                                            value={item}
                                                                            label={item.split('/').pop()}
                                                                            key={item}
                                                                        />
                                                                    ),
                                                                )}
                                                            </ElSelect>
                                                        ) : null}
                                                        <div
                                                            style={[
                                                                {},
                                                                {
                                                                    display:
                                                                        unref(showType) === 'compose' ? '' : 'none',
                                                                },
                                                            ]}
                                                        >
                                                            {!unref(currentCompose).composeFileExists ? (
                                                                <ElAlert
                                                                    title={$t('container.composeFileMissing')}
                                                                    type="warning"
                                                                    closable={false}
                                                                    show-icon
                                                                />
                                                            ) : (
                                                                <CodemirrorPro
                                                                    v-model={composeContent.value}
                                                                    mode="yaml"
                                                                    heightDiff={475}
                                                                    placeholder={$t(
                                                                        'container.composeContentPlaceholder',
                                                                    )}
                                                                />
                                                            )}
                                                        </div>
                                                        <div
                                                            style={[
                                                                {},
                                                                {
                                                                    display: unref(showType) === 'log' ? '' : 'none',
                                                                },
                                                            ]}
                                                        >
                                                            {!unref(currentCompose).composeFileExists ? (
                                                                <ElAlert
                                                                    title={$t('container.composeFileMissing')}
                                                                    type="warning"
                                                                    closable={false}
                                                                    show-icon
                                                                />
                                                            ) : (
                                                                <ContainerLog
                                                                    compose={unref(currentCompose).path}
                                                                    resource={unref(currentCompose).name}
                                                                    highlightDiff={450}
                                                                    defaultFollow={true}
                                                                    key={unref(currentCompose).path}
                                                                />
                                                            )}
                                                        </div>
                                                        <div
                                                            style={[
                                                                {},
                                                                {
                                                                    display: unref(showType) === 'env' ? '' : 'none',
                                                                },
                                                            ]}
                                                        >
                                                            <ElInput
                                                                placeholder="key=value"
                                                                type="textarea"
                                                                rows={18}
                                                                readonly={unref(isAppStoreCompose)}
                                                                v-model={env.value}
                                                            />
                                                            {unref(isAppStoreCompose) ? (
                                                                <span class={'input-help'}>
                                                                    {$t('container.composeEnvHelper2')}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </ElCard>
                                                ) : (
                                                    <ElCard>
                                                        {
                                                            <ElForm
                                                                ref={formRef}
                                                                onSubmit={($event?: any) => {
                                                                    $event.preventDefault();
                                                                }}
                                                                label-position="top"
                                                                model={form}
                                                                rules={unref(rules)}
                                                                v-loading={unref(detailLoading)}
                                                            >
                                                                <ElFormItem label={$t('app.source')}>
                                                                    <ElRadioGroup
                                                                        v-model={form.from}
                                                                        onChange={($event?: any) => {
                                                                            onEdit('form');
                                                                        }}
                                                                    >
                                                                        <ElRadio value="edit">
                                                                            {$t('commons.button.edit')}
                                                                        </ElRadio>
                                                                        <ElRadio value="path">
                                                                            {$t('container.pathSelect')}
                                                                        </ElRadio>
                                                                        <ElRadio value="template">
                                                                            {$t('container.composeTemplate')}
                                                                        </ElRadio>
                                                                    </ElRadioGroup>
                                                                </ElFormItem>
                                                                {form.from === 'path' ? (
                                                                    <ElFormItem prop="path">
                                                                        <ElInput
                                                                            onChange={($event?: any) => {
                                                                                loadDir(form.path);
                                                                            }}
                                                                            placeholder={
                                                                                $t('commons.example') +
                                                                                '/tmp/docker-compose.yml'
                                                                            }
                                                                            v-model={form.path}
                                                                            v-slots={{
                                                                                prepend: () => (
                                                                                    <>
                                                                                        <ElButton
                                                                                            icon="Folder"
                                                                                            onClick={($event?: any) => {
                                                                                                unref(
                                                                                                    fileRef,
                                                                                                ).acceptParams({
                                                                                                    dir: false,
                                                                                                });
                                                                                            }}
                                                                                        />
                                                                                    </>
                                                                                ),
                                                                            }}
                                                                        />
                                                                    </ElFormItem>
                                                                ) : null}
                                                                {form.from === 'template' ? (
                                                                    <ElFormItem prop="template">
                                                                        <ElSelect
                                                                            v-model={form.template}
                                                                            onChange={($event?: any) => {
                                                                                onEdit('template');
                                                                            }}
                                                                            v-slots={{
                                                                                prefix: () => (
                                                                                    <>{$t('container.template')}</>
                                                                                ),
                                                                            }}
                                                                        >
                                                                            {(unref(templateOptions) || []).map(
                                                                                (item) => (
                                                                                    <ElOption
                                                                                        value={item.id}
                                                                                        label={item.name}
                                                                                        key={item.id}
                                                                                    />
                                                                                ),
                                                                            )}
                                                                        </ElSelect>
                                                                    </ElFormItem>
                                                                ) : null}
                                                                {form.from === 'edit' || form.from === 'template' ? (
                                                                    <ElFormItem prop="dirName">
                                                                        <ElInput
                                                                            onInput={($event?: any) => {
                                                                                (changePath as any)($event);
                                                                            }}
                                                                            onChange={($event?: any) => {
                                                                                onEdit('');
                                                                            }}
                                                                            modelValue={form.dirName}
                                                                            onUpdate:modelValue={($v) => {
                                                                                form.dirName =
                                                                                    typeof $v === 'string'
                                                                                        ? $v.trim()
                                                                                        : $v;
                                                                            }}
                                                                            v-slots={{
                                                                                prefix: () => (
                                                                                    <>
                                                                                        <span
                                                                                            style={'margin-right: 8px'}
                                                                                        >
                                                                                            {$t('commons.table.name')}
                                                                                        </span>
                                                                                    </>
                                                                                ),
                                                                            }}
                                                                        />
                                                                        <span class={'input-help'}>
                                                                            {$t('container.composePathHelper', [
                                                                                unref(composeFile),
                                                                                form.dirName,
                                                                            ])}
                                                                        </span>
                                                                    </ElFormItem>
                                                                ) : null}
                                                                {form.from === 'path' ? (
                                                                    <ElFormItem prop="name">
                                                                        <ElInput
                                                                            modelValue={form.name}
                                                                            onUpdate:modelValue={($v) => {
                                                                                form.name =
                                                                                    typeof $v === 'string'
                                                                                        ? $v.trim()
                                                                                        : $v;
                                                                            }}
                                                                            v-slots={{
                                                                                prefix: () => (
                                                                                    <>
                                                                                        <span
                                                                                            style={'margin-right: 8px'}
                                                                                        >
                                                                                            {$t('commons.table.name')}
                                                                                        </span>
                                                                                    </>
                                                                                ),
                                                                            }}
                                                                        />
                                                                        <span class={'input-help'}>
                                                                            {$t('container.composeNamePriorityHelper')}
                                                                        </span>
                                                                    </ElFormItem>
                                                                ) : null}
                                                                <ElFormItem>
                                                                    {form.from === 'edit' ||
                                                                    form.from === 'template' ? (
                                                                        <div class={'w-full'}>
                                                                            <CodemirrorPro
                                                                                v-model={form.file}
                                                                                placeholder={$t(
                                                                                    'container.composeContentPlaceholder',
                                                                                )}
                                                                                mode="yaml"
                                                                                heightDiff={400}
                                                                            />
                                                                        </div>
                                                                    ) : null}
                                                                </ElFormItem>
                                                                <span class={'envTitle'}>{$t('container.env')}</span>
                                                                <ElInput
                                                                    placeholder="key=value"
                                                                    type="textarea"
                                                                    rows={3}
                                                                    v-model={form.env}
                                                                />
                                                                <span class={'envTitle'}>
                                                                    {$t('commons.button.set')}
                                                                </span>
                                                                <ElFormItem>
                                                                    <ElCheckbox
                                                                        v-model={form.forcePull}
                                                                        label={$t('container.forcePull')}
                                                                    />
                                                                    <span class={'input-help'}>
                                                                        {$t('container.forcePullHelper')}
                                                                    </span>
                                                                </ElFormItem>
                                                            </ElForm>
                                                        }
                                                        {
                                                            <ElButton
                                                                type="primary"
                                                                onClick={($event?: any) => {
                                                                    onSubmit(unref(formRef));
                                                                }}
                                                                class={'mt-2'}
                                                                v-permission={true}
                                                            >
                                                                {$t('commons.button.save')}
                                                            </ElButton>
                                                        }
                                                    </ElCard>
                                                )}
                                            </ElCol>
                                        </ElRow>
                                    ) : (
                                        <ElEmpty description={$t('commons.msg.noneData')} />
                                    )}
                                </>
                            ),
                        }}
                    />
                ) : null}
                <TaskLog
                    ref={taskLogRef}
                    width="70%"
                    v-slots={{
                        'task-footer': () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.table.backToList')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (closeTask as any)($event);
                                    }}
                                >
                                    {$t('commons.table.keepEdit')}
                                </ElButton>
                            </>
                        ),
                    }}
                />
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (loadDir as any)($event);
                    }}
                />
                <DeleteDialog
                    onSearch={($event?: any) => {
                        search(true);
                    }}
                    ref={dialogDelRef}
                />
                <ContainerInspectDialog ref={containerInspectRef} />
                <TerminalDialog ref={terminalDialogRef} />
                <ContainerLogDialog ref={containerLogDialogRef} highlightDiff={210} />
                <Backups
                    ref={dialogBackupRef}
                    onClose={($event?: any) => {
                        search(true);
                    }}
                />
                <Uploads
                    ref={uploadRef}
                    onClose={($event?: any) => {
                        search(true);
                    }}
                />
            </div>
        );
    },
    options,
);

definePage({
    name: 'Compose',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.compose',
        hidden: true,
    },
});
