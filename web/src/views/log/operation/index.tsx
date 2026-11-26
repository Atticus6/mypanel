import { $t } from '@/utils/i18n-t';
import { TABLE_TOOLTIP_OPTIONS } from '@/components/table/shared';
import { useSearchState } from '@/utils/search-reset';
import ConfirmDialog from '@/components/confirm-dialog/index';
import LogRouter from '@/views/log/router/index';
import { dateFormat } from '@/utils/date';
import { toRef, onMounted, reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { listNodes } from '@/utils/node';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElButton } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElTooltip } from 'element-plus';
import { ElText } from 'element-plus';
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
    name: 'operation',
    props: {},
    emits: emits,
    __scopeId: 'data-v-6a2703d1',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const data = ref();
        const confirmDialogRef = ref();
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        const searchName = ref<string>('');
        useSearchState(
            'log/operation/index',
            {
                search: searchName,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const searchGroup = ref<string>('');
        const searchStatus = ref<string>('');
        const searchNode = ref<string>('');
        const nodes = ref();
        const { globalStore, currentNode, isAdmin, isXpackOrEE, language } = useGlobalStore();
        const search = async () => {
            let params = {
                operation: searchName.value,
                page: paginationConfig.currentPage,
                pageSize: paginationConfig.pageSize,
                status: searchStatus.value,
                source: searchGroup.value,
                node: searchNode.value,
            };
            loading.value = true;
            await rpc.core.log
                .searchOperationLogs(params)
                .then((res) => {
                    loading.value = false;
                    data.value = (res.items || []) as any;
                    for (const item of data.value) {
                        item.detailZH = loadDetail(item.detailZH);
                        item.detailEN = loadDetail(item.detailEN);
                    }
                    paginationConfig.total = Number(res.total);
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const loadNodeName = (node: string) => {
            if (node === 'local') {
                return globalStore.getMasterAlias();
            }
            return node;
        };
        const onClean = async () => {
            let params = {
                header: i18n.global.t('logs.deleteLogs'),
                operationInfo: i18n.global.t('commons.msg.delete'),
                submitInputInfo: i18n.global.t('logs.deleteLogs'),
            };
            confirmDialogRef.value!.acceptParams(params);
        };
        const loadDetail = (log: string) => {
            return log.replace(/\[([^\]]+)\]/g, (matched, token: string) => {
                const transKey = resolveReplacementKey(token);
                if (!transKey) {
                    return matched;
                }
                return '[' + i18n.global.t(transKey) + ']';
            });
        };
        const loadNodes = async () => {
            await listNodes('all')
                .then((res) => {
                    nodes.value = res || [];
                })
                .catch(() => {
                    nodes.value = [];
                });
        };
        const normalizedReplacements: Record<string, string> = {
            enable: 'commons.button.enable',
            disable: 'commons.button.disable',
            start: 'commons.button.start',
            stop: 'commons.button.stop',
            restart: 'commons.button.restart',
            reload: 'commons.operate.reload',
            sync: 'commons.button.sync',
            update: 'commons.button.update',
            upgrade: 'commons.button.upgrade',
            open: 'commons.button.open',
            close: 'commons.button.close',
            up: 'commons.button.up',
            down: 'commons.button.down',
            login: 'commons.button.login',
            delete: 'commons.button.delete',
            create: 'commons.button.create',
            add: 'commons.button.add',
            edit: 'commons.button.edit',
            save: 'commons.button.save',
            clean: 'commons.button.clean',
            clear: 'commons.button.clean',
            get: 'commons.button.get',
            install: 'commons.button.install',
            uninstall: 'commons.button.uninstall',
            backup: 'commons.button.backup',
            recover: 'commons.button.recover',
            upload: 'commons.button.upload',
            download: 'commons.button.download',
            bind: 'commons.button.bind',
            unbind: 'commons.button.unbind',
            verify: 'commons.button.verify',
            rebuild: 'commons.operate.rebuild',
            remove: 'commons.msg.remove',
            kill: 'container.kill',
            pause: 'container.pause',
            unpause: 'container.unpause',
            allow: 'firewall.allow',
            deny: 'firewall.deny',
            accept: 'firewall.accept',
            drop: 'firewall.drop',
            reject: 'firewall.stop',
            running: 'commons.status.running',
            stopped: 'commons.status.stopped',
            success: 'commons.status.success',
            failed: 'commons.status.failed',
            created: 'commons.status.created',
            restarting: 'commons.status.restarting',
            paused: 'commons.status.paused',
            exited: 'commons.status.exited',
            dead: 'commons.status.dead',
            light: 'setting.light',
            dark: 'setting.dark',
            darkgold: 'setting.darkGold',
            auto: 'setting.auto',
            cn: 'setting.cn',
            intl: 'setting.intl',
            status: 'commons.table.status',
            all: 'commons.table.all',
            operate: 'commons.table.operate',
            true: 'commons.true',
            false: 'commons.false',
        };
        const exactReplacements: Record<string, string> = {
            disableBanPing: 'firewall.disableBanPing',
            enableBanPing: 'firewall.enableBanPing',
            UserName: 'commons.login.username',
            PanelName: 'setting.title',
            Language: 'setting.language',
            Theme: 'setting.theme',
            MenuTabs: 'setting.menuTabs',
            MenuAccordion: 'setting.menuAccordion',
            SessionTimeout: 'setting.sessionTimeout',
            SecurityEntrance: 'setting.entrance',
            ExpirationDays: 'setting.expirationTime',
            OpsReportExportFormat: 'xpack.opsReport.page.defaultFormat',
            OpsReportSchedule: 'xpack.opsReport.page.generationRule',
            OpsReportSavePath: 'xpack.opsReport.page.savePath',
            OpsReportThreshold: 'xpack.opsReport.page.threshold',
            OpsReportAutoExport: 'xpack.opsReport.page.autoExport',
            ComplexityVerification: 'setting.complexity',
            MFAStatus: 'setting.mfa',
            GPUMonitorStatus: 'monitor.enableMonitor',
            GPUMonitorStoreDays: 'monitor.storeDays',
            GPUMonitorInterval: 'monitor.interval',
            VLLMMonitorStatus: 'monitor.enableMonitor',
            VLLMMonitorStoreDays: 'monitor.storeDays',
            VLLMMonitorInterval: 'monitor.interval',
            MonitorInterval: 'monitor.interval',
            MonitorStatus: 'monitor.enableMonitor',
            MonitorStoreDays: 'monitor.storeDays',
            ApiInterfaceStatus: 'setting.apiInterface',
            ComponentSize: 'setting.componentSize',
            Region: 'setting.region',
            SystemIP: 'setting.systemIP',
            ProxyType: 'setting.proxyType',
            ProxyUrl: 'setting.proxyUrl',
            ProxyPort: 'setting.proxyPort',
            ProxyPasswdKeep: 'setting.proxyPasswdKeep',
            ProxyDocker: 'setting.proxyDocker',
            SyncToNode: 'setting.syncToNode',
            IPWhiteList: 'setting.ipWhiteList',
            ApiKeyValidityTime: 'setting.apiKeyValidityTime',
            DeveloperMode: 'setting.developerMode',
        };
        const resolveReplacementKey = (token: string): string | undefined => {
            if (exactReplacements[token]) {
                return exactReplacements[token];
            }
            return normalizedReplacements[token.toLowerCase()];
        };
        const onSubmitClean = async () => {
            await rpc.core.log.cleanLogs({ logType: 'operation' });
            search();
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
        };
        onMounted(() => {
            if (isAdmin.value && isXpackOrEE.value) {
                loadNodes();
            }
            searchNode.value = isAdmin.value ? '' : currentNode.value;
            search();
        });
        return () => (
            <div>
                {withDirectives(
                    <LayoutContent
                        title={$t('logs.operation')}
                        v-slots={{
                            search: () => (
                                <>
                                    <LogRouter current="OperationLog" />
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
                                        modelValue={unref(searchGroup)}
                                        onUpdate:modelValue={($v) => {
                                            searchGroup.value = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            search();
                                        }}
                                        clearable
                                        filterable
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('logs.resource')}</> }}
                                    >
                                        <ElOption label={$t('commons.table.all')} value />
                                        <ElOption label={$t('logs.detail.dashboard')} value="dashboard" />
                                        <ElOption label={$t('logs.detail.apps')} value="apps" />
                                        <ElOption label={$t('xpack.customApp.name')} value="custom" />
                                        <ElOption label={$t('logs.detail.openresty')} value="openresty" />
                                        <ElOption label={$t('logs.detail.websites')} value="websites" />
                                        <ElOption label={$t('logs.detail.monitor')} value="monitor" />
                                        <ElOption label={$t('logs.detail.runtimes')} value="runtimes" />
                                        <ElOption label={$t('logs.detail.ai')} value="ai" />
                                        <ElOption label={$t('aiTools.agents.agent')} value="agents" />
                                        <ElOption label={$t('aiTools.model.downloader')} value="model" />
                                        <ElOption label="vLLM" value="vllm" />
                                        <ElOption label={$t('logs.detail.ai_proxy')} value="ai-proxy" />
                                        <ElOption label={$t('logs.detail.ai_benchmark')} value="ai-benchmark" />
                                        <ElOption label={$t('logs.detail.skills_hub')} value="skills-hub" />
                                        <ElOption label={$t('logs.detail.databases')} value="databases" />
                                        <ElOption label={$t('xpack.cluster.cluster')} value="cluster" />
                                        <ElOption label={$t('logs.detail.containers')} value="containers" />
                                        <ElOption label={$t('logs.detail.vms')} value="vms" />
                                        <ElOption label={$t('menu.system')} value="hosts" />
                                        <ElOption label={$t('logs.detail.files')} value="files" />
                                        <ElOption label={$t('logs.detail.cronjobs')} value="cronjobs" />
                                        <ElOption label={$t('cronjob.library.library')} value="script" />
                                        <ElOption label={$t('logs.detail.toolbox')} value="toolbox" />
                                        <ElOption label={$t('logs.detail.process')} value="process" />
                                        <ElOption label="WAF" value="waf" />
                                        <ElOption label={$t('logs.detail.nodes')} value="nodes" />
                                        <ElOption label={$t('logs.detail.sync')} value="sync" />
                                        <ElOption label={$t('logs.detail.exchange')} value="exchange" />
                                        <ElOption label={$t('logs.detail.tampers')} value="tampers" />
                                        <ElOption label={$t('logs.detail.xsetting')} value="xsetting" />
                                        <ElOption label={$t('logs.detail.licenses')} value="licenses" />
                                        <ElOption label={$t('logs.detail.logs')} value="logs" />
                                        <ElOption label={$t('logs.detail.settings')} value="settings" />
                                        <ElOption label={$t('logs.detail.xapp')} value="xapp" />
                                        <ElOption label={$t('logs.detail.ops_report')} value="ops-report" />
                                        <ElOption label={$t('logs.detail.alert')} value="alert" />
                                        <ElOption label={$t('logs.detail.backups')} value="backups" />
                                        <ElOption label={$t('logs.detail.groups')} value="groups" />
                                        <ElOption label={$t('logs.detail.users')} value="users" />
                                        <ElOption label={$t('logs.detail.roles')} value="roles" />
                                        <ElOption label={$t('logs.detail.auth')} value="auth" />
                                        <ElOption label={$t('logs.detail.auth_sources')} value="auth-sources" />
                                        <ElOption label={$t('logs.detail.commands')} value="commands" />
                                    </ElSelect>
                                    <ElSelect
                                        modelValue={unref(searchStatus)}
                                        onUpdate:modelValue={($v) => {
                                            searchStatus.value = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            search();
                                        }}
                                        clearable
                                        filterable
                                        class={'p-w-200'}
                                        v-slots={{ prefix: () => <>{$t('commons.table.status')}</> }}
                                    >
                                        <ElOption label={$t('commons.table.all')} value />
                                        <ElOption label={$t('commons.status.success')} value="Success" />
                                        <ElOption label={$t('commons.status.failed')} value="Failed" />
                                    </ElSelect>
                                    {unref(isAdmin) ? (
                                        <ElSelect
                                            modelValue={unref(searchNode)}
                                            onUpdate:modelValue={($v) => {
                                                searchNode.value = $v as any;
                                            }}
                                            onChange={($event?: any) => {
                                                search();
                                            }}
                                            clearable
                                            filterable
                                            class={'p-w-200'}
                                            v-slots={{ prefix: () => <>{$t('xpack.node.node')}</> }}
                                        >
                                            <ElOption label={$t('commons.table.all')} value />
                                            {(unref(nodes) || []).map((node, index) => (
                                                <ElOption
                                                    label={loadNodeName(node.name)}
                                                    value={node.name}
                                                    key={index}
                                                />
                                            ))}
                                        </ElSelect>
                                    ) : null}
                                    <TableSearch
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                        searchName={unref(searchName)}
                                        onUpdate:searchName={($v) => {
                                            searchName.value = $v as any;
                                        }}
                                    />
                                    <TableRefresh
                                        onSearch={($event?: any) => {
                                            search();
                                        }}
                                    />
                                    <TableSetting
                                        title="operation-log-refresh"
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
                                            label={$t('logs.resource')}
                                            prop="group"
                                            fix
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.source && row.source.indexOf('-') === -1 ? (
                                                            <span>{$t('logs.detail.' + row.source)}</span>
                                                        ) : (
                                                            <span>
                                                                {$t('logs.detail.' + row.source.replace('-', '_'))}
                                                            </span>
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.user')}
                                            prop="user"
                                            min-width="140"
                                            show-overflow-tooltip
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <div>{row.user}</div>
                                                        {row.authMethod === 'api_key' && row.apiKeyID ? (
                                                            <ElTooltip
                                                                content={row.apiKeyID}
                                                                {...TABLE_TOOLTIP_OPTIONS}
                                                            >
                                                                <ElText type="info" size="small">
                                                                    {' API Key · '}
                                                                    {row.apiKeyName || row.apiKeyID}
                                                                </ElText>
                                                            </ElTooltip>
                                                        ) : null}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.operate')}
                                            min-width="150px"
                                            prop="detailZH"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {unref(language) === 'zh' || unref(language) === 'zh-Hant' ? (
                                                            <span>{row.detailZH}</span>
                                                        ) : null}
                                                        {unref(language) === 'en' ? <span>{row.detailEN}</span> : null}
                                                    </>
                                                ),
                                            }}
                                        />
                                        {unref(isXpackOrEE) ? (
                                            <ElTableColumn
                                                label={$t('xpack.node.node')}
                                                prop="node"
                                                v-slots={{
                                                    default: ({ row }) => (
                                                        <>
                                                            <span>{loadNodeName(row.node)}</span>
                                                        </>
                                                    ),
                                                }}
                                            />
                                        ) : null}
                                        <ElTableColumn
                                            label={$t('commons.table.status')}
                                            prop="status"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <Status status={row.status} msg={row.message} />
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
