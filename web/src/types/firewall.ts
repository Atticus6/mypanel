import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
import {
    FirewallBackendOptionSchema,
    FirewallFamilyStatusSchema,
    FirewallBackendGroupSchema,
    FirewallSettingsSchema,
    PortWhitelistRuleSchema,
    UpdateFirewallWhitelistRequestSchema,
    OperateFirewallBackendRequestSchema,
    FirewallTaskResponseSchema,
    FirewallBaseInfoSchema,
    SearchForwardRulesRequestSchema,
    ForwardRuleSchema,
    ForwardRuleOperationSchema,
    FirewallScopeSchema,
    FirewallRuleSchema,
    FirewallLocatorSchema,
    FirewallObservedRuleSchema,
    FirewallPositionRangeSchema,
    FirewallInventoryItemSchema,
    FirewallScopeNoticeSchema,
    FirewallInventorySchema,
    ResetFirewallRulesResponseSchema,
    FirewallRuleBackupsSchema,
    ResetFirewallRulesRequestSchema,
    FirewallInventoryRequestSchema,
    GetFirewallNativeDetailRequestSchema,
    FirewallRuleCreateItemSchema,
    CreateFirewallRulesRequestSchema,
    FirewallRuleCreateFailureSchema,
    CreateFirewallRulesResponseSchema,
    FirewallRuleDeleteTargetSchema,
    DeleteFirewallRulesRequestSchema,
    FirewallRuleDeleteFailureSchema,
    DeleteFirewallRulesResponseSchema,
    DockerGuardBaseSchema,
    DockerGuardFamilyStatusSchema,
    DockerGuardEndpointSchema,
    DockerGuardPortGroupSchema,
    DockerGuardContainerSchema,
    DockerGuardOverviewSchema,
    DockerGuardPolicySchema,
    UpsertDockerPoliciesRequestSchema,
    DeleteDockerPoliciesRequestSchema,
} from '@/gen/panel/agent/v1/firewall_pb';

type Init<T extends DescMessage> = MessageInitShape<T>;

export namespace Firewall {
    export type Provider = 'iptables' | 'nftables' | 'firewalld' | 'ufw';
    export type BackendSubsystem = 'system' | 'forwarding' | 'docker';
    export type BackendOperation = 'select' | 'initialize' | 'cleanup';
    export type BackendOption = Init<typeof FirewallBackendOptionSchema>;

    // 去掉 $typeName/$unknown 后为静态对象类型，供页面 interface 继承。
    export type BackendFamilyStatus = Omit<Init<typeof FirewallFamilyStatusSchema>, '$typeName' | '$unknown'>;

    export type BackendGroup = Init<typeof FirewallBackendGroupSchema>;

    export type Settings = Init<typeof FirewallSettingsSchema>;

    export type PortWhitelist = Init<typeof PortWhitelistRuleSchema> & {
        protocol?: 'tcp' | 'udp';
        type?: 'panel' | 'ssh';
    };

    export type PortWhitelistUpdate = Init<typeof UpdateFirewallWhitelistRequestSchema>;

    export type BackendOperateRequest = Init<typeof OperateFirewallBackendRequestSchema>;

    export type FilterChainOperationResult = Init<typeof FirewallTaskResponseSchema> & { taskID?: string };

    export type FirewallBase = Init<typeof FirewallBaseInfoSchema> & { lifecycleTaskID?: string };

    export type ForwardRuleSearch = Init<typeof SearchForwardRulesRequestSchema>;

    export type RuleInfo = Init<typeof ForwardRuleSchema> & {
        destination: string;
        srcPort: string;
        destPort: string;
        page: number;
        pageSize: number;
        [key: string]: any;
    };

    // targetIP 为展示层旧字段名，proto 对应 targetIp；family 收窄为展示层使用的地址族。
    export type RuleForward = Omit<Init<typeof ForwardRuleOperationSchema>, '$typeName' | '$unknown' | 'family'> & {
        family: 'ipv4' | 'ipv6';
        targetIP: string;
    };

