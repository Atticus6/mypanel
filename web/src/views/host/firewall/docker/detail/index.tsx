import { $t } from '@/utils/i18n-t';
import { Firewall } from '@/types/firewall';
import i18n from '@/lang';
import { MsgError, MsgWarning } from '@/utils/message';
import { getErrorMessage } from '@/utils/misc';
import { getHttpResponseMessage } from '@/api/http-core';
import { rpc } from '@/lib/rpc';
import {
    dockerGuardEndpointManagementMessage,
    dockerGuardEndpointStatusMessage,
    dockerGuardManagementTarget,
    isValidDockerGuardSource,
} from '@/views/host/firewall/docker/model';
import {
    FIREWALL_BATCH_LIMIT,
    formatHostAddress,
    formatHostAddressList,
    splitTagValues,
} from '@/views/host/firewall/utils/validation';
type PolicyMode = Extract<Firewall.DockerGuardPolicy['mode'], 'deny_sources' | 'allow_sources' | 'deny_all'>;
type PolicyForm = Pick<Firewall.DockerGuardPolicy, 'sources'> & { mode: PolicyMode | '' };
type ValidationCallback = (error?: Error) => void;
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import { cn } from '@/utils/cn';
import DrawerPro from '@/components/drawer-pro/index';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
    base?: Firewall.DockerGuardBase;
    containers?: Firewall.DockerGuardContainer[];
}

const emits = {
    search: () => true,
    created: (arg0?: string) => true,
};

