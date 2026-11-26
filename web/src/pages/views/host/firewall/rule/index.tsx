import { $t } from '@/utils/i18n-t';
import { useSearchState } from '@/utils/search-reset';
import { Firewall } from '@/types/firewall';
import { TABLE_TOOLTIP_OPTIONS, type FuTableOperationButton } from '@/components/table/shared';
import { buildHostRuleExport } from './transfer';
interface ListeningProcess {
    pid?: number;
    ports?: number[];
    protocol?: number;
    name?: string;
    PID?: number;
    Port?: Record<string, unknown>;
    Protocol?: number;
    Name?: string;
}
import i18n from '@/lang';
import { getCurrentDateFormatted } from '@/utils/date';
import { downloadWithContent } from '@/utils/file';
import { MsgError, MsgInfo, MsgSuccess } from '@/utils/message';
import {
    dockerGuardEndpointManagementMessage,
    dockerGuardManagementTarget,
} from '@/pages/views/host/firewall/docker/model';
import { formatHostAddress } from '@/pages/views/host/firewall/utils/validation';
import RuleImport from '@/pages/views/host/firewall/rule/import/index';
import RuleOperate from '@/pages/views/host/firewall/rule/operate/index';
import FireRouter from '@/pages/views/host/firewall/index';
import FireStatus from '@/pages/views/host/firewall/status/index';
import ProcessDetail from '@/pages/views/host/process/process/detail/index';
import RuleReset from '@/pages/views/host/firewall/components/rule-reset';
import TaskLog from '@/components/log/task/index';
import DockerRestart from '@/components/docker-proxy/docker-restart';
import { useElementSize } from '@/composables/useElementSize';
import { Expand, Loading, Lock, Refresh } from '@element-plus/icons-vue';
import { rpc } from '@/lib/rpc';
interface RuleRow extends Firewall.InventoryItem {
    rowKey: string;
}
interface UsageEntry {
    key: string;
    ports: number[];
    owner: string;
    pid?: number;
    docker?: boolean;
    dockerManagementTarget?: Firewall.DockerGuardEndpoint['managementTarget'];
    dockerEndpoint?: Firewall.DockerGuardEndpoint;
}
interface DisplayNotice {
    key: string;
    text: string;
}
type RuleFilter = 'family:ipv4' | 'family:ipv6' | 'action:accept' | 'action:deny';
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import { cn } from '@/utils/cn';
import LayoutContent from '@/components/layout-content/index';
import TableSearch from '@/components/table/TableSearch';
import TableRefresh from '@/components/table/TableRefresh';
import TableSetting from '@/components/table/TableSetting';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'rule',
    props: {},
    emits: emits,
    __scopeId: 'data-v-55fc9dc6',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const ruleFilterStorageKey = 'firewall-rule-filters';
        const ruleFilterOptions: RuleFilter[] = ['family:ipv4', 'family:ipv6', 'action:accept', 'action:deny'];
        const loadCachedFilterValues = <T extends string>(
            key: string,
            allowed: readonly T[],
            defaults: readonly T[],
        ): T[] => {
            try {
                const cached = JSON.parse(localStorage.getItem(key) || 'null');
                if (!Array.isArray(cached)) return [...defaults];
                return cached.filter((item): item is T => typeof item === 'string' && allowed.includes(item as T));
            } catch {
                return [...defaults];
            }
        };
        const cacheFilterValues = (key: string, values: readonly string[]) => {
            localStorage.setItem(key, JSON.stringify(values));
        };
        const fireStatusRef = ref<InstanceType<typeof FireStatus>>();
        const noticeRef = ref<HTMLElement>();
        const { height: noticeHeight } = useElementSize(noticeRef);
        const ruleOperateRef = ref<InstanceType<typeof RuleOperate>>();
        const ruleImportRef = ref<InstanceType<typeof RuleImport>>();
        const ruleTaskLogRef = ref<InstanceType<typeof TaskLog>>();
        const openRuleTask = (taskID: string) => ruleTaskLogRef.value?.openWithTaskID(taskID, true);
        const processDetailRef = ref<InstanceType<typeof ProcessDetail>>();
        const resetConfirmRef = ref<InstanceType<typeof RuleReset>>();
        const dockerRestartRef = ref<InstanceType<typeof DockerRestart>>();
        const withDockerRestart = ref(false);
        const loading = ref(false);
        const resetting = ref(false);
        const backupBeforeReset = ref(true);
        const isActive = ref(false);
        const isInit = ref(false);
        const isBind = ref(false);
        const provider = ref('');
        const isDirectBackend = computed(() => provider.value === 'iptables' || provider.value === 'nftables');
        const isServiceBackend = computed(() => provider.value === 'firewalld' || provider.value === 'ufw');
        const canReset = computed(
            () =>
                ['iptables', 'nftables', 'firewalld', 'ufw'].includes(provider.value) &&
                (isDirectBackend.value ? isInit.value : true),
        );
        const isFirewallReady = computed(() => (isDirectBackend.value ? isInit.value && isBind.value : isActive.value));
        const showFirewallUnavailablePrompt = computed(
            () =>
                (isDirectBackend.value && (!isInit.value || !isBind.value)) ||
                (isServiceBackend.value && !isActive.value),
        );
        const firewallVersion = ref('');
        const selectedRuleFilters = ref<RuleFilter[]>(
            loadCachedFilterValues(ruleFilterStorageKey, ruleFilterOptions, []),
        );
        const searchName = ref('');
        const inventoryItems = ref<Firewall.InventoryItem[]>([]);
        const positionRanges = ref<Partial<Record<Firewall.Family, Firewall.PositionRange>>>({});
        const inventoryTotal = ref(0);
        const listeningProcesses = ref<ListeningProcess[]>([]);
        const dockerEndpoints = ref<Firewall.DockerGuardEndpoint[]>([]);
        const usageLoading = ref(false);
        const usageFailed = ref(false);
        let searchRequestID = 0;
        let usageRequestID = 0;
        let usageLoadedAt = 0;
        const selects = ref<RuleRow[]>([]);
        const scopeNotices = ref<Firewall.ScopeNotice[]>([]);
        const supportsFirewalldPriority = computed(() => {
            if (provider.value !== 'firewalld') return true;
            const match = firewallVersion.value.trim().match(/^(\d+)\.(\d+)/);
            if (!match) return false;
            const major = Number(match[1]);
            const minor = Number(match[2]);
            return major > 0 || minor >= 7;
        });
        const paginationConfig = reactive({
            currentPage: 1,
            pageSize: 20,
            total: 0,
        });
        useSearchState(
            'host/firewall/rule/index',
            {
                search: searchName,
                page: toRef(paginationConfig, 'currentPage'),
                pageSize: toRef(paginationConfig, 'pageSize'),
            },
            { onRevisit: () => search() },
        );
        const providerScopes = (): Firewall.Scope[] => {
            if (provider.value === 'iptables' || provider.value === 'nftables') {
                return (['ipv4', 'ipv6'] as Firewall.Family[]).flatMap((family) =>
                    ['1PANEL_BASIC_BEFORE', '1PANEL_BASIC', '1PANEL_BASIC_AFTER'].map((chain) => ({
                        provider: provider.value as 'iptables' | 'nftables',
                        family,
                        table: 'filter',
                        chain,
                        direction: 'input' as const,
                    })),
                );
            }
            if (provider.value === 'firewalld') {
                return [{ provider: 'firewalld', family: 'inet', zone: 'public', direction: 'input' }];
            }
            if (provider.value === 'ufw') {
                return [
                    {
                        provider: 'ufw' as const,
                        family: 'inet',
                        chain: 'incoming',
                        direction: 'input' as const,
                    },
                ];
            }
            return [];
        };
        const inventoryFilters = () => ({
            families: selectedRuleFilters.value
                .filter((filter) => filter.startsWith('family:'))
                .map((filter) => filter.slice('family:'.length) as 'ipv4' | 'ipv6'),
            actions: selectedRuleFilters.value
                .filter((filter) => filter.startsWith('action:'))
                .map((filter) => filter.slice('action:'.length) as 'accept' | 'deny'),
        });
        const inventoryRequest = (page = paginationConfig.currentPage, pageSize = paginationConfig.pageSize) => ({
            scopes: providerScopes(),
            info: searchName.value,
            page,
            pageSize,
            ...inventoryFilters(),
        });
        const search = async () => {
            const requestID = ++searchRequestID;
            if (!isFirewallReady.value) {
                clearUsage();
                loading.value = false;
                inventoryItems.value = [];
                positionRanges.value = {};
                scopeNotices.value = [];
                paginationConfig.total = 0;
                inventoryTotal.value = 0;
                return;
            }

            const scopes = providerScopes();
            if (scopes.length === 0) {
                clearUsage();
                loading.value = false;
                inventoryItems.value = [];
                positionRanges.value = {};
                scopeNotices.value = [];
                paginationConfig.total = 0;
                inventoryTotal.value = 0;
                return;
            }

            loading.value = true;
            try {
                const response = await rpc.firewall.inventory(inventoryRequest());
                if (requestID !== searchRequestID) return;
                const total = Number(response.total) || 0;
                const lastPage = Math.max(1, Math.ceil(total / paginationConfig.pageSize));
                if (paginationConfig.currentPage > lastPage) {
                    paginationConfig.currentPage = lastPage;
                    await search();
                    return;
                }
                inventoryItems.value = response.items as unknown as Firewall.InventoryItem[];
                positionRanges.value = {
                    ipv4: response.ipv4Range as unknown as Firewall.PositionRange,
                    ipv6: response.ipv6Range as unknown as Firewall.PositionRange,
                    inet: response.ipv4Range as unknown as Firewall.PositionRange,
                };
                scopeNotices.value = response.notices as unknown as Firewall.ScopeNotice[];
                paginationConfig.total = total;
                inventoryTotal.value = Number(response.allTotal) || 0;
                selects.value = [];
                if (
                    inventoryItems.value.some(
                        (row) => !hasIncompleteParsing(row) && listeningProtocolNumbers(row.rule.protocol).length > 0,
                    ) &&
                    Date.now() - usageLoadedAt >= 30_000
                ) {
                    refreshUsage();
                }
            } finally {
                if (requestID === searchRequestID) loading.value = false;
            }
        };
        const wildcardAddress = (family: Firewall.Family) => {
            if (family === 'ipv6') return '::/0';
            if (family === 'inet') return '0.0.0.0/0, ::/0';
            return '0.0.0.0/0';
        };
        const isOpaqueRule = (row: Firewall.InventoryItem) => row.observed?.parseStatus === 'opaque';
        const hasIncompleteParsing = (row: Firewall.InventoryItem) =>
            Boolean(row.observed) && row.observed?.parseStatus !== 'supported';
        const rowProvider = (row: Firewall.InventoryItem) => row.rule.scope.provider || row.observed?.locator.provider;
        const rowNativeKind = (row: Firewall.InventoryItem) => row.rule.nativeKind || row.observed?.rule.nativeKind;
        const isFirewalldService = (row: Firewall.InventoryItem) => {
            const canonical = row.observed?.locator.canonical || row.observed?.locator.nativeId || '';
            return (
                rowProvider(row) === 'firewalld' &&
                (rowNativeKind(row) === 'zone_service' || canonical.startsWith('service:'))
            );
        };
        const isUFWApplication = (row: Firewall.InventoryItem) =>
            rowProvider(row) === 'ufw' && rowNativeKind(row) === 'ufw_application';
        const hasParsedUFWFields = (row: Firewall.InventoryItem) =>
            rowProvider(row) === 'ufw' && Boolean(row.rule.protocol);
        const firewalldServiceName = (row: Firewall.InventoryItem) => {
            const description = row.observed?.rule.description?.trim();
            if (description) return description;
            const canonical = row.observed?.locator.canonical || row.observed?.locator.nativeId || '';
            if (canonical.startsWith('service:')) return canonical.slice('service:'.length).trim();
            return row.observed?.raw?.trim().split(/\r?\n/, 1)[0]?.trim() || '';
        };
        const ufwApplicationName = (row: Firewall.InventoryItem) => {
            const description = row.observed?.rule.description?.trim();
            if (description) return description;
            const raw = row.observed?.raw || '';
            return (
                raw.match(/^\s*\[\s*\d+\]\s+(.+?)\s+(?:ALLOW|DENY|REJECT)(?:\s+(?:IN|OUT|FWD))?\s+/)?.[1]?.trim() || ''
            );
        };
        const nativeDetailTarget = (row: Firewall.InventoryItem): Firewall.NativeDetailRequest | undefined => {
            if (isFirewalldService(row)) {
                const name = firewalldServiceName(row);
                if (!name) return undefined;
                return {
                    provider: 'firewalld',
                    nativeKind: 'zone_service',
                    name,
                    permanent: row.observed?.persistence === 'permanent_only',
                };
            }
            if (isUFWApplication(row)) {
                const name = ufwApplicationName(row);
                if (!name) return undefined;
                return { provider: 'ufw', nativeKind: 'ufw_application', name, permanent: false };
            }
        };
        const displayProtocol = (row: Firewall.InventoryItem) => {
            if (isFirewalldService(row)) return 'SERVICE';
            if (isUFWApplication(row) && !row.rule.protocol) return 'APP';
            if (isOpaqueRule(row) && !hasParsedUFWFields(row)) return '-';
            if (rowProvider(row) === 'ufw' && row.rule.protocol === 'all' && row.rule.destinationPort) return 'TCP/UDP';
            return row.rule.protocol?.toUpperCase() || '-';
        };
        const displayAddress = (row: Firewall.InventoryItem) => {
            if (isOpaqueRule(row) && !hasParsedUFWFields(row)) return '-';
            const wildcard = wildcardAddress(row.rule.scope.family);
            const address = row.rule.sourceAddress;
            if (address && address !== wildcard) return formatHostAddress(address, row.rule.scope.family);
            return `${wildcard}（${i18n.global.t('firewall.anyWhere')}）`;
        };
        const displayPort = (row: Firewall.InventoryItem) => {
            if (isOpaqueRule(row) && !hasParsedUFWFields(row)) return '-';
            return row.rule.destinationPort || '*';
        };
        const extractListeningPorts = (portMap: ListeningProcess['Port']) =>
            Object.keys(portMap || {})
                .map(Number)
                .filter((port) => Number.isInteger(port) && port > 0 && port <= 65535);
        const isPortInRule = (rulePort: string | undefined, port: number) => {
            const value = rulePort?.trim();
            if (!value || value === '*') return true;
            return value.split(',').some((rawSegment) => {
                const segment = rawSegment.trim();
                const delimiter = segment.includes('-') ? '-' : segment.includes(':') ? ':' : '';
                if (!delimiter) return Number(segment) === port;
                const [rawStart, rawEnd] = segment.split(delimiter, 2);
                const start = Number(rawStart);
                const end = Number(rawEnd);
                return Number.isInteger(start) && Number.isInteger(end) && port >= start && port <= end;
            });
        };
        const listeningProtocolNumbers = (protocol: string) => {
            switch (protocol.toLowerCase()) {
                case 'tcp':
                    return [1];
                case 'udp':
                    return [2];
                case 'all':
                    return [1, 2];
                default:
                    return [];
            }
        };
        const clearUsage = () => {
            usageRequestID++;
            usageLoadedAt = 0;
            usageLoading.value = false;
            usageFailed.value = false;
            listeningProcesses.value = [];
            dockerEndpoints.value = [];
        };
        const loadUsage = async () => {
            const requestID = ++usageRequestID;
            usageLoading.value = true;
            usageFailed.value = false;
            const [processes, containers] = await Promise.allSettled([
                rpc.process.listListeningProcess({}),
                rpc.firewall.listDockerEndpoints({}),
            ]);
            if (requestID !== usageRequestID) return;
            listeningProcesses.value =
                processes.status === 'fulfilled'
                    ? (processes.value.items || []).map((item) => ({
                          PID: item.pid,
                          Port: Object.fromEntries(item.ports.map((port) => [port, {}])),
                          Protocol: item.protocol,
                          Name: item.name,
                      }))
                    : [];
            dockerEndpoints.value =
                containers.status === 'fulfilled'
                    ? ((containers.value.items || []) as any[]).flatMap((container) => container.endpoints || [])
                    : [];
            usageFailed.value = processes.status === 'rejected' || containers.status === 'rejected';
            usageLoadedAt = Date.now();
            usageLoading.value = false;
        };
        const refreshUsage = () => {
            if (!usageLoading.value) loadUsage();
        };
        const ruleUsageEntries = (row: RuleRow): UsageEntry[] => {
            if (row.rule.scope.direction !== 'input' || hasIncompleteParsing(row)) return [];
            const protocols = listeningProtocolNumbers(row.rule.protocol);
            const processes = listeningProcesses.value.flatMap((process) => {
                if (!protocols.includes(process.Protocol)) return [];
                const ports = extractListeningPorts(process.Port)
                    .filter((port) => isPortInRule(row.rule.destinationPort, port))
                    .sort((left, right) => left - right);
                if (ports.length === 0) return [];
                return [
                    {
                        key: `${process.PID}:${process.Protocol}:${ports.join(',')}`,
                        ports,
                        owner: process.Name?.trim() || `PID ${process.PID}`,
                        pid: process.PID,
                    },
                ];
            });
            const docker = dockerEndpoints.value
                .filter((endpoint) => row.rule.scope.family === 'inet' || endpoint.family === row.rule.scope.family)
                .filter((endpoint) => protocols.includes(endpoint.protocol === 'tcp' ? 1 : 2))
                .filter((endpoint) => isPortInRule(row.rule.destinationPort, endpoint.hostPort))
                .map((endpoint) => ({
                    key: `docker:${endpoint.family}:${endpoint.hostIP}:${endpoint.hostPort}:${endpoint.protocol}`,
                    ports: [endpoint.hostPort],
                    owner: `Docker: ${endpoint.containerName || endpoint.containerID?.slice(0, 12) || '-'}`,
                    docker: true,
                    dockerManagementTarget: dockerGuardManagementTarget(endpoint),
                    dockerEndpoint: endpoint,
                }));
            return [...processes, ...docker];
        };
        const usageEntryPortText = (entry: UsageEntry) => entry.ports.join(', ') || '-';
        const dockerUsageMessage = (entry: UsageEntry) => {
            if (entry.dockerManagementTarget === 'host_firewall') {
                return i18n.global.t('firewall.dockerInputUseHostFirewall');
            }
            if (entry.dockerManagementTarget === 'container_guard') {
                return i18n.global.t('firewall.dockerInputNotProtected');
            }
            return entry.dockerEndpoint
                ? dockerGuardEndpointManagementMessage(entry.dockerEndpoint)
                : i18n.global.t('firewall.dockerTrafficPathUnknown');
        };
        const usageEntryLabel = (entry: UsageEntry) =>
            entry.docker
                ? `${entry.owner} (${usageEntryPortText(entry)}) — ${dockerUsageMessage(entry)}`
                : `${entry.owner} (${usageEntryPortText(entry)})`;
        const openUsageDetail = (entry: UsageEntry) => {
            if (entry.docker) {
                window.location.href = '/hosts/firewall/docker';
                return;
            }
            if (entry.pid !== undefined) processDetailRef.value?.acceptParams(entry.pid);
        };
        const scopeIdentity = (rule: Firewall.Rule) => JSON.stringify(rule.scope);
        const toRuleRows = (items: Firewall.InventoryItem[]): RuleRow[] =>
            items.map((item, index) => {
                const nativeGroup = item.rule.orderBucket || item.rule.nativeKind || 'default';
                return {
                    ...item,
                    rowKey:
                        item.observed?.instanceKey ||
                        item.observed?.marker ||
                        `${scopeIdentity(item.rule)}:${nativeGroup}:${item.observed?.locator.position ?? index}`,
                };
            });
        const allRows = computed<RuleRow[]>(() => toRuleRows(inventoryItems.value));
        const usageEntriesByRow = computed<Record<string, UsageEntry[]>>(() =>
            Object.fromEntries(allRows.value.map((row) => [row.rowKey, ruleUsageEntries(row)])),
        );
        const loadAllInventoryItems = async () => {
            if (inventoryTotal.value === 0) return [];
            const response = await rpc.firewall.inventory({
                ...inventoryRequest(1, paginationConfig.pageSize),
                all: true,
                info: '',
                families: [],
                actions: [],
            });
            return (response.items || []) as unknown as Firewall.InventoryItem[];
        };
        const searchWithReset = () => {
            paginationConfig.currentPage = 1;
            return search();
        };
        const changeRuleFilter = () => {
            cacheFilterValues(ruleFilterStorageKey, selectedRuleFilters.value);
            selects.value = [];
            return searchWithReset();
        };
        const notices = computed<DisplayNotice[]>(() => {
            const unique = new Map<string, DisplayNotice>();
            if (inventoryTotal.value > 1000 && isServiceBackend.value) {
                unique.set('largeRuleSet', {
                    key: 'largeRuleSet',
                    text: i18n.global.t('firewall.largeRuleSet'),
                });
            }
            scopeNotices.value.forEach((notice) => {
                if (notice.code === 'managed_scope_missing') return;
                const text = scopeNoticeText(notice);
                if (!text) return;
                const key = `${notice.code}:${(notice.values || []).join(',')}`;
                if (!unique.has(key)) {
                    unique.set(key, { key, text });
                }
            });
            return [...unique.values()];
        });
        const scopeNoticeText = (notice: Firewall.ScopeNotice) => {
            const value = (notice.values || []).join(', ') || '-';
            switch (notice.code) {
                case 'family_unavailable':
                    return value;
                case 'managed_scope_missing':
                    return i18n.global.t('firewall.scopeMissing', [value]);
                default:
                    return '';
            }
        };
        const isDenyAction = (action: string) => action === 'drop' || action === 'reject';
        const isKnownAction = (action: string) => action === 'accept' || isDenyAction(action);
        const actionLabel = (action: string) => {
            if (action === 'accept') {
                return i18n.global.t('firewall.accept');
            }
            if (action === 'reject') {
                return i18n.global.t('firewall.reject');
            }
            if (action === 'drop') {
                return i18n.global.t('firewall.drop');
            }
            return i18n.global.t('commons.status.unknown');
        };
        const openCreate = async () => {
            const unavailableScope = scopeNotices.value.find((notice) => notice.code === 'managed_scope_missing');
            if (unavailableScope) {
                try {
                    await ElMessageBox.confirm(
                        scopeNoticeText(unavailableScope),
                        i18n.global.t('commons.msg.infoTitle'),
                        {
                            confirmButtonText: i18n.global.t('commons.button.confirm'),
                            cancelButtonText: i18n.global.t('commons.button.cancel'),
                        },
                    );
                } catch {
                    return;
                }
            }
            const ranges = { ...positionRanges.value };
            if (isDirectBackend.value) {
                for (const family of ['ipv4', 'ipv6'] as const) {
                    ranges[family] = { min: 1, max: (ranges[family]?.max || 0) + 1 };
                }
            }
            ruleOperateRef.value?.acceptParams(
                provider.value as Firewall.Provider,
                undefined,
                ranges,
                supportsFirewalldPriority.value,
            );
        };
        const openImport = () => {
            ruleImportRef.value?.acceptParams(provider.value as Firewall.Provider);
        };
        const exportRules = async (rows: RuleRow[]) => {
            const exported = buildHostRuleExport(rows);
            if (exported.length === 0) {
                MsgInfo(i18n.global.t('commons.msg.noneData'));
                return;
            }
            try {
                await ElMessageBox.confirm(
                    i18n.global.t('firewall.exportHelper', [exported.length]),
                    i18n.global.t('commons.button.export'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                    },
                );
            } catch {
                return;
            }
            downloadWithContent(
                JSON.stringify(exported, null, 2),
                `1panel-firewall-rules-${getCurrentDateFormatted()}.json`,
            );
        };
        const exportRulesBySelection = async () => {
            if (selects.value.length > 0) {
                const selected = new Set(selects.value.map((row) => row.rowKey));
                return exportRules(allRows.value.filter((row) => selected.has(row.rowKey)));
            }
            return exportRules(toRuleRows(await loadAllInventoryItems()));
        };
        const isWildcardDestinationPort = (rule: Firewall.Rule) => {
            const port = rule.destinationPort?.trim();
            return !port || port === '*';
        };
        const ruleUsageOwners = (row: RuleRow) =>
            [...new Set(ruleUsageEntries(row).map((entry) => entry.owner))].sort((left, right) =>
                left.localeCompare(right),
            );
        const usageOwnersSummary = (owners: string[]) => {
            const visibleOwners = owners.slice(0, 5);
            const remaining = owners.length - visibleOwners.length;
            return remaining > 0 ? `${visibleOwners.join(', ')} (+${remaining})` : visibleOwners.join(', ');
        };
        const deleteRulesConfirmMessage = (selected: RuleRow[]) => {
            const count = new Set(selected.map((row) => row.observed?.instanceKey)).size;
            const accepted = selected.filter((row) => row.rule.action === 'accept' && Boolean(row.observed));
            const risky = accepted.filter(
                (row) => isWildcardDestinationPort(row.rule) || ruleUsageEntries(row).length > 0,
            );
            if (selected.length > 1 && risky.length > 0) {
                return i18n.global.t('firewall.deleteRiskRulesConfirm', [
                    count,
                    new Set(risky.map((row) => row.observed?.instanceKey)).size,
                ]);
            }
            if (selected.length === 1 && accepted.length === 1) {
                const [row] = accepted;
                if (isWildcardDestinationPort(row.rule)) {
                    return i18n.global.t('firewall.deleteWildcardRuleConfirm', [
                        formatHostAddress(row.rule.sourceAddress, row.rule.scope.family) ||
                            i18n.global.t('firewall.anyWhere'),
                        `${row.rule.protocol.toUpperCase()}/*`,
                    ]);
                }
                const owners = ruleUsageOwners(row);
                if (owners.length > 0) {
                    return i18n.global.t('firewall.deleteUsedRuleConfirm', [usageOwnersSummary(owners)]);
                }
            }
            return i18n.global.t('firewall.deleteRuleConfirm', [count]);
        };
        const removeRules = async (selected: RuleRow[]) => {
            if (selected.length === 0) return;
            try {
                await ElMessageBox.confirm(
                    deleteRulesConfirmMessage(selected),
                    i18n.global.t('commons.button.delete'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                    },
                );
            } catch {
                return;
            }
            loading.value = true;
            const targets = selected.filter(isDeletableRule).map((row) => ({
                scope: row.rule.scope,
                instanceKey: row.observed.instanceKey!,
                observed: row.observed,
            }));
            const count = targets.length;
            try {
                if (count === 0) return;
                const {
                    taskId: taskID,
                    queued,
                    succeeded,
                    failed,
                } = await rpc.firewall.deleteRules({ targets } as any);
                if (queued && taskID) {
                    selects.value = [];
                    openRuleTask(taskID);
                    return;
                }
                if (succeeded > 0) {
                    MsgSuccess(`${i18n.global.t('commons.msg.operationSuccess')} (${succeeded}/${count})`);
                }
                if (failed > 0) {
                    MsgError(`${i18n.global.t('commons.msg.operationFailed')} (${failed}/${count})`);
                }
                await search();
            } finally {
                loading.value = false;
            }
        };
        const removeSelectedRules = () => removeRules(selects.value.filter((row) => isDeletableRule(row)));
        const resetRules = () => {
            withDockerRestart.value = false;
            const message = i18n.global.t(
                isDirectBackend.value ? 'firewall.resetDirectRulesHelper' : 'firewall.resetWhitelistRulesHelper',
                [provider.value],
            );
            resetConfirmRef.value?.acceptParams({
                message,
                provider: provider.value,
            });
        };
        const prepareResetRules = async (backup: boolean) => {
            backupBeforeReset.value = backup;
            if (provider.value === 'firewalld') {
                const status = await rpc.container.getDockerStatus({});
                if (status.isActive) {
                    dockerRestartRef.value?.acceptParams({ title: i18n.global.t('firewall.dockerRestart') });
                    return;
                }
            }
            await submitResetRules();
        };
        const submitResetRules = async () => {
            resetting.value = true;
            loading.value = true;
            try {
                const response = await rpc.firewall.resetRules({
                    backup: backupBeforeReset.value,
                    provider: provider.value as Firewall.Provider,
                    withDockerRestart: provider.value === 'firewalld' && withDockerRestart.value,
                });
                if (response.backupPath) {
                    await ElMessageBox.alert(response.backupPath, i18n.global.t('commons.button.export'), {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                    });
                }
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } finally {
                resetting.value = false;
                fireStatusRef.value?.acceptParams();
            }
        };
        const viewRawRule = async (row: RuleRow) => {
            let raw = row.observed?.raw?.trim();
            const target = nativeDetailTarget(row);
            if (target) {
                const response = await rpc.firewall.getNativeDetail(target);
                raw = response.content.trim();
            }
            if (!raw) return;
            try {
                await ElMessageBox.alert(raw, i18n.global.t('commons.button.view'), {
                    confirmButtonText: i18n.global.t('commons.button.close'),
                    customClass: 'firewall-raw-rule-message',
                });
            } catch {
                return;
            }
        };
        const removeRule = async (row: RuleRow) => {
            if (row.isWhitelist) {
                await ElMessageBox.alert(
                    i18n.global.t('firewall.whitelistRuleProtected'),
                    i18n.global.t('commons.msg.infoTitle'),
                    { type: 'info', confirmButtonText: i18n.global.t('commons.button.close') },
                ).catch(() => {});
                return;
            }
            return removeRules([row]);
        };
        const canEditDescription = (row: Firewall.InventoryItem) =>
            (row.isWhitelist || !row.observed.protected) && Boolean(row.observed.instanceKey);
        const isDeletableRule = (row: Firewall.InventoryItem) => !row.observed.protected;
        const displayRulePriority = (row: Firewall.InventoryItem) => {
            if (row.rule.scope.provider === 'firewalld') {
                if (!supportsFirewalldPriority.value || row.rule.nativeKind !== 'rich_rule') return '-';
                return row.rule.priority ?? '-';
            }
            return row.observed?.locator.position ?? '-';
        };
        const openEdit = async (row: RuleRow) => {
            if (!canEditDescription(row)) return;
            let ranges = positionRanges.value;
            if (isDirectBackend.value && row.rule.scope.chain !== '1PANEL_BASIC') {
                const data = await rpc.firewall.inventory({
                    scopes: [row.rule.scope] as any,
                    info: '',
                    page: 1,
                    pageSize: 1,
                });
                ranges = { ipv4: data.ipv4Range as any, ipv6: data.ipv6Range as any };
            }
            ruleOperateRef.value?.acceptParams(
                provider.value as Firewall.Provider,
                row,
                ranges,
                supportsFirewalldPriority.value,
            );
        };
        const operationButtons: FuTableOperationButton<RuleRow>[] = [
            {
                label: i18n.global.t('commons.button.view'),
                permission: true,
                nodeAdmin: true,
                show: (row: RuleRow) => hasIncompleteParsing(row) && Boolean(row.observed?.raw),
                click: viewRawRule,
            },
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                nodeAdmin: true,
                disabled: (row: RuleRow) => !canEditDescription(row),
                click: openEdit,
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                nodeAdmin: true,
                show: (row: RuleRow) => row.isWhitelist || isDeletableRule(row),
                click: removeRule,
            },
        ];
        onMounted(() => {
            loading.value = true;
            fireStatusRef.value?.acceptParams();
        });
        onBeforeUnmount(() => {
            searchRequestID++;
            usageRequestID++;
        });
        return () => (
            <div>
                <FireRouter />
                <div>
                    <FireStatus
                        ref={fireStatusRef}
                        loading={unref(loading)}
                        onUpdate:loading={($v) => {
                            loading.value = $v as any;
                        }}
                        is-active={unref(isActive)}
                        onUpdate:is-active={($v) => {
                            isActive.value = $v as any;
                        }}
                        is-init={unref(isInit)}
                        onUpdate:is-init={($v) => {
                            isInit.value = $v as any;
                        }}
                        is-bind={unref(isBind)}
                        onUpdate:is-bind={($v) => {
                            isBind.value = $v as any;
                        }}
                        name={unref(provider)}
                        onUpdate:name={($v) => {
                            provider.value = $v as any;
                        }}
                        version={unref(firewallVersion)}
                        onUpdate:version={($v) => {
                            firewallVersion.value = $v as any;
                        }}
                        current-tab="base"
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        v-slots={{
                            actions: () => (
                                <>
                                    {unref(canReset) ? <ElDivider direction="vertical" /> : null}
                                    {unref(canReset)
                                        ? withDirectives(
                                              <ElButton
                                                  type="primary"
                                                  link
                                                  disabled={unref(loading)}
                                                  loading={unref(resetting)}
                                                  onClick={($event?: any) => {
                                                      (resetRules as any)($event);
                                                  }}
                                              >
                                                  {$t('commons.button.reset')}
                                              </ElButton>,
                                              [
                                                  [permissionDirective, true],
                                                  [nodeAdminDirective, true],
                                              ],
                                          )
                                        : null}
                                </>
                            ),
                        }}
                    />
                    {unref(provider) !== '-' ? (
                        <div>
                            {unref(showFirewallUnavailablePrompt) ? (
                                <ElCard class={'mask-prompt'}>
                                    {unref(isServiceBackend) ? (
                                        <span>{$t('firewall.firewallNotStart')}</span>
                                    ) : !unref(isInit) ? (
                                        <span>{$t('firewall.initHelper', [unref(provider)])}</span>
                                    ) : (
                                        <span>{$t('firewall.basicStatus')}</span>
                                    )}
                                </ElCard>
                            ) : null}
                            <LayoutContent
                                title={$t('menu.firewall')}
                                class={{ mask: !unref(isFirewallReady) }}
                                v-slots={{
                                    prompt: () => (
                                        <>
                                            <div ref={noticeRef} class={'flow-root'}>
                                                {(unref(notices) || []).map((notice) => (
                                                    <ElAlert
                                                        type="warning"
                                                        closable={false}
                                                        title={notice.text}
                                                        class={'mb-2'}
                                                        key={notice.key}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    ),
                                    leftToolBar: () => (
                                        <>
                                            {withDirectives(
                                                <ElButton
                                                    type="primary"
                                                    disabled={unref(loading)}
                                                    onClick={($event?: any) => {
                                                        (openCreate as any)($event);
                                                    }}
                                                >
                                                    {$t('commons.button.create')}
                                                </ElButton>,
                                                [
                                                    [permissionDirective, true],
                                                    [nodeAdminDirective, true],
                                                ],
                                            )}
                                            {withDirectives(
                                                <ElButton
                                                    disabled={unref(loading) || !unref(selects).some(isDeletableRule)}
                                                    onClick={($event?: any) => {
                                                        (removeSelectedRules as any)($event);
                                                    }}
                                                >
                                                    {$t('commons.button.delete')}
                                                </ElButton>,
                                                [
                                                    [permissionDirective, true],
                                                    [nodeAdminDirective, true],
                                                ],
                                            )}
                                            <ElButtonGroup>
                                                {withDirectives(
                                                    <ElButton
                                                        disabled={unref(loading)}
                                                        onClick={($event?: any) => {
                                                            (openImport as any)($event);
                                                        }}
                                                    >
                                                        {$t('commons.button.import')}
                                                    </ElButton>,
                                                    [
                                                        [permissionDirective, true],
                                                        [nodeAdminDirective, true],
                                                    ],
                                                )}
                                                {withDirectives(
                                                    <ElButton
                                                        disabled={unref(loading) || unref(inventoryTotal) === 0}
                                                        onClick={($event?: any) => {
                                                            (exportRulesBySelection as any)($event);
                                                        }}
                                                    >
                                                        {$t('commons.button.export')}
                                                    </ElButton>,
                                                    [[permissionDirective, true]],
                                                )}
                                            </ElButtonGroup>
                                        </>
                                    ),
                                    rightToolBar: () => (
                                        <>
                                            <div class={'firewall-filter-bar'}>
                                                <ElSelect
                                                    modelValue={unref(selectedRuleFilters)}
                                                    onUpdate:modelValue={($v) => {
                                                        selectedRuleFilters.value = $v as any;
                                                    }}
                                                    placeholder={$t('menu.filter')}
                                                    multiple
                                                    clearable
                                                    collapse-tags
                                                    collapse-tags-tooltip
                                                    max-collapse-tags={2}
                                                    popper-class="firewall-rule-filter-popper"
                                                    onChange={($event?: any) => {
                                                        (changeRuleFilter as any)($event);
                                                    }}
                                                    class={'firewall-rule-filter'}
                                                >
                                                    <ElOptionGroup label="IP">
                                                        <ElOption label="IPv4" value="family:ipv4" />
                                                        <ElOption label="IPv6" value="family:ipv6" />
                                                    </ElOptionGroup>
                                                    <ElOptionGroup label={$t('firewall.action')}>
                                                        <ElOption label={$t('firewall.accept')} value="action:accept" />
                                                        <ElOption label={$t('firewall.drop')} value="action:deny" />
                                                    </ElOptionGroup>
                                                </ElSelect>
                                            </div>
                                            <TableSearch
                                                searchName={unref(searchName)}
                                                onUpdate:searchName={($v) => {
                                                    searchName.value = $v as any;
                                                }}
                                                onSearch={($event?: any) => {
                                                    (searchWithReset as any)($event);
                                                }}
                                            />
                                            <TableRefresh
                                                onSearch={($event?: any) => {
                                                    (search as any)($event);
                                                }}
                                            />
                                            <TableSetting
                                                title="firewall-rule-refresh"
                                                onSearch={($event?: any) => {
                                                    !unref(loading) && !unref(usageLoading) && search();
                                                }}
                                            />
                                        </>
                                    ),
                                    main: () => (
                                        <>
                                            {withDirectives(
                                                <div>
                                                    <ComplexTable
                                                        selection-context={() => [
                                                            unref(searchName),
                                                            unref(selectedRuleFilters),
                                                        ]}
                                                        selects={unref(selects)}
                                                        onUpdate:selects={($v) => {
                                                            selects.value = $v as any;
                                                        }}
                                                        cache-pagination={false}
                                                        pagination-config={paginationConfig}
                                                        data={unref(allRows)}
                                                        heightDiff={320 + unref(noticeHeight)}
                                                        row-key="rowKey"
                                                        onSearch={($event?: any) => {
                                                            (search as any)($event);
                                                        }}
                                                    >
                                                        <ElTableColumn type="selection" width="48" fix />
                                                        <ElTableColumn
                                                            label={$t('firewall.action')}
                                                            width="110"
                                                            v-slots={{
                                                                default: ({ row }) => (
                                                                    <>
                                                                        <span
                                                                            class={cn('firewall-action', {
                                                                                'is-accept':
                                                                                    row.rule.action === 'accept',
                                                                                'is-drop': isDenyAction(
                                                                                    row.rule.action,
                                                                                ),
                                                                                'is-unknown': !isKnownAction(
                                                                                    row.rule.action,
                                                                                ),
                                                                            })}
                                                                        >
                                                                            {isKnownAction(row.rule.action) ? (
                                                                                <i
                                                                                    aria-hidden="true"
                                                                                    class={cn(
                                                                                        'iconfont firewall-action-icon',
                                                                                        row.rule.action === 'accept'
                                                                                            ? 'p-yunxu1'
                                                                                            : 'p-a-44tubiao-226',
                                                                                    )}
                                                                                />
                                                                            ) : null}
                                                                            {actionLabel(row.rule.action)}
                                                                            {row.observed.protected &&
                                                                            !row.isWhitelist ? (
                                                                                <ElTooltip
                                                                                    content={$t(
                                                                                        'firewall.builtinRuleProtected',
                                                                                    )}
                                                                                    {...TABLE_TOOLTIP_OPTIONS}
                                                                                    show-after={200}
                                                                                    popper-style={{ maxWidth: '320px' }}
                                                                                >
                                                                                    <ElIcon
                                                                                        aria-label={$t(
                                                                                            'firewall.builtinRuleProtected',
                                                                                        )}
                                                                                        tabindex="0"
                                                                                        class={'firewall-action-lock'}
                                                                                    >
                                                                                        <Lock />
                                                                                    </ElIcon>
                                                                                </ElTooltip>
                                                                            ) : null}
                                                                        </span>
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                        <ElTableColumn
                                                            label={$t('firewall.priority')}
                                                            width="90"
                                                            v-slots={{
                                                                default: ({ row }) => <>{displayRulePriority(row)}</>,
                                                            }}
                                                        />
                                                        <ElTableColumn
                                                            label={$t('commons.table.protocol')}
                                                            width="110"
                                                            v-slots={{
                                                                default: ({ row }) => <>{displayProtocol(row)}</>,
                                                            }}
                                                        />
                                                        <ElTableColumn
                                                            label="IP"
                                                            min-width="240"
                                                            show-overflow-tooltip
                                                            v-slots={{
                                                                default: ({ row }) => (
                                                                    <>
                                                                        <span>{displayAddress(row)}</span>
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                        <ElTableColumn
                                                            label={$t('commons.table.port')}
                                                            min-width="180"
                                                            show-overflow-tooltip
                                                            v-slots={{
                                                                default: ({ row }) => (
                                                                    <>
                                                                        <span>{displayPort(row)}</span>
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                        <ElTableColumn
                                                            label={$t('firewall.used')}
                                                            min-width="200"
                                                            v-slots={{
                                                                header: () => (
                                                                    <>
                                                                        <span>{$t('firewall.used')}</span>
                                                                        <ElButton
                                                                            link
                                                                            icon={Refresh}
                                                                            disabled={unref(usageLoading)}
                                                                            aria-label={$t('commons.button.refresh')}
                                                                            onClick={($event?: any) => {
                                                                                (refreshUsage as any)($event);
                                                                            }}
                                                                        />
                                                                    </>
                                                                ),
                                                                default: ({ row }) => (
                                                                    <>
                                                                        {hasIncompleteParsing(row) ? (
                                                                            <span>{'-'}</span>
                                                                        ) : unref(usageLoading) ? (
                                                                            <ElIcon class={'is-loading'}>
                                                                                <Loading />
                                                                            </ElIcon>
                                                                        ) : unref(usageFailed) ? (
                                                                            <span>{'-'}</span>
                                                                        ) : unref(usageEntriesByRow)[row.rowKey]
                                                                              .length === 0 ? (
                                                                            <ElTag type="info" size="small">
                                                                                {$t('firewall.unUsed')}
                                                                            </ElTag>
                                                                        ) : (
                                                                            <div class={'firewall-used-cell'}>
                                                                                <ElTooltip
                                                                                    content={usageEntryLabel(
                                                                                        unref(usageEntriesByRow)[
                                                                                            row.rowKey
                                                                                        ][0],
                                                                                    )}
                                                                                    {...TABLE_TOOLTIP_OPTIONS}
                                                                                >
                                                                                    <ElTag
                                                                                        type="info"
                                                                                        effect="plain"
                                                                                        size="small"
                                                                                        onClick={($event?: any) => {
                                                                                            $event.stopPropagation();
                                                                                            openUsageDetail(
                                                                                                unref(
                                                                                                    usageEntriesByRow,
                                                                                                )[row.rowKey][0],
                                                                                            );
                                                                                        }}
                                                                                        class={
                                                                                            'firewall-used-entry cursor-pointer'
                                                                                        }
                                                                                    >
                                                                                        <span
                                                                                            class={
                                                                                                'firewall-used-entry-owner'
                                                                                            }
                                                                                        >
                                                                                            {
                                                                                                unref(
                                                                                                    usageEntriesByRow,
                                                                                                )[row.rowKey][0].owner
                                                                                            }
                                                                                        </span>
                                                                                        <span
                                                                                            class={
                                                                                                'firewall-used-entry-port'
                                                                                            }
                                                                                        >
                                                                                            {' ('}
                                                                                            {usageEntryPortText(
                                                                                                unref(
                                                                                                    usageEntriesByRow,
                                                                                                )[row.rowKey][0],
                                                                                            )}
                                                                                            {') '}
                                                                                        </span>
                                                                                        <ElIcon
                                                                                            class={
                                                                                                'firewall-used-entry-icon'
                                                                                            }
                                                                                        >
                                                                                            <Expand />
                                                                                        </ElIcon>
                                                                                    </ElTag>
                                                                                </ElTooltip>
                                                                                {unref(usageEntriesByRow)[row.rowKey]
                                                                                    .length > 1 ? (
                                                                                    <ElPopover
                                                                                        placement="right"
                                                                                        trigger="click"
                                                                                        width={340}
                                                                                        persistent={false}
                                                                                        v-slots={{
                                                                                            reference: () => (
                                                                                                <>
                                                                                                    <ElTag
                                                                                                        type="info"
                                                                                                        effect="plain"
                                                                                                        size="small"
                                                                                                        class={
                                                                                                            'firewall-used-more cursor-pointer'
                                                                                                        }
                                                                                                    >
                                                                                                        {' +'}
                                                                                                        {unref(
                                                                                                            usageEntriesByRow,
                                                                                                        )[row.rowKey]
                                                                                                            .length - 1}
                                                                                                    </ElTag>
                                                                                                </>
                                                                                            ),
                                                                                        }}
                                                                                    >
                                                                                        <div
                                                                                            class={
                                                                                                'firewall-used-popover-list'
                                                                                            }
                                                                                        >
                                                                                            {(
                                                                                                unref(
                                                                                                    usageEntriesByRow,
                                                                                                )[row.rowKey] || []
                                                                                            ).map((entry) => (
                                                                                                <ElTooltip
                                                                                                    content={usageEntryLabel(
                                                                                                        entry,
                                                                                                    )}
                                                                                                    {...TABLE_TOOLTIP_OPTIONS}
                                                                                                    key={`${row.rowKey}:${entry.key}`}
                                                                                                >
                                                                                                    <ElTag
                                                                                                        type="info"
                                                                                                        effect="plain"
                                                                                                        size="small"
                                                                                                        onClick={(
                                                                                                            $event?: any,
                                                                                                        ) => {
                                                                                                            $event.stopPropagation();
                                                                                                            openUsageDetail(
                                                                                                                entry,
                                                                                                            );
                                                                                                        }}
                                                                                                        class={
                                                                                                            'firewall-used-popover-entry cursor-pointer'
                                                                                                        }
                                                                                                    >
                                                                                                        <span
                                                                                                            class={
                                                                                                                'firewall-used-entry-owner'
                                                                                                            }
                                                                                                        >
                                                                                                            {
                                                                                                                entry.owner
                                                                                                            }
                                                                                                        </span>
                                                                                                        <span
                                                                                                            class={
                                                                                                                'firewall-used-entry-port'
                                                                                                            }
                                                                                                        >
                                                                                                            {' ('}
                                                                                                            {usageEntryPortText(
                                                                                                                entry,
                                                                                                            )}
                                                                                                            {') '}
                                                                                                        </span>
                                                                                                        <ElIcon
                                                                                                            class={
                                                                                                                'firewall-used-entry-icon'
                                                                                                            }
                                                                                                        >
                                                                                                            <Expand />
                                                                                                        </ElIcon>
                                                                                                    </ElTag>
                                                                                                </ElTooltip>
                                                                                            ))}
                                                                                        </div>
                                                                                    </ElPopover>
                                                                                ) : null}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                        <ElTableColumn
                                                            label={$t('commons.table.description')}
                                                            min-width="160"
                                                            prop="rule.description"
                                                            show-overflow-tooltip
                                                        />
                                                        <FuTableOperations
                                                            width="160px"
                                                            buttons={operationButtons}
                                                            label={$t('commons.table.operate')}
                                                            fix
                                                        />
                                                    </ComplexTable>
                                                </div>,
                                                [[vLoading, unref(loading)]],
                                            )}
                                        </>
                                    ),
                                }}
                            />
                        </div>
                    ) : null}
                </div>
                <RuleOperate
                    ref={ruleOperateRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                    onCreated={($event?: any) => {
                        (openRuleTask as any)($event);
                    }}
                />
                <RuleImport
                    ref={ruleImportRef}
                    onCreated={($event?: any) => {
                        (openRuleTask as any)($event);
                    }}
                />
                <TaskLog
                    ref={ruleTaskLogRef}
                    onClose={($event?: any) => {
                        unref(fireStatusRef)?.acceptParams();
                    }}
                />
                <ProcessDetail ref={processDetailRef} />
                <RuleReset
                    ref={resetConfirmRef}
                    onConfirm={($event?: any) => {
                        (prepareResetRules as any)($event);
                    }}
                />
                <DockerRestart
                    ref={dockerRestartRef}
                    withDockerRestart={unref(withDockerRestart)}
                    onUpdate:withDockerRestart={($v) => {
                        withDockerRestart.value = $v as any;
                    }}
                    title={$t('commons.button.reset')}
                    onSubmit={($event?: any) => {
                        (submitResetRules as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