    export type Family = 'ipv4' | 'ipv6' | 'inet';
    export type Direction = 'input';
    export type Action = 'accept' | 'drop' | 'reject';
    export type NativeKind =
        | 'rule' | 'zone_port' | 'rich_rule' | 'ufw_rule' | 'ufw_application' | 'opaque' | 'zone_service';
    export type ParseStatus = 'supported' | 'partial' | 'opaque';
    export type PersistenceStatus = 'converged' | 'runtime_only' | 'permanent_only';

    export type Scope = Omit<Init<typeof FirewallScopeSchema>, '$typeName' | '$unknown' | 'provider' | 'family' | 'direction'> & {
        provider: Provider;
        family: Family;
        direction: Direction;
    };

    // orderIndex 在 proto 中为 int64（bigint），展示层按 number 处理。
    export type Rule = Omit<Init<typeof FirewallRuleSchema>, 'scope' | 'nativeKind' | 'action' | 'orderIndex'> & {
        raw?: string;
        parseStatus?: ParseStatus;
        scope: Scope;
        nativeKind?: NativeKind;
        action: Action;
        orderIndex?: number;
    };

    export type Locator = Omit<Init<typeof FirewallLocatorSchema>, 'provider'> & { provider: Provider };

    export type ObservedRule = Omit<
        Init<typeof FirewallObservedRuleSchema>,
        'rule' | 'locator' | 'parseStatus' | 'persistence'
    > & {
        rule: Rule;
        locator: Locator;
        parseStatus: ParseStatus;
        persistence?: PersistenceStatus;
    };

    export type PositionRange = Init<typeof FirewallPositionRangeSchema>;

    export type InventoryItem = Omit<Init<typeof FirewallInventoryItemSchema>, 'rule' | 'observed'> & {
        rule: Rule;
        observed: ObservedRule;
        descriptionID: string;
    };

    export type ScopeNoticeCode =
        | 'family_unavailable'
        | 'managed_scope_inactive'
        | 'runtime_permanent_mismatch'
        | 'default_policy'
        | 'managed_scope_missing';

    export type ScopeNotice = Omit<Init<typeof FirewallScopeNoticeSchema>, 'code'> & { code: ScopeNoticeCode };

    // total、allTotal 在 proto 中为 int64（bigint），展示层按 number 处理。
    export type Inventory = Omit<Init<typeof FirewallInventorySchema>, 'total' | 'allTotal'> & {
        total: number;
        allTotal: number;
    };

    export type ResetResponse = Init<typeof ResetFirewallRulesResponseSchema>;

    export type RuleBackups = Omit<Init<typeof FirewallRuleBackupsSchema>, 'files'> & {
        files: Array<{ name: string; provider: Provider; ruleCount: number; modifiedAt: number }>;
    };

    export type ResetRequest = Omit<Init<typeof ResetFirewallRulesRequestSchema>, 'subsystem' | 'provider'> & {
        subsystem?: BackendSubsystem;
        provider?: Provider;
    };

    export type InventoryRequest = Omit<Init<typeof FirewallInventoryRequestSchema>, 'scopes' | 'families' | 'actions'> & {
        scopes: Scope[];
        families?: Array<'ipv4' | 'ipv6'>;
        actions?: Array<'accept' | 'deny'>;
    };

    export type NativeDetailRequest = Omit<
        Init<typeof GetFirewallNativeDetailRequestSchema>,
        '$typeName' | '$unknown' | 'provider' | 'nativeKind'
    > & {
        provider: 'firewalld' | 'ufw';
        nativeKind: 'zone_service' | 'ufw_application';
    };

    export type CreateItem = Omit<Init<typeof FirewallRuleCreateItemSchema>, 'rule' | 'parseStatus' | 'sourceKind'> & {
        rule: Rule;
        parseStatus?: ParseStatus;
        sourceKind?: 'user' | 'panel' | 'security' | 'imported';
    };

    export type CreateRequest = Omit<Init<typeof CreateFirewallRulesRequestSchema>, 'items'> & {
        items: CreateItem[];
    };

    export type CreateResponse = Omit<Init<typeof CreateFirewallRulesResponseSchema>, 'errors'> & {
        taskID?: string;
        errors?: CreateFailure[];
    };