const options = {
    name: 'detail',
    props: {
        base: { type: null },
        containers: Array,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-e12f4c28',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref(false);
        const policyVisible = ref(false);
        const savingPolicy = ref(false);
        const activeContainerKey = ref('');
        const selectedGroupKeys = ref(new Set<string>());
        const policyEndpoints = ref<Firewall.DockerGuardEndpoint[]>([]);
        const familyFilter = ref<'all' | Firewall.DockerGuardEndpoint['family']>('all');
        const formRef = ref<FormInstance>();
        const sourceAddressRefs = ref<Array<{ focus: () => void }>>([]);
        const form = reactive<PolicyForm>({
            mode: 'deny_sources',
            sources: [''],
        });
        const activeContainer = computed(() =>
            __panelSetupProps.containers.find((row) => row.key === activeContainerKey.value),
        );
        const activePortGroups = computed(() => activeContainer.value?.portGroups || []);
        const filteredPortGroups = computed(() =>
            familyFilter.value === 'all'
                ? activePortGroups.value
                : activePortGroups.value.filter((group) => group.endpoint.family === familyFilter.value),
        );
        const selectedEndpoints = computed(() =>
            filteredPortGroups.value
                .filter((group) => selectedGroupKeys.value.has(group.key))
                .flatMap((group) => group.endpoints),
        );
        const allSelected = computed(
            () =>
                filteredPortGroups.value.length > 0 && selectedGroupKeys.value.size === filteredPortGroups.value.length,
        );
        const selectionIndeterminate = computed(
            () => selectedGroupKeys.value.size > 0 && selectedGroupKeys.value.size < filteredPortGroups.value.length,
        );
        const hasMixedFamilies = computed(
            () => new Set(policyEndpoints.value.map((endpoint) => endpoint.family)).size > 1,
        );
        const normalizeSources = (sources: string[]) =>
            [...new Set(sources.map((source) => source.trim()).filter(Boolean))].sort();
        const policyConfigKey = (endpoint: Firewall.DockerGuardEndpoint) =>
            JSON.stringify([endpoint.mode || '', normalizeSources(endpoint.sources || [])]);
        const policyConfigConsistent = computed(() => {
            const first = policyEndpoints.value[0];
            return (
                !first ||
                policyEndpoints.value.every((endpoint) => policyConfigKey(endpoint) === policyConfigKey(first))
            );
        });
        const policyUUIDs = (endpoints: Firewall.DockerGuardEndpoint[]) => [
            ...new Set(endpoints.map((endpoint) => endpoint.policyUUID).filter(Boolean) as string[]),
        ];
        const selectedPolicyUUIDs = computed(() => policyUUIDs(selectedEndpoints.value));
        const sourcesLabel = computed(() =>
            form.mode === 'allow_sources'
                ? i18n.global.t('firewall.allowedSources')
                : i18n.global.t('firewall.deniedSources'),
        );
        const statusMessage = (endpoint: Firewall.DockerGuardEndpoint) =>
            dockerGuardEndpointStatusMessage(__panelSetupProps.base, endpoint);
        const validateSources = (_rule: unknown, value: string[], callback: ValidationCallback) => {
            const sources = splitTagValues(value || []);
            if (['deny_sources', 'allow_sources'].includes(form.mode) && sources.length === 0) {
                callback(new Error(i18n.global.t('commons.rule.requiredInput')));
                return;
            }
            if (
                sources.some((source) =>
                    policyEndpoints.value.some((endpoint) => !isValidDockerGuardSource(endpoint.family, source)),
                )
            ) {
                callback(new Error(i18n.global.t('commons.rule.ip')));
                return;
            }
            callback();
        };
        const rules = reactive<FormRules>({
            mode: [{ required: true, message: i18n.global.t('commons.rule.requiredSelect'), trigger: 'change' }],
            sources: [{ validator: validateSources, trigger: ['blur', 'change'] }],
        });
        const acceptParams = (container: Firewall.DockerGuardContainer) => {
            activeContainerKey.value = container.key;
            familyFilter.value = __panelSetupProps.base.ipv6Enabled === false ? 'ipv4' : 'all';
            selectedGroupKeys.value.clear();
            drawerVisible.value = true;
        };
        const changeFamilyFilter = () => {
            selectedGroupKeys.value.clear();
        };
        const changeAllSelection = (checked: boolean) => {
            selectedGroupKeys.value = new Set(checked ? filteredPortGroups.value.map((group) => group.key) : []);
        };
        const changeSelection = (key: string, checked: boolean) => {
            if (checked) {
                selectedGroupKeys.value.add(key);
            } else {
                selectedGroupKeys.value.delete(key);
            }
        };
        const toggleSelection = (key: string) => {
            changeSelection(key, !selectedGroupKeys.value.has(key));
        };
        const openPolicy = (endpoints: Firewall.DockerGuardEndpoint[]) => {
            if (!endpoints.length) return;
            const endpointToDiagnose = endpoints.find(
                (endpoint) => dockerGuardManagementTarget(endpoint) === 'needs_diagnosis',
            );
            if (endpointToDiagnose) {
                MsgWarning(dockerGuardEndpointManagementMessage(endpointToDiagnose));
                return;
            }
            const targets = new Set(endpoints.map(dockerGuardManagementTarget));
            if (targets.size !== 1) {
                MsgWarning(i18n.global.t('firewall.dockerTrafficPathMixed'));
                return;
            }
            const target = [...targets][0];
            if (target === 'host_firewall') {
                MsgWarning(i18n.global.t('firewall.dockerInputUseHostFirewall'));
                return;
            }
            policyEndpoints.value = endpoints;
            const first = endpoints[0];
            const mode = first.mode || 'deny_sources';
            form.mode = hasMixedFamilies.value
                ? 'deny_all'
                : policyConfigConsistent.value &&
                    (mode === 'deny_sources' || mode === 'allow_sources' || mode === 'deny_all')
                  ? mode
                  : '';
            form.sources =
                policyConfigConsistent.value && first.sources?.length
                    ? first.sources.map((source) => formatHostAddress(source, first.family))
                    : [''];
            policyVisible.value = true;
            nextTick(() => formRef.value?.clearValidate());
        };
        const addSourceAddress = () => {
            form.sources.push('');
            nextTick(() => sourceAddressRefs.value.at(-1)?.focus());
        };
        const addSourceAddressOnEnter = (index: number) => {
            if (!form.sources[index]?.trim()) return;
            if (index < form.sources.length - 1) {
                sourceAddressRefs.value[index + 1]?.focus();
                return;
            }
            addSourceAddress();
        };
        const removeSourceAddress = (index: number) => {
            form.sources.splice(index, 1);
            if (form.sources.length === 0) form.sources.push('');
        };
        const submitPolicy = async () => {
            if (savingPolicy.value) return;
            const valid = await formRef.value?.validate().catch(() => false);
            if (!valid || !form.mode) return;
            const mode = form.mode;
            const sources = mode === 'deny_all' ? [] : splitTagValues(form.sources);
            if (policyEndpoints.value.length > FIREWALL_BATCH_LIMIT) {
                MsgError(i18n.global.t('firewall.batchLimit', [FIREWALL_BATCH_LIMIT]));
                return;
            }
            savingPolicy.value = true;
            try {
                const result = await rpc.firewall.upsertDockerPolicies({
                    policies: policyEndpoints.value.map(({ family, hostIP, hostPort, protocol }) => ({
                        family,
                        hostIP,
                        hostPort,
                        protocol,
                        mode,
                        sources,
                    })),
                } as any);
                if (!result.taskId || !result.queued) {
                    MsgError(i18n.global.t('commons.msg.operationFailed'));
                    return;
                }
                policyVisible.value = false;
                drawerVisible.value = false;
                selectedGroupKeys.value.clear();
                ctx.emit('created', result.taskId);
            } catch (error) {
                MsgError(
                    getHttpResponseMessage(error) ||
                        (error && getErrorMessage(error)) ||
                        i18n.global.t('commons.res.commonError'),
                );
            } finally {
                savingPolicy.value = false;
            }
        };
        const remove = async (endpoints: Firewall.DockerGuardEndpoint[], batch: boolean) => {
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
            try {
                const result = await rpc.firewall.deleteDockerPolicies({ uuids });
                if (!result.taskId || !result.queued) {
                    MsgError(i18n.global.t('commons.msg.operationFailed'));
                    return;
                }
                selectedGroupKeys.value.clear();
                drawerVisible.value = false;
                ctx.emit('created', result.taskId);
            } catch (error) {
                MsgError(
                    getHttpResponseMessage(error) ||
                        (error && getErrorMessage(error)) ||
                        i18n.global.t('commons.res.commonError'),
                );
            }
        };
        const portMappingLabel = (row: Firewall.DockerGuardPortGroup) => {
            const ports = row.endpoints.map((endpoint) => endpoint.containerPort).filter(Boolean) as number[];
            if (!ports.length) return row.label;
            const value = ports.length === 1 ? `${ports[0]}` : `${ports[0]}-${ports[ports.length - 1]}`;
            const publishedEndpoint = row.label.replace(`/${row.endpoint.protocol}`, '');
            return `${publishedEndpoint} → ${value}/${row.endpoint.protocol}`;
        };
        const protectionSummary = (row: Firewall.DockerGuardEndpoint) => {
            const target = dockerGuardManagementTarget(row);
            if (!row.policyUUID) {
                if (target === 'host_firewall') return i18n.global.t('firewall.dockerInputUseHostFirewall');
                if (target === 'needs_diagnosis') return dockerGuardEndpointManagementMessage(row);
                return i18n.global.t('firewall.dockerGuardUnprotected');
            }
            let summary = i18n.global.t(row.mode ? 'firewall.denyAll' : 'firewall.accept');
            if (row.mode === 'deny_sources') {
                summary = `${i18n.global.t('firewall.deny')}: ${formatHostAddressList(row.sources, row.family)}`;
            } else if (row.mode === 'accept_all') {
                summary = i18n.global.t('firewall.acceptAll');
            } else if (row.mode === 'accept_sources') {
                summary = `${i18n.global.t('firewall.acceptSources')}: ${formatHostAddressList(row.sources, row.family)}`;
            } else if (row.mode === 'allow_sources' && row.sources.length) {
                summary = `${i18n.global.t('firewall.allow')}: ${formatHostAddressList(row.sources, row.family)}`;
            }
            return row.effective ? summary : `${summary} · ${i18n.global.t('firewall.notEffective')}`;
        };
        ctx.expose({ acceptParams, openPolicy });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(drawerVisible)}
                    onUpdate:modelValue={($v) => {
                        drawerVisible.value = $v as any;
                    }}
                    header={$t('firewall.portDetails')}
                    resource={unref(activeContainer)?.name || ''}
                    size="large"
                    v-slots={{
                        content: () => (
                            <>
                                <div class={'port-detail-toolbar'}>
                                    <ElCheckbox
                                        border
                                        model-value={unref(allSelected)}
                                        indeterminate={unref(selectionIndeterminate)}
                                        onChange={($event?: any) => {
                                            (changeAllSelection as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.selectAll')}
                                    </ElCheckbox>
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            disabled={unref(selectedEndpoints).length === 0}
                                            onClick={($event?: any) => {
                                                openPolicy(unref(selectedEndpoints));
                                            }}
                                        >
                                            {$t('commons.button.set')}
                                        </ElButton>,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                    {withDirectives(
                                        <ElButton
                                            disabled={unref(selectedPolicyUUIDs).length === 0}
                                            onClick={($event?: any) => {
                                                remove(unref(selectedEndpoints), true);
                                            }}
                                        >
                                            {$t('commons.button.delete')}
                                        </ElButton>,
                                        [
                                            [permissionDirective, true],
                                            [nodeAdminDirective, true],
                                        ],
                                    )}
                                    <ElSelect
                                        modelValue={unref(familyFilter)}
                                        onUpdate:modelValue={($v) => {
                                            familyFilter.value = $v as any;
                                        }}
                                        placeholder={$t('firewall.addressFamily')}
                                        onChange={($event?: any) => {
                                            (changeFamilyFilter as any)($event);
                                        }}
                                        class={'port-family-filter'}
                                    >
                                        <ElOption label={$t('commons.table.all')} value="all" />
                                        <ElOption label="IPv4" value="ipv4" />
                                        <ElOption label="IPv6" value="ipv6" />
                                    </ElSelect>
                                </div>
                                <div class={'port-card-grid'}>
                                    {(unref(filteredPortGroups) || []).map((group) => (
                                        <ElCard
                                            shadow="never"
                                            onClick={($event?: any) => {
                                                toggleSelection(group.key);
                                            }}
                                            class={cn('port-detail-card', {
                                                'is-selected': unref(selectedGroupKeys).has(group.key),
                                            })}
                                            key={group.key}
                                        >
                                            <div class={'port-card-header'}>
                                                <div class={'port-card-title'}>
                                                    <ElCheckbox
                                                        model-value={unref(selectedGroupKeys).has(group.key)}
                                                        onClick={($event?: any) => {
                                                            $event.stopPropagation();
                                                        }}
                                                        onChange={($event?: any) => {
                                                            (checked: boolean) => changeSelection(group.key, checked);
                                                        }}
                                                    />
                                                    <ElTooltip
                                                        content={portMappingLabel(group)}
                                                        placement="top"
                                                        show-after={400}
                                                    >
                                                        <span class={'port-mapping'}>{portMappingLabel(group)}</span>
                                                    </ElTooltip>
                                                </div>
                                                <div class={'port-card-actions'}>
                                                    {withDirectives(
                                                        <ElButton
                                                            type="primary"
                                                            link
                                                            size="small"
                                                            onClick={($event?: any) => {
                                                                $event.stopPropagation();
                                                                openPolicy(group.endpoints);
                                                            }}
                                                        >
                                                            {$t('commons.button.set')}
                                                        </ElButton>,
                                                        [
                                                            [permissionDirective, true],
                                                            [nodeAdminDirective, true],
                                                        ],
                                                    )}
                                                    {group.endpoint.policyUUID
                                                        ? withDirectives(
                                                              <ElButton
                                                                  type="primary"
                                                                  link
                                                                  size="small"
                                                                  onClick={($event?: any) => {
                                                                      $event.stopPropagation();
                                                                      remove(group.endpoints, false);
                                                                  }}
                                                              >
                                                                  {$t('commons.button.delete')}
                                                              </ElButton>,
                                                              [
                                                                  [permissionDirective, true],
                                                                  [nodeAdminDirective, true],
                                                              ],
                                                          )
                                                        : null}
                                                </div>
                                            </div>
                                            <div class={'port-card-field'}>
                                                <span class={'port-card-label'}>{$t('firewall.protection')}</span>
                                                <ElTooltip
                                                    content={protectionSummary(group.endpoint)}
                                                    placement="top"
                                                    show-after={400}
                                                >
                                                    <span
                                                        class={cn('port-card-value', {
                                                            'is-warning': !group.endpoint.effective,
                                                        })}
                                                    >
                                                        {protectionSummary(group.endpoint)}
                                                    </span>
                                                </ElTooltip>
                                            </div>
                                            {group.endpoint.policyUUID && !group.endpoint.effective ? (
                                                <div class={'port-card-field'}>
                                                    <span class={'port-card-label'}>{$t('commons.table.message')}</span>
                                                    <ElTooltip
                                                        content={statusMessage(group.endpoint)}
                                                        placement="top"
                                                        show-after={400}
                                                    >
                                                        <span class={'port-card-value is-warning'}>
                                                            {statusMessage(group.endpoint)}
                                                        </span>
                                                    </ElTooltip>
                                                </div>
                                            ) : null}
                                        </ElCard>
                                    ))}
                                </div>
                            </>
                        ),
                    }}
                />
                <DialogPro
                    modelValue={unref(policyVisible)}
                    onUpdate:modelValue={($v) => {
                        policyVisible.value = $v as any;
                    }}
                    title={$t('firewall.dockerGuardPolicy')}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        policyVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    loading={unref(savingPolicy)}
                                    onClick={($event?: any) => {
                                        (submitPolicy as any)($event);
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    <ElForm ref={formRef} model={form} rules={rules} label-position="top">
                        {unref(hasMixedFamilies) ? (
                            <ElAlert
                                type="warning"
                                closable={false}
                                show-icon
                                title={$t('firewall.dockerGuardMixedFamilyHelper')}
                                class={'mixed-family-alert'}
                            />
                        ) : null}
                        {!unref(policyConfigConsistent) ? (
                            <ElAlert
                                type="warning"
                                closable={false}
                                show-icon
                                title={$t('firewall.dockerGuardInconsistentConfigHelper')}
                                class={'mixed-family-alert'}
                            />
                        ) : null}
                        <ElFormItem label={$t('firewall.protectionMode')} prop="mode">
                            <ElRadioGroup
                                modelValue={form.mode}
                                onUpdate:modelValue={($v) => {
                                    form.mode = $v as any;
                                }}
                            >
                                <ElRadio value="deny_sources" disabled={unref(hasMixedFamilies)}>
                                    {$t('firewall.denySources')}
                                </ElRadio>
                                <ElRadio value="allow_sources" disabled={unref(hasMixedFamilies)}>
                                    {$t('firewall.allowSources')}
                                </ElRadio>
                                <ElRadio value="deny_all">{$t('firewall.denyAll')}</ElRadio>
                            </ElRadioGroup>
                        </ElFormItem>
                        {form.mode && form.mode !== 'deny_all' ? (
                            <ElFormItem label={unref(sourcesLabel)} prop="sources">
                                {(form.sources || []).map((_, index) => (
                                    <div class={'source-address-row mt-2'} key={index}>
                                        <ElInput
                                            ref={sourceAddressRefs}
                                            modelValue={form.sources[index]}
                                            onUpdate:modelValue={($v) => {
                                                form.sources[index] = typeof $v === 'string' ? $v.trim() : $v;
                                            }}
                                            clearable
                                            placeholder={$t('firewall.sourceAddressPlaceholder')}
                                            onKeyup={($event?: any) => {
                                                $event.preventDefault();
                                                if (!($event.key === 'Enter')) return;
                                                addSourceAddressOnEnter(index);
                                            }}
                                            class={'source-address-input'}
                                            v-slots={{
                                                append: () => (
                                                    <>
                                                        <ElButton
                                                            icon="Delete"
                                                            onClick={($event?: any) => {
                                                                removeSourceAddress(index);
                                                            }}
                                                        />
                                                    </>
                                                ),
                                            }}
                                        />
                                    </div>
                                ))}
                                <ElButton
                                    onClick={($event?: any) => {
                                        (addSourceAddress as any)($event);
                                    }}
                                    class={'mt-2'}
                                >
                                    {$t('commons.button.add')}
                                </ElButton>
                            </ElFormItem>
                        ) : null}
                    </ElForm>
                </DialogPro>
            </>
        );
    },
    options,
);
