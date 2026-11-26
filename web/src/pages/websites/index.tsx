import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import Backups from '@/components/backup/index';
import UploadDialog from '@/components/upload/index';
import DefaultServer from '@/pages/websites/_components/website/default/index';
import CreateWebSite from '@/pages/websites/_components/website/create/index';
import DeleteWebsite from '@/pages/websites/_components/website/delete/index';
import NginxConfig from '@/pages/websites/_components/website/nginx/index';
import GroupDialog from '@/components/agent-group/index';
import AppStatus from '@/components/app-status/index';
import TaskLog from '@/components/log/task/index';
import Domain from '@/pages/websites/_components/website/domain/index';
import BatchSetGroup from '@/pages/websites/_components/website/batch-op/group';
import BatchSetHttps from '@/pages/websites/_components/website/batch-op/https';
import i18n from '@/lang';
import { Website } from '@/types/website';
import { App } from '@/types/app';
import { dateFormatSimple, isNeverExpire } from '@/utils/date';
import { newUUID } from '@/utils/id';
import { MsgError, MsgSuccess } from '@/utils/message';
import { useI18n } from 'vue-i18n';
import { Group } from '@/types/group';
import { getWebsiteTypes } from '@/global/mimetype';
import { routerToFileWithPath, routerToNameWithParams, routerToNameWithQuery } from '@/utils/router';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { useOperateNodeContext } from '@/composables/useOperateNodeContext';
import { usePageState } from '@/composables/usePageState';
import { rpc } from '@/lib/rpc';
import '@/pages/websites/_components/website/index.styles.css';
import RouterButton from '@/components/router-button/index';
import LayoutContent from '@/components/layout-content/index';
import TableViewSwitch from '@/components/table/TableViewSwitch';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import FuTableColumnSelect from '@/components/table/TableColumnSelect';
import ComplexTable from '@/components/table/complex/ComplexTable';
import { FolderOpened } from '@element-plus/icons-vue';
import Status from '@/components/status/index';
import FuReadWriteSwitch from '@/components/fu/FuReadWriteSwitch';
import MsgInfo from '@/components/msg-info/index';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'websites',
    props: {},
    emits: emits,
    __scopeId: 'data-v-84f81abe',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { currentNode, isMobile } = useGlobalStore();
        useOperateNodeContext(currentNode);
        const shortcuts = [
            {
                text: useI18n().t('website.ever'),
                value: () => {
                    return new Date('2006-01-02');
                },
            },
            {
                text: i18n.global.t('website.nextYear'),
                value: () => {
                    const now = new Date();
                    now.setFullYear(now.getFullYear() + 1);
                    return now;
                },
            },
        ];
        const WebsiteTypes = getWebsiteTypes();
        const loading = ref(false);
        const viewMode = ref<'table' | 'card'>('table');
        const maskShow = ref(false);
        const createRef = ref();
        const deleteRef = ref();
        const groupRef = ref();
        const openNginxConfig = ref(false);
        const nginxIsExist = ref(false);
        const containerName = ref('');
        const nginxStatus = ref('');
        const uploadRef = ref();
        const dialogBackupRef = ref();
        const defaultRef = ref();
        const data = ref();
        let groups = ref<Group.GroupInfo[]>([]);
        const dataRef = ref();
        const columns = ref([]);
        const websiteDir = ref();
        const selects = ref([]);
        const batchReq = reactive({
            operate: '',
            ids: [] as number[],
            taskID: '',
        });
        const taskLogRef = ref();
        const opRef = ref();
        const batchSetGroupRef = ref();
        const batchSetHttpsRef = ref();
        const nginxVersion = ref();
        const appStatusRef = ref();
        const pageState = usePageState(() => ({
            paginationConfig: {
                currentPage: 1,
                pageSize: 20,
                total: 0,
            },
            req: {
                name: '',
                page: 1,
                pageSize: 10,
                orderBy: 'favorite',
                order: 'descending',
                websiteGroupId: 0,
                type: '',
            },
            tableSort: {
                prop: '',
                order: null as 'ascending' | 'descending' | null,
            },
        }));
        const paginationConfig = pageState.paginationConfig;
        const req = pageState.req;
        useSearchState(
            'website/website/index',
            {
                search: toRef(req, 'name'),
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const tableSort = pageState.tableSort;
        const goRouter = async (key: string) => {
            routerToNameWithQuery('AppAll', { install: key });
        };
        const favoriteWebsite = (row: Website.Website) => {
            row.favorite = !row.favorite;
            updateWebsitConfig(row);
        };
        const handleDomainEdit = (row: Website.Website, domain: string) => {
            row.primaryDomain = domain;
            updateWebsitConfig(row);
        };
        const disabledConfig = computed(() => {
            return nginxStatus.value != 'Running';
        });
        const changeSort = ({ prop, order }) => {
            tableSort.prop = prop || '';
            tableSort.order = order || null;
            if (order) {
                switch (prop) {
                    case 'primaryDomain':
                        prop = 'primary_domain';
                        break;
                    case 'expireDate':
                        prop = 'expire_date';
                        break;
                    default:
                        break;
                }
                req.orderBy = prop;
                req.order = order;
            } else {
                req.orderBy = 'favorite';
                req.order = 'descending';
            }
            search();
        };
        const search = async () => {
            req.page = paginationConfig.currentPage;
            req.pageSize = paginationConfig.pageSize;

            loading.value = true;
            try {
                const res = await rpc.website.search({
                    page: req.page,
                    pageSize: req.pageSize,
                    name: req.name,
                    orderBy: req.orderBy,
                    order: req.order,
                    websiteGroupId: req.websiteGroupId,
                    type: req.type,
                });
                data.value = res.items;
                paginationConfig.total = Number(res.total);
            } finally {
                loading.value = false;
            }
        };
        const listGroup = async (searchOnReset = true) => {
            const res = await rpc.group.searchGroups({ type: 'website' });
            groups.value = (res.items || []).map((item) => ({ ...item, isDelete: false }));
            if (req.websiteGroupId !== 0 && !groups.value.some((group) => group.id === req.websiteGroupId)) {
                req.websiteGroupId = 0;
                paginationConfig.currentPage = 1;
                if (searchOnReset) {
                    search();
                }
            }
        };
        const setting = () => {
            openNginxConfig.value = true;
        };
        const openConfig = (id: number) => {
            routerToNameWithParams('WebsiteConfig', { id: id, tab: 'basic' });
        };
        const isEver = (time: string) => isNeverExpire(time);
        const isBeforeNow = (time: string) => {
            return new Date() > new Date(time);
        };
        const refreshData = () => {
            for (let i = 0; i < data.value.length; i++) {
                if (data.value[i].showdate) {
                    data.value[i].showdate = false;
                    if (data.value[i].oldExpireDate) {
                        data.value[i].expireDate = data.value[i].oldExpireDate;
                        data.value[i].oldExpireDate = undefined;
                    }
                }
            }
            if (dataRef.value) {
                dataRef.value.handleClose();
                dataRef.value = undefined;
            }
        };
        const openDatePicker = (row: any) => {
            if (row.type === 'stream') {
                return;
            }
            refreshData();
            row.showdate = true;
        };
        const setdateRefs = (ref: any) => {
            dataRef.value = ref;
            if (dataRef.value != undefined) {
                dataRef.value.handleOpen();
            }
        };
        const initDatePicker = (row: any) => {
            if (
                (dataRef.value == undefined && row.oldExpireDate == undefined && isBeforeNow(row.expireDate)) ||
                isEver(row.expireDate)
            ) {
                row.oldExpireDate = row.expireDate;
                const date = new Date().toLocaleDateString();
                row.expireDate = date;
                return;
            }
        };
        const pickerVisibility = (visibility: boolean, row: any) => {
            if (!visibility) {
                dataRef.value = undefined;
                if (row.oldExpireDate) {
                    row.expireDate = row.oldExpireDate;
                    row.oldExpireDate = undefined;
                }
                row.showdate = false;
            }
        };
        const updateWebsitConfig = (row: any) => {
            let reqDate = dateFormatSimple(row.expireDate);
            if (reqDate == '2006-01-02') {
                reqDate = '9999-12-31';
            }
            rpc.website
                .updateWebsite({
                    id: row.id,
                    primaryDomain: row.primaryDomain ?? '',
                    remark: row.remark ?? '',
                    websiteGroupId: Number(row.websiteGroupId ?? row.webSiteGroupId ?? 0),
                    expireDate: reqDate,
                    ipv6: !!(row.ipv6 ?? row.IPV6),
                    favorite: !!row.favorite,
                })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    search();
                });
        };
        const buttons = [
            {
                label: i18n.global.t('menu.config'),
                permission: true,
                click: function (row: Website.Website) {
                    openConfig(row.id);
                },
            },
            {
                label: i18n.global.t('database.backupList'),
                permission: true,
                click: (row: Website.Website) => {
                    let params = {
                        type: 'website',
                        name: row.alias,
                        detailName: row.alias,
                    };
                    dialogBackupRef.value!.acceptParams(params);
                },
            },
            {
                label: i18n.global.t('database.loadBackup'),
                permission: true,
                click: (row: Website.Website) => {
                    let params = {
                        type: 'website',
                        name: row.primaryDomain,
                        detailName: row.alias,
                    };
                    uploadRef.value!.acceptParams(params);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Website.Website) {
                    openDelete(row);
                },
            },
        ];
        const openDelete = (website: Website.Website) => {
            deleteRef.value.acceptParams(website);
        };
        const openCreate = () => {
            createRef.value.acceptParams(nginxVersion.value);
        };
        const openGroup = () => {
            groupRef.value.acceptParams({ type: 'website' });
        };
        const openDefault = () => {
            defaultRef.value.acceptParams();
        };
        const checkExist = (data: App.CheckInstalled) => {
            nginxIsExist.value = data.isExist;
            containerName.value = data.containerName;
            nginxStatus.value = data.status;
            websiteDir.value = data.websiteDir;
            nginxVersion.value = data.version;
        };
        const checkDate = (date: Date) => {
            const now = new Date();
            return date.getTime() < now.getTime();
        };
        const operateWebsite = (op: string, row: Website.Website) => {
            if (row.type === 'stream') {
                return;
            }
            ElMessageBox.confirm(i18n.global.t('website.' + op + 'Helper'), i18n.global.t('cronjob.changeStatus'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                await rpc.website.operateWebsite({ id: row.id, operate: op });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                search();
            });
        };
        const updateRemark = (row: Website.Website, bulr: Function) => {
            bulr();
            if (row.remark && row.remark.length > 128) {
                MsgError(i18n.global.t('commons.rule.length128Err'));
                return;
            }
            updateWebsitConfig(row);
        };
        const openTaskLog = () => {
            selects.value = [];
            batchReq.operate = '';
            taskLogRef.value.openWithTaskID(batchReq.taskID);
        };
        const batchOp = () => {
            switch (batchReq.operate) {
                case 'setHttps':
                    const tID = newUUID();
                    batchReq.taskID = tID;
                    batchSetHttpsRef.value.acceptParams(
                        selects.value.map((item) => item.id),
                        tID,
                    );
                    break;
                case 'group':
                    batchSetGroupRef.value.acceptParams(selects.value.map((item) => item.id));
                    break;
                default:
                    const names = selects.value.map((item) => item.primaryDomain);
                    batchReq.ids = selects.value.map((item) => item.id);
                    const taskID = newUUID();
                    batchReq.taskID = taskID;
                    opRef.value.acceptParams({
                        names: names,
                        title: i18n.global.t('website.batchOperate'),
                        api: (params: typeof batchReq) =>
                            rpc.website.batchOperate({
                                ids: params.ids,
                                operate: params.operate,
                                taskId: params.taskID,
                            }),
                        msg: i18n.global.t('website.batchOperateHelper', [
                            i18n.global.t('commons.button.' + batchReq.operate),
                        ]),
                        params: batchReq,
                        noMsg: true,
                    });
                    return;
            }
        };
        onMounted(async () => {
            try {
                await listGroup(false);
            } catch {
                // The request interceptor already reports the error; website loading should continue.
            }
            search();
        });
        return () => (
            <div>
                <RouterButton
                    buttons={[
                        {
                            label: i18n.global.t('menu.website', 2),
                            path: '/websites',
                        },
                    ]}
                />
                {
                    <LayoutContent
                        title={$t('menu.website', 2)}
                        v-slots={{
                            app: () => (
                                <>
                                    <AppStatus
                                        app-key={'openresty'}
                                        onSetting={($event?: any) => {
                                            (setting as any)($event);
                                        }}
                                        mask-show={unref(maskShow)}
                                        onUpdate:mask-show={($v) => {
                                            maskShow.value = $v as any;
                                        }}
                                        loading={unref(loading)}
                                        onUpdate:loading={($v) => {
                                            loading.value = $v as any;
                                        }}
                                        onIsExist={($event?: any) => {
                                            (checkExist as any)($event);
                                        }}
                                        ref={appStatusRef}
                                    />
                                </>
                            ),
                            leftToolBar: () => (
                                <>
                                    {
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                (openCreate as any)($event);
                                            }}
                                            disabled={unref(disabledConfig)}
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
                                                (openGroup as any)($event);
                                            }}
                                            disabled={unref(disabledConfig)}
                                            v-permission={true}
                                        >
                                            {$t('commons.table.group')}
                                        </ElButton>
                                    }
                                    {
                                        <ElButton
                                            type="primary"
                                            plain
                                            onClick={($event?: any) => {
                                                (openDefault as any)($event);
                                            }}
                                            disabled={unref(disabledConfig)}
                                            v-permission={true}
                                        >
                                            {$t('website.advancedSettings')}
                                        </ElButton>
                                    }
                                </>
                            ),
                            rightToolBar: () => (
                                <>
                                    <TableViewSwitch v-model={viewMode.value} storage-key="website" />
                                    <ElSelect
                                        v-model={req.type}
                                        onChange={($event?: any) => {
                                            search();
                                        }}
                                        disabled={unref(disabledConfig)}
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('commons.table.type')}</> }}
                                    >
                                        <ElOption label={$t('commons.table.all')} value={''} />
                                        {(WebsiteTypes || []).map((item) => (
                                            <ElOption label={item.label} value={item.value} key={item.value} />
                                        ))}
                                    </ElSelect>
                                    <ElSelect
                                        v-model={req.websiteGroupId}
                                        onChange={($event?: any) => {
                                            search();
                                        }}
                                        disabled={unref(disabledConfig)}
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('commons.table.group')}</> }}
                                    >
                                        <ElOption label={$t('commons.table.all')} value={0} />
                                        {(unref(groups) || []).map((item) => (
                                            <ElOption label={item.name} value={item.id} key={item.id} />
                                        ))}
                                    </ElSelect>
                                    <TableSearch
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        searchName={req.name}
                                        onUpdate:searchName={($v) => {
                                            req.name = $v as any;
                                        }}
                                        disabled={unref(disabledConfig)}
                                    />
                                    <TableRefresh
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        disabled={unref(disabledConfig)}
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
                                        selection-context={() => [req.name, req.type, req.websiteGroupId]}
                                        row-key="id"
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        default-sort={tableSort.order ? tableSort : undefined}
                                        view-mode={unref(viewMode)}
                                        onUpdate:view-mode={($v) => {
                                            viewMode.value = $v as any;
                                        }}
                                        data={unref(data)}
                                        onSortChange={($event?: any) => {
                                            (changeSort as any)($event);
                                        }}
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        heightDiff={310}
                                        columns={unref(columns)}
                                        localKey="websiteColumn"
                                        selects={unref(selects)}
                                        onUpdate:selects={($v) => {
                                            selects.value = $v as any;
                                        }}
                                        class={{ mask: unref(disabledConfig) }}
                                        v-slots={{
                                            footerLeft: ({ selected, toggleSelection }) => (
                                                <>
                                                    {
                                                        <div class={'footer-left-button'} v-permission={true}>
                                                            <ElSelect
                                                                v-model={batchReq.operate}
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
                                                                                    (toggleSelection as any)($event);
                                                                                }}
                                                                            />
                                                                        </>
                                                                    ),
                                                                }}
                                                            >
                                                                <ElOption
                                                                    label={
                                                                        $t('commons.button.start') + $t('menu.website')
                                                                    }
                                                                    value="start"
                                                                />
                                                                <ElOption
                                                                    label={
                                                                        $t('commons.button.stop') + $t('menu.website')
                                                                    }
                                                                    value="stop"
                                                                />
                                                                <ElOption
                                                                    label={
                                                                        $t('commons.button.delete') + $t('menu.website')
                                                                    }
                                                                    value="delete"
                                                                />
                                                                <ElOption
                                                                    label={
                                                                        $t('commons.button.set') +
                                                                        $t('commons.table.group')
                                                                    }
                                                                    value="group"
                                                                />
                                                                <ElOption
                                                                    label={$t('commons.button.set') + $t('website.ssl')}
                                                                    value="setHttps"
                                                                />
                                                            </ElSelect>
                                                            <ElButton
                                                                type="primary"
                                                                disabled={
                                                                    unref(selects).length == 0 || batchReq.operate == ''
                                                                }
                                                                onClick={($event?: any) => {
                                                                    (batchOp as any)($event);
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
                                                        </div>
                                                    }
                                                </>
                                            ),
                                        }}
                                    >
                                        <ElTableColumn type="selection" width="32" />
                                        <ElTableColumn
                                            label={$t('commons.table.name')}
                                            fix
                                            prop="primaryDomain"
                                            min-width="250px"
                                            sortable
                                            card-type="name"
                                            v-slots={{
                                                default: ({ row, viewMode: columnViewMode }) => (
                                                    <>
                                                        {columnViewMode === 'card' ? (
                                                            <div class={'website-card-domain'}>
                                                                <ElText
                                                                    type="primary"
                                                                    onClick={($event?: any) => {
                                                                        openConfig(row.id);
                                                                    }}
                                                                    class={'website-card-domain__name cursor-pointer'}
                                                                >
                                                                    {row.primaryDomain}
                                                                </ElText>
                                                                <Domain
                                                                    row={row}
                                                                    defaultHttpPort={
                                                                        unref(appStatusRef)?.getHttpPort?.() || 0
                                                                    }
                                                                    defaultHttpsPort={
                                                                        unref(appStatusRef)?.getHttpsPort?.() || 0
                                                                    }
                                                                    hide-name={true}
                                                                    show-favorite={true}
                                                                    onFavoriteChange={($event?: any) => {
                                                                        (favoriteWebsite as any)($event);
                                                                    }}
                                                                    onDomainEdit={($event?: any) => {
                                                                        (handleDomainEdit as any)($event);
                                                                    }}
                                                                    class={'website-card-domain__actions'}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <Domain
                                                                row={row}
                                                                defaultHttpPort={
                                                                    unref(appStatusRef)?.getHttpPort?.() || 0
                                                                }
                                                                defaultHttpsPort={
                                                                    unref(appStatusRef)?.getHttpsPort?.() || 0
                                                                }
                                                                onFavoriteChange={($event?: any) => {
                                                                    (favoriteWebsite as any)($event);
                                                                }}
                                                                onDomainEdit={($event?: any) => {
                                                                    (handleDomainEdit as any)($event);
                                                                }}
                                                            />
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            width="180px"
                                            label={$t('commons.table.type')}
                                            fix
                                            show-overflow-tooltip
                                            prop="type"
                                            sortable
                                            card-type="content"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.type ? (
                                                            <div>
                                                                {$t('website.' + row.type)}
                                                                {row.type === 'deployment' ? (
                                                                    <span>
                                                                        {'['}
                                                                        {row.appName}
                                                                        {']'}
                                                                    </span>
                                                                ) : null}
                                                                {row.type === 'runtime' ? (
                                                                    <span>
                                                                        {'['}
                                                                        {row.runtimeName}
                                                                        {']'}
                                                                    </span>
                                                                ) : null}
                                                                {row.type === 'subsite' ? (
                                                                    <span>
                                                                        {'['}
                                                                        {row.parentSite}
                                                                        {']'}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('website.sitePath')}
                                            prop="sitePath"
                                            width="90px"
                                            card-type="content"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {
                                                            <ElButton
                                                                type="primary"
                                                                link
                                                                onClick={($event?: any) => {
                                                                    routerToFileWithPath(row.sitePath + '/index');
                                                                }}
                                                                v-permission={'host_file_view'}
                                                            >
                                                                <ElIcon>
                                                                    <FolderOpened />
                                                                </ElIcon>
                                                            </ElButton>
                                                        }
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.status')}
                                            prop="status"
                                            width="120px"
                                            sortable
                                            align="center"
                                            card-type="status"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.type === 'stream' ? (
                                                            <span>
                                                                <ElText type="success">
                                                                    {$t(
                                                                        'commons.status.' +
                                                                            row.status.toLocaleLowerCase(),
                                                                    )}
                                                                </ElText>
                                                            </span>
                                                        ) : (
                                                            <span>
                                                                {row.status === 'Running' ? (
                                                                    <Status
                                                                        operate={true}
                                                                        status={row.status}
                                                                        onClick={($event?: any) => {
                                                                            operateWebsite('stop', row);
                                                                        }}
                                                                        v-permission={true}
                                                                    />
                                                                ) : (
                                                                    <Status
                                                                        status={row.status}
                                                                        operate={true}
                                                                        onClick={($event?: any) => {
                                                                            operateWebsite('start', row);
                                                                        }}
                                                                        v-permission={true}
                                                                    />
                                                                )}
                                                            </span>
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.protocol')}
                                            prop="protocol"
                                            width="90px"
                                            card-type="content"
                                        />
                                        <ElTableColumn
                                            label={$t('website.expireDate')}
                                            prop="expireDate"
                                            sortable={'custom'}
                                            width="150px"
                                            card-type="description"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.showdate ? (
                                                            <div>
                                                                <ElDatePicker
                                                                    v-model={row.expireDate}
                                                                    type="date"
                                                                    disabled-date={checkDate}
                                                                    shortcuts={shortcuts}
                                                                    clearable={false}
                                                                    onChange={($event?: any) => {
                                                                        updateWebsitConfig(row);
                                                                    }}
                                                                    ref={(el) => setdateRefs(el)}
                                                                    onVisibleChange={($event?: any) => {
                                                                        (visibility: boolean) =>
                                                                            pickerVisibility(visibility, row);
                                                                    }}
                                                                    size="small"
                                                                    mounted={initDatePicker(row)}
                                                                    class={'p-w-100'}
                                                                    key={row.id}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                {
                                                                    <ElLink
                                                                        type="primary"
                                                                        underline="never"
                                                                        onClick={($event?: any) => {
                                                                            $event.stopPropagation();
                                                                            openDatePicker(row);
                                                                        }}
                                                                        v-permission={true}
                                                                    >
                                                                        {isEver(row.expireDate) ? (
                                                                            <span>{$t('website.neverExpire')}</span>
                                                                        ) : (
                                                                            <span>
                                                                                {dateFormatSimple(row.expireDate)}
                                                                            </span>
                                                                        )}
                                                                    </ElLink>
                                                                }
                                                            </div>
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('website.sslExpireDate')}
                                            prop="sslExpireDate"
                                            width="160px"
                                            card-type="description"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.protocol == 'HTTPS' ? (
                                                            <ElTag type={row.sslStatus}>
                                                                {dateFormatSimple(row.sslExpireDate)}
                                                            </ElTag>
                                                        ) : (
                                                            <span />
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('website.remark')}
                                            prop="remark"
                                            min-width="150px"
                                            card-type="description"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {
                                                            <FuReadWriteSwitch
                                                                v-slots={{
                                                                    read: () => (
                                                                        <>
                                                                            <MsgInfo info={row.remark} width={'150'} />
                                                                        </>
                                                                    ),
                                                                    default: ({ read }) => (
                                                                        <>
                                                                            <ElInput
                                                                                v-model={row.remark}
                                                                                onBlur={($event?: any) => {
                                                                                    updateRemark(row, read);
                                                                                }}
                                                                            />
                                                                        </>
                                                                    ),
                                                                }}
                                                                v-permission={true}
                                                            />
                                                        }
                                                    </>
                                                ),
                                            }}
                                        />
                                        <FuTableOperations
                                            ellipsis={1}
                                            width="180px"
                                            buttons={buttons}
                                            label={$t('commons.table.operate')}
                                            fixed={unref(isMobile) ? false : 'right'}
                                            fix
                                            card-type="button"
                                        />
                                    </ComplexTable>
                                    {unref(disabledConfig) && unref(maskShow) ? (
                                        <ElCard width="30%" class={'mask-prompt'}>
                                            {unref(nginxIsExist) ? (
                                                <span>
                                                    {$t('commons.service.serviceNotStarted', ['OpenResty'])}
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            routerToFileWithPath(unref(websiteDir));
                                                        }}
                                                        icon="FolderOpened"
                                                    >
                                                        {$t('website.toWebsiteDir')}
                                                    </ElButton>
                                                </span>
                                            ) : (
                                                <span>
                                                    {$t('app.checkInstalledWarn', ['OpenResty'])}
                                                    <ElButton
                                                        onClick={($event?: any) => {
                                                            goRouter('openresty');
                                                        }}
                                                        link
                                                        icon="Position"
                                                        type="primary"
                                                    >
                                                        {$t('database.goInstall')}
                                                    </ElButton>
                                                </span>
                                            )}
                                        </ElCard>
                                    ) : null}
                                </>
                            ),
                        }}
                        v-loading={unref(loading)}
                    />
                }
                <CreateWebSite
                    ref={createRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <DeleteWebsite
                    ref={deleteRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <UploadDialog ref={uploadRef} />
                <Backups ref={dialogBackupRef} />
                <DefaultServer ref={defaultRef} />
                <GroupDialog
                    onSearch={($event?: any) => {
                        (listGroup as any)($event);
                    }}
                    ref={groupRef}
                />
                {unref(openNginxConfig) ? (
                    <NginxConfig
                        containerName={unref(containerName)}
                        status={unref(nginxStatus)}
                        v-loading={unref(loading)}
                    />
                ) : null}
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (openTaskLog as any)($event);
                    }}
                />
                <BatchSetGroup
                    ref={batchSetGroupRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <BatchSetHttps
                    ref={batchSetHttpsRef}
                    onOpenTask={($event?: any) => {
                        (openTaskLog as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);

definePage({
    name: 'Website',
    meta: { icon: 'p-website', title: 'menu.website', permission: 'website_view' },
});