    export type CreateFailure = Omit<Init<typeof FirewallRuleCreateFailureSchema>, 'status' | 'rule'> & {
        status: 'failed' | 'skipped';
        rule: Rule;
    };

    export type RuleTarget = Omit<Init<typeof FirewallRuleDeleteTargetSchema>, 'scope'> & { scope: Scope };

    export type DeleteRequest = Omit<Init<typeof DeleteFirewallRulesRequestSchema>, 'targets'> & {
        targets: (RuleTarget & { observed: ObservedRule })[];
    };

    export type DeleteResponse = Omit<Init<typeof DeleteFirewallRulesResponseSchema>, 'errors'> & {
        taskID?: string;
        errors?: DeleteFailure[];
    };

    export type DeleteFailure = Init<typeof FirewallRuleDeleteFailureSchema>;

    export type UpdateRequest =
        | { rule: Rule; description?: never; orderIndex?: never; priority?: never }
        | { rule?: never; description: string; orderIndex?: never; priority?: never }
        | { rule?: never; description?: string; orderIndex: number; priority?: never }
        | { rule?: never; description?: string; orderIndex?: never; priority: number };

    export type DockerGuardBase = Init<typeof DockerGuardBaseSchema>;

    export type DockerGuardFamilyStatus = Init<typeof DockerGuardFamilyStatusSchema>;

    export type DockerGuardEndpoint = Omit<
        Init<typeof DockerGuardEndpointSchema>,
        | 'family'
        | 'hostIp'
        | 'protocol'
        | 'containerId'
        | 'containerState'
        | 'policyUuid'
        | 'mode'
        | 'trafficPath'
        | 'managementTarget'
        | 'managementReason'
    > & {
        family: 'ipv4' | 'ipv6';
        hostIP: string;
        protocol: 'tcp' | 'udp';
        containerID?: string;
        containerState?: 'created' | 'running' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead';
        policyUUID?: string;
        mode?: 'deny_sources' | 'allow_sources' | 'deny_all' | 'accept_sources' | 'accept_all';
        trafficPath: 'forward' | 'input' | 'unknown';
        managementTarget?: 'container_guard' | 'host_firewall' | 'needs_diagnosis';
        managementReason?: 'nat_inspect_failed' | 'nat_chain_unreachable' | 'proxy_inspect_failed' | 'no_matching_path';
    };

    export type DockerGuardPortGroup = Omit<Init<typeof DockerGuardPortGroupSchema>, 'endpoint' | 'endpoints'> & {
        endpoint: DockerGuardEndpoint;
        endpoints: DockerGuardEndpoint[];
    };

    export type DockerGuardContainer = Omit<Init<typeof DockerGuardContainerSchema>, 'endpoints' | 'portGroups'> & {
        endpoints: DockerGuardEndpoint[];
        portGroups: DockerGuardPortGroup[];
    };

    export type DockerGuardList = Omit<Init<typeof DockerGuardOverviewSchema>, 'base' | 'containers' | 'orphanPolicies'> & {
        base: DockerGuardBase;
        containers: DockerGuardContainer[];
        orphanPolicies: DockerGuardEndpoint[];
    };

    export interface DockerGuardEndpointIdentity {
        family: 'ipv4' | 'ipv6';
        hostIP: string;
        hostPort: number;
        protocol: 'tcp' | 'udp';
    }

    export type DockerGuardPolicy = Omit<Init<typeof DockerGuardPolicySchema>, 'family' | 'hostIp' | 'protocol' | 'mode'> & {
        family: 'ipv4' | 'ipv6';
        hostIP: string;
        protocol: 'tcp' | 'udp';
        mode: 'deny_sources' | 'allow_sources' | 'deny_all' | 'accept_sources' | 'accept_all';
    };

    export type DockerGuardPolicyBatch = Omit<Init<typeof UpsertDockerPoliciesRequestSchema>, 'policies'> & {
        policies: DockerGuardPolicy[];
    };

    export type DockerGuardPolicyBatchDelete = Init<typeof DeleteDockerPoliciesRequestSchema>;
}
