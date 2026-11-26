import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import FireRouter from '@/pages/hosts/_components/firewall/index';
import DockerGuardStatus from '@/pages/hosts/_components/firewall/docker/status/index';
import DockerGuardDetail from '@/pages/hosts/_components/firewall/docker/detail/index';
import DockerGuardImport from '@/pages/hosts/_components/firewall/docker/import/index';
import RuleReset from '@/pages/hosts/_components/firewall/components/rule-reset';
import TaskLog from '@/components/log/task/index';
import RuleInitialize from '@/pages/hosts/_components/firewall/components/rule-initialize';
import { Firewall } from '@/types/firewall';
import { buildDockerPolicyExport } from '@/pages/hosts/_components/firewall/docker/transfer';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { getErrorMessage } from '@/utils/misc';
import { getHttpResponseMessage } from '@/api/http-core';
import { Lock } from '@element-plus/icons-vue';
import { downloadWithContent } from '@/utils/file';
import { getCurrentDateFormatted } from '@/utils/date';
import {
    dockerGuardEndpointKey,
    dockerGuardEndpointManagementMessage,
    dockerGuardEndpointStatusMessage,
    dockerGuardManagementTarget,
    isDockerGuardRuntimeEndpoint,
} from '@/pages/hosts/_components/firewall/docker/model';
import { formatHostAddressList } from '@/pages/hosts/_components/firewall/utils/validation';
import { newUUID } from '@/utils/id';
import { rpc } from '@/lib/rpc';
import '@/pages/hosts/_components/firewall/docker/index.styles.css';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import ComplexTable from '@/components/table/complex/ComplexTable';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'firewall.docker',
    props: {},
    emits: emits,
    __scopeId: 'data-v-1a7b7b03',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref(false);
        const detailRef = ref<InstanceType<typeof DockerGuardDetail>>();
        const importRef = ref<InstanceType<typeof DockerGuardImport>>();
        const cleanupConfirmRef = ref<InstanceType<typeof RuleReset>>();
        const taskLogRef = ref<InstanceType<typeof TaskLog>>();
        const openRuleTask = (taskID: string) => taskLogRef.value?.openWithTaskID(taskID, true);
        const orphanDrawerVisible = ref(false);
        const orphanSearchName = ref('');
        const searchName = ref('');
        useSearchState(
            'host/firewall/docker/index',
            { search: searchName },
            {
                onRevisit: () => {
                    paginationConfig.currentPage = 1;
                },
            },
        );
        const selects = ref<Firewall.DockerGuardContainer[]>([]);
        const orphanSelects = ref<Firewall.DockerGuardEndpoint[]>([]);
        const data = reactive<Firewall.DockerGuardList>({
            base: {
                name: 'iptables-docker',
                version: '-',
                isExist: true,
                initialized: false,
                bound: false,
                ipv4: { state: 'disabled', initialized: false, bound: false, effective: false },
                ipv6: { state: 'disabled', initialized: false, bound: false, effective: false },
                backend: '',
            },
            containers: [],
            orphanPolicies: [],
        });
        const allOrphanPolicies = computed(() => {
            const result = new Map<string, Firewall.DockerGuardEndpoint>();
            for (const endpoint of data.orphanPolicies || []) {
                result.set(endpoint.policyUUID, endpoint);
            }
            for (const container of data.containers || []) {
                if (container.key !== '__orphan__' && container.endpoints.some((endpoint) => endpoint.containerID))
                    continue;
                for (const endpoint of container.endpoints) {
                    if (!endpoint.policyUUID) continue;
                    result.set(endpoint.policyUUID, endpoint);
                }
            }
            return [...result.values()];
        });
        const containerRows = computed(() => {
            const keyword = searchName.value.trim().toLowerCase();

            return data.containers
                .filter((container) => container.key !== '__orphan__')
                .map((container) => {
                    const name = container.name || i18n.global.t('firewall.orphanEndpoints');
                    const runtimeEndpoints = container.endpoints.filter(isDockerGuardRuntimeEndpoint);
                    const containerMatches = [name, container.application, container.compose]
                        .filter(Boolean)
                        .some((item) => item!.toLowerCase().includes(keyword));
                    const endpointMatches = (endpoint: Firewall.DockerGuardEndpoint) => {
                        if (!keyword || containerMatches) return true;
                        return [
                            endpoint.family,
                            endpoint.hostIP,
                            endpoint.hostPort,
                            endpoint.containerPort,
                            endpoint.protocol,
                        ]
                            .filter((item) => item !== undefined)
                            .some((item) => String(item).toLowerCase().includes(keyword));
                    };
                    const portGroups = container.portGroups.flatMap((group) => {
                        const endpoints = group.endpoints.filter(isDockerGuardRuntimeEndpoint).filter(endpointMatches);
                        if (!endpoints.length) return [];
                        if (endpoints.length === group.endpoints.length) return [group];
                        return endpoints.map((endpoint) => ({
                            key: `${group.key}|${endpoint.hostPort}|${endpoint.containerPort || 0}`,
                            label: endpointLabel(endpoint),
                            endpoint,
                            endpoints: [endpoint],
                        }));
                    });
                    return {
                        ...container,
                        name,
                        endpoints: runtimeEndpoints.filter(endpointMatches),
                        portGroups,
                    };
                })
                .filter((container) => container.portGroups.length > 0);
        });
        const orphanRows = computed(() => {
            const keyword = orphanSearchName.value.trim().toLowerCase();
            return allOrphanPolicies.value.filter((endpoint) => {
                if (!keyword) return true;
                return [
                    endpoint.family,
                    endpoint.hostIP,
                    endpoint.hostPort,
                    endpoint.protocol,
                    endpoint.mode,
                    ...(endpoint.sources || []),
                ]
                    .filter((item) => item !== undefined)
                    .some((item) => String(item).toLowerCase().includes(keyword));
            });
        });
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: computed(() => containerRows.value.length),
        });
        const orphanPaginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: computed(() => orphanRows.value.length),
        });
        useSearchState('host/firewall/docker/pagination', { pageSize: toRef(paginationConfig, 'pageSize') });
        useSearchState('host/firewall/docker/orphan-pagination', {
            pageSize: toRef(orphanPaginationConfig, 'pageSize'),
        });
        const containerPageRows = computed(() => {
            const start = (paginationConfig.currentPage - 1) * paginationConfig.pageSize;
            return containerRows.value.slice(start, start + paginationConfig.pageSize);
        });
        const orphanPageRows = computed(() => {
            const start = (orphanPaginationConfig.currentPage - 1) * orphanPaginationConfig.pageSize;
            return orphanRows.value.slice(start, start + orphanPaginationConfig.pageSize);
        });
        watch(searchName, () => {
            paginationConfig.currentPage = 1;
        });
        watch(orphanSearchName, () => {
            orphanPaginationConfig.currentPage = 1;
        });
        watch([() => paginationConfig.total, () => orphanPaginationConfig.total], () => {
            for (const config of [paginationConfig, orphanPaginationConfig]) {
                config.currentPage = Math.min(
                    config.currentPage,
                    Math.max(1, Math.ceil(config.total / config.pageSize)),
                );
            }
        });
        const policies = computed<Firewall.DockerGuardPolicy[]>(() => {
            const result = new Map<string, Firewall.DockerGuardPolicy>();
            for (const container of data.containers) {
                for (const endpoint of container.endpoints) {
                    if (!endpoint.policyUUID || !endpoint.mode) continue;
                    const key = dockerGuardEndpointKey(endpoint);
                    result.set(key, {
                        family: endpoint.family,
                        hostIP: endpoint.hostIP,
                        hostPort: endpoint.hostPort,
                        protocol: endpoint.protocol,
                        mode: endpoint.mode,
                        sources: endpoint.sources || [],
                    });
                }
            }
            for (const endpoint of allOrphanPolicies.value) {
                if (!endpoint.policyUUID || !endpoint.mode) continue;
                result.set(dockerGuardEndpointKey(endpoint), {
                    family: endpoint.family,
                    hostIP: endpoint.hostIP,
                    hostPort: endpoint.hostPort,
                    protocol: endpoint.protocol,
                    mode: endpoint.mode,
                    sources: endpoint.sources || [],
                });
            }
            return [...result.values()];
        });
        const policyUUIDs = (endpoints: Firewall.DockerGuardEndpoint[]) => [
            ...new Set(endpoints.map((endpoint) => endpoint.policyUUID).filter(Boolean) as string[]),
        ];
        const selectedEndpoints = computed(() => selects.value.flatMap((container) => container.endpoints));
        const selectedPolicyUUIDs = computed(() => policyUUIDs(selectedEndpoints.value));
        const hasProtectedEndpoint = (container: Firewall.DockerGuardContainer) =>
            container.endpoints.some((endpoint) => Boolean(endpoint.policyUUID));
        const policiesFromEndpoints = (endpoints: Firewall.DockerGuardEndpoint[]) => {
            const result = new Map<string, Firewall.DockerGuardPolicy>();
            for (const endpoint of endpoints) {
                if (!endpoint.policyUUID || !endpoint.mode) continue;
                result.set(dockerGuardEndpointKey(endpoint), {
                    family: endpoint.family,
                    hostIP: endpoint.hostIP,
                    hostPort: endpoint.hostPort,
                    protocol: endpoint.protocol,
                    mode: endpoint.mode,
                    sources: endpoint.sources || [],
                });
            }
            return [...result.values()];
        };
        const endpointLabel = (endpoint: Firewall.DockerGuardEndpoint) => {
            const address = endpoint.hostIP.includes(':') ? `[${endpoint.hostIP}]` : endpoint.hostIP;
            return `${address}:${endpoint.hostPort}/${endpoint.protocol}`;
        };
        const displaySources = (endpoint: Firewall.DockerGuardEndpoint) =>
            formatHostAddressList(endpoint.sources, endpoint.family);
        const endpointStatusMessage = (endpoint: Firewall.DockerGuardEndpoint) =>
            dockerGuardEndpointStatusMessage(data.base, endpoint);
        const isDockerPolicyEndpoint = (endpoint: Firewall.DockerGuardEndpoint) => Boolean(endpoint.policyUUID);
        const endpointPrompt = (endpoint: Firewall.DockerGuardEndpoint) => {
            const target = dockerGuardManagementTarget(endpoint);
            if (target === 'host_firewall') return i18n.global.t('firewall.dockerInputUseHostFirewall');
            if (target === 'needs_diagnosis') return dockerGuardEndpointManagementMessage(endpoint);
            return i18n.global.t('firewall.dockerGuardUnprotected');
        };
        const search = async () => {
            loading.value = true;
            try {
                Object.assign(data, (await rpc.firewall.listDockerPorts({})) as any);
                if (data.base.message) MsgError(data.base.message);
                selects.value = [];
                orphanSelects.value = [];
            } finally {
                loading.value = false;
            }
        };
        const initializeRef = ref<InstanceType<typeof RuleInitialize>>();
        const initializeOnly = () => operate('initialize', true);
        const operate = async (operation: 'initialize' | 'bind' | 'unbind', confirmed = false) => {
            if (operation === 'initialize' && !confirmed) {
                await initializeRef.value?.acceptParams(
                    i18n.global.t('firewall.initMsg', [data.base.name]),
                    true,
                    'docker',
                );
                return;
            }
            if (operation === 'unbind') {
                try {
                    await ElMessageBox.confirm(
                        i18n.global.t('firewall.dockerGuardUnbindConfirm'),
                        i18n.global.t('commons.button.unbind'),
                        { type: 'warning' },
                    );
                } catch {
                    return;
                }
            }
            try {
                const result = await rpc.firewall.operateDocker({
                    operation,
                    taskId: operation === 'initialize' ? newUUID() : undefined,
                } as any);
                if (operation === 'initialize' && result.queued && result.taskId) {
                    taskLogRef.value?.openWithTaskID(result.taskId, true);
                    return;
                }
            } catch {
                await search();
                return;
            }
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            await search();
        };
        const cleanupBackend = () => {
            if (data.base.backend !== 'iptables' && data.base.backend !== 'nftables') return;
            cleanupConfirmRef.value?.acceptParams({
                message: i18n.global.t('firewall.cleanupDockerBackendHelper', [data.base.backend]),
                provider: data.base.backend,
            });
        };
        const submitCleanupBackend = async (backup: boolean) => {
            if (data.base.backend !== 'iptables' && data.base.backend !== 'nftables') return;
            loading.value = true;
            try {
                const result = await rpc.firewall.resetRules({
                    subsystem: 'docker',
                    provider: data.base.backend,
                    backup,
                });
                if (result.backupPath)
                    await ElMessageBox.alert(result.backupPath, i18n.global.t('commons.button.export'));
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                await search();
            } finally {
                loading.value = false;
            }
        };
        const openImport = () => {
            importRef.value?.acceptParams();
        };
        const exportPolicies = async (items: Firewall.DockerGuardPolicy[]) => {
            if (!items.length) return;
            try {
                await ElMessageBox.confirm(
                    i18n.global.t('firewall.exportHelper', [items.length]),
                    i18n.global.t('commons.button.export'),
                );
            } catch {
                return;
            }
            const exported = buildDockerPolicyExport(items);
            downloadWithContent(
                JSON.stringify(exported, null, 2),
                `1panel-docker-port-guard-${getCurrentDateFormatted()}.json`,
            );
        };
        const exportPoliciesBySelection = () => {
            return exportPolicies(
                selects.value.length > 0 ? policiesFromEndpoints(selectedEndpoints.value) : policies.value,
            );
        };
        const openPorts = (row: Firewall.DockerGuardContainer) => {
            detailRef.value?.acceptParams(row);
        };
        const removePolicies = async (endpoints: Firewall.DockerGuardEndpoint[], batch: boolean) => {
            const uuids = policyUUIDs(endpoints);
            if (!uuids.length) return;
            try {
                await ElMessageBox.confirm(
                    i18n.global.t(
                        batch ? 'firewall.clearDockerGuardPoliciesConfirm' : 'firewall.deleteDockerGuardPolicyConfirm',
                    ),
                    i18n.global.t('commons.button.delete'),
                    { type: 'warning' },
                );
            } catch {
                return;
            }
            loading.value = true;
            try {
                const result = await rpc.firewall.deleteDockerPolicies({ uuids });
                if (!result.taskId || !result.queued) {
                    MsgError(i18n.global.t('commons.msg.operationFailed'));
                    return;
                }
                openRuleTask(result.taskId);
            } catch (error) {
                MsgError(
                    getHttpResponseMessage(error) ||
                        (error && getErrorMessage(error)) ||
                        i18n.global.t('commons.res.commonError'),
                );
            } finally {
                loading.value = false;
            }
        };
        const removeSelectedPolicies = () => removePolicies(selectedEndpoints.value, true);
        const protectionModeLabel = (row: Firewall.DockerGuardEndpoint) => {
            if (!row.mode) return i18n.global.t('firewall.accept');
            if (row.mode === 'deny_sources') return i18n.global.t('firewall.denySources');
            if (row.mode === 'allow_sources') return i18n.global.t('firewall.allowSources');
            if (row.mode === 'accept_sources') return i18n.global.t('firewall.acceptSources');
            if (row.mode === 'accept_all') return i18n.global.t('firewall.acceptAll');
            return i18n.global.t('firewall.denyAll');
        };
        const endpointStatusType = (row: Firewall.DockerGuardEndpoint) => {
            if (row.effective) return 'success';
            return row.policyUUID ? 'warning' : 'info';
        };
        search();
        return () => (
            <div>
                <FireRouter />
                <DockerGuardStatus
                    base={data.base}
                    onOperate={($event?: any) => {
                        (operate as any)($event);
                    }}
                    onRefresh={($event?: any) => {
                        (search as any)($event);
                    }}
                    onCleanup={($event?: any) => {
                        (cleanupBackend as any)($event);
                    }}
                />
                {data.base.isExist && !data.base.message && !data.base.initialized ? (
                    <ElCard class={'mask-prompt'}>
                        <span>{$t('firewall.initHelper', [data.base.name])}</span>
                    </ElCard>
                ) : null}
                {data.base.isExist ? (
                    <LayoutContent
                        title={$t('firewall.dockerGuard')}
                        class={{ mask: !data.base.message && !data.base.initialized }}
                        v-slots={{
                            prompt: () => (
                                <>
                                    <ElAlert type="info" closable={false} title={$t('firewall.dockerGuardHelper')} />
                                </>
                            ),
                            leftToolBar: () => (
                                <>
                                    <ElButton
                                        plain
                                        onClick={($event?: any) => {
                                            orphanDrawerVisible.value = true;
                                        }}
                                    >
                                        {$t('firewall.orphanPolicies')}
                                        {' ('}
                                        {unref(allOrphanPolicies).length}
                                        {') '}
                                    </ElButton>
                                    {
                                        <ElButton
                                            disabled={unref(selectedPolicyUUIDs).length === 0}
                                            onClick={($event?: any) => {
                                                (removeSelectedPolicies as any)($event);
                                            }}
                                            v-permission={true}
                                            v-node-admin={true}
                                        >
                                            {$t('commons.button.delete')}
                                        </ElButton>
                                    }
                                    <ElButtonGroup>
                                        {
                                            <ElButton
                                                onClick={($event?: any) => {
                                                    (openImport as any)($event);
                                                }}
                                                v-permission={true}
                                                v-node-admin={true}
                                            >
                                                {$t('commons.button.import')}
                                            </ElButton>
                                        }
                                        {
                                            <ElButton
                                                disabled={unref(policies).length === 0}
                                                onClick={($event?: any) => {
                                                    (exportPoliciesBySelection as any)($event);
                                                }}
                                                v-permission={true}
                                                v-node-admin={true}
                                            >
                                                {$t('commons.button.export')}
                                            </ElButton>
                                        }
                                    </ElButtonGroup>
                                </>
                            ),
                            rightToolBar: () => (
                                <>
                                    <TableSearch
                                        searchName={unref(searchName)}
                                        onUpdate:searchName={($v) => {
                                            searchName.value = $v as any;
                                        }}
                                    />
                                    <TableRefresh
                                        onSearch={($event?: any) => {
                                            (search as any)($event);
                                        }}
                                    />
                                </>
                            ),
                            main: () => (
                                <>
                                    <ComplexTable
                                        selects={unref(selects)}
                                        onUpdate:selects={($v) => {
                                            selects.value = $v as any;
                                        }}
                                        data={unref(containerPageRows)}
                                        cache-pagination={false}
                                        pagination-config={paginationConfig}
                                        heightDiff={320}
                                        row-key="key"
                                    >
                                        <ElTableColumn
                                            type="selection"
                                            selectable={hasProtectedEndpoint}
                                            width="48"
                                            fix
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.name')}
                                            min-width="180"
                                            v-slots={{ default: ({ row }) => <>{row.name}</> }}
                                        />
                                        <ElTableColumn
                                            label={$t('firewall.composeOrApp')}
                                            min-width="160"
                                            v-slots={{
                                                default: ({ row }) => <>{row.application || row.compose || '-'}</>,
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.port')}
                                            min-width="400"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <div class={'flex flex-wrap items-center gap-2'}>
                                                            {(row.portGroups.slice(0, 5) || []).map((group) => (
                                                                <ElPopover
                                                                    placement="top"
                                                                    trigger="hover"
                                                                    width={360}
                                                                    show-after={200}
                                                                    persistent={false}
                                                                    key={group.key}
                                                                    v-slots={{
                                                                        reference: () => (
                                                                            <>
                                                                                <ElTag
                                                                                    type={endpointStatusType(
                                                                                        group.endpoint,
                                                                                    )}
                                                                                    effect="plain"
                                                                                >
                                                                                    {isDockerPolicyEndpoint(
                                                                                        group.endpoint,
                                                                                    ) ? (
                                                                                        <span
                                                                                            class={
                                                                                                'docker-guard-protected-label'
                                                                                            }
                                                                                        >
                                                                                            <ElIcon>
                                                                                                <Lock />
                                                                                            </ElIcon>
                                                                                            <span>{group.label}</span>
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span>{group.label}</span>
                                                                                    )}
                                                                                </ElTag>
                                                                            </>
                                                                        ),
                                                                    }}
                                                                >
                                                                    {!isDockerPolicyEndpoint(group.endpoint) ? (
                                                                        <span>{endpointPrompt(group.endpoint)}</span>
                                                                    ) : (
                                                                        <ElDescriptions
                                                                            column={1}
                                                                            border
                                                                            size="small"
                                                                            class={'docker-guard-descriptions'}
                                                                        >
                                                                            <ElDescriptionsItem
                                                                                label={$t('firewall.protectionMode')}
                                                                            >
                                                                                {protectionModeLabel(group.endpoint)}
                                                                            </ElDescriptionsItem>
                                                                            {group.endpoint.mode !== 'deny_all' &&
                                                                            group.endpoint.sources.length ? (
                                                                                <ElDescriptionsItem
                                                                                    label={$t('firewall.sources')}
                                                                                >
                                                                                    {displaySources(group.endpoint)}
                                                                                </ElDescriptionsItem>
                                                                            ) : null}
                                                                            <ElDescriptionsItem
                                                                                label={$t('commons.table.status')}
                                                                            >
                                                                                <div>
                                                                                    {$t(
                                                                                        group.endpoint.effective
                                                                                            ? 'firewall.effective'
                                                                                            : 'firewall.notEffective',
                                                                                    )}
                                                                                    {!group.endpoint.effective ? (
                                                                                        <div
                                                                                            class={
                                                                                                'docker-guard-status-message'
                                                                                            }
                                                                                        >
                                                                                            {endpointStatusMessage(
                                                                                                group.endpoint,
                                                                                            )}
                                                                                        </div>
                                                                                    ) : null}
                                                                                </div>
                                                                            </ElDescriptionsItem>
                                                                        </ElDescriptions>
                                                                    )}
                                                                </ElPopover>
                                                            ))}
                                                            {row.portGroups.length > 5 ? (
                                                                <ElButton
                                                                    plain
                                                                    size="small"
                                                                    onClick={($event?: any) => {
                                                                        openPorts(row);
                                                                    }}
                                                                >
                                                                    {' +'}
                                                                    {row.portGroups.length - 5}
                                                                </ElButton>
                                                            ) : null}
                                                        </div>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.operate')}
                                            width="100"
                                            fixed="right"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            onClick={($event?: any) => {
                                                                openPorts(row);
                                                            }}
                                                        >
                                                            {$t('commons.button.view')}
                                                        </ElButton>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </ComplexTable>
                                </>
                            ),
                        }}
                        v-loading={unref(loading)}
                    />
                ) : null}
                <DrawerPro
                    v-model={orphanDrawerVisible.value}
                    header={$t('firewall.orphanPolicies')}
                    size="large"
                    onClose={($event?: any) => {
                        orphanSelects.value = [];
                    }}
                    v-slots={{
                        content: () => (
                            <>
                                <ElAlert
                                    type="info"
                                    closable={false}
                                    show-icon
                                    title={$t('firewall.orphanPoliciesHelper', [unref(allOrphanPolicies).length])}
                                />
                                <div class={'mt-3 flex flex-wrap items-center justify-between gap-2'}>
                                    {
                                        <ElButton
                                            disabled={unref(loading) || unref(orphanSelects).length === 0}
                                            onClick={($event?: any) => {
                                                removePolicies(unref(orphanSelects), true);
                                            }}
                                            v-permission={true}
                                            v-node-admin={true}
                                        >
                                            {$t('commons.button.delete')}
                                        </ElButton>
                                    }
                                    <div class={'flex items-center gap-2'}>
                                        <TableSearch
                                            searchName={unref(orphanSearchName)}
                                            onUpdate:searchName={($v) => {
                                                orphanSearchName.value = $v as any;
                                            }}
                                        />
                                        <TableRefresh
                                            onSearch={($event?: any) => {
                                                (search as any)($event);
                                            }}
                                        />
                                    </div>
                                </div>
                                {
                                    <ComplexTable
                                        selects={unref(orphanSelects)}
                                        onUpdate:selects={($v) => {
                                            orphanSelects.value = $v as any;
                                        }}
                                        data={unref(orphanPageRows)}
                                        cache-pagination={false}
                                        pagination-config={orphanPaginationConfig}
                                        row-key="policyUUID"
                                        max-height="calc(100vh - 220px)"
                                        class={'mt-3'}
                                        v-loading={unref(loading)}
                                    >
                                        <ElTableColumn type="selection" width="48" />
                                        <ElTableColumn
                                            label={$t('commons.table.port')}
                                            min-width="190"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <span>{endpointLabel(row)}</span>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('firewall.protectionMode')}
                                            min-width="150"
                                            v-slots={{ default: ({ row }) => <>{protectionModeLabel(row)}</> }}
                                        />
                                        <ElTableColumn
                                            label={$t('firewall.sources')}
                                            min-width="200"
                                            show-overflow-tooltip
                                            v-slots={{ default: ({ row }) => <>{displaySources(row) || '-'}</> }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.operate')}
                                            width="80"
                                            fixed="right"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {
                                                            <ElButton
                                                                type="primary"
                                                                link
                                                                disabled={unref(loading)}
                                                                onClick={($event?: any) => {
                                                                    removePolicies([row], false);
                                                                }}
                                                                v-permission={true}
                                                                v-node-admin={true}
                                                            >
                                                                {$t('commons.button.delete')}
                                                            </ElButton>
                                                        }
                                                    </>
                                                ),
                                            }}
                                        />
                                    </ComplexTable>
                                }
                            </>
                        ),
                    }}
                />
                <DockerGuardDetail
                    ref={detailRef}
                    base={data.base}
                    containers={unref(containerRows)}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    onCreated={($event?: any) => {
                        (openRuleTask as any)($event);
                    }}
                />
                <DockerGuardImport
                    ref={importRef}
                    onCreated={($event?: any) => {
                        (openRuleTask as any)($event);
                    }}
                />
                <RuleReset
                    ref={cleanupConfirmRef}
                    onConfirm={($event?: any) => {
                        (submitCleanupBackend as any)($event);
                    }}
                />
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <RuleInitialize
                    ref={initializeRef}
                    onInitialize={($event?: any) => {
                        (initializeOnly as any)($event);
                    }}
                    onComplete={($event?: any) => {
                        (search as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);

definePage({
    name: 'FirewallDockerGuard',
    meta: {
        activeMenu: '/hosts/firewall/rules',
        parent: 'menu.firewall',
        title: 'firewall.dockerGuard',
        permission: 'host_firewall_view',
        hidden: true,
    },
});
