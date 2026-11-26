import { $t } from '@/utils/i18n-t';
import { Firewall } from '@/types/firewall';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import {
    FIREWALL_BATCH_LIMIT,
    formatHostAddress,
    inferAddressFamily,
    isValidIPOrCIDR,
    isValidPortRange,
    normalizePortRange,
    splitTagValues,
} from '@/pages/hosts/_components/firewall/utils/validation';
interface SourceAddressItem {
    family: Firewall.Family;
    address: string;
}
type ValidationCallback = (error?: Error) => void;
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
    created: (arg0?: string) => true,
};

const options = {
    name: 'operate',
    props: {},
    emits: emits,
    __scopeId: 'data-v-42d71d01',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const provider = ref<Firewall.Provider>('iptables');
        const mode = ref<'create' | 'edit'>('create');
        const editingTarget = ref<Firewall.RuleTarget>();
        const editAccess = ref<'rule' | 'metadata' | 'description'>('rule');
        const descriptionOnly = computed(() => editAccess.value === 'description');
        const contentReadonly = computed(() => editAccess.value !== 'rule');
        const editingRule = ref<Firewall.Rule>();
        const originalFormRule = ref<Firewall.Rule>();
        const drawerVisible = ref(false);
        const loading = ref(false);
        const formRef = ref<FormInstance>();
        const sourceAddressRefs = ref<Array<{ focus: () => void }>>([]);
        const destinationPortRefs = ref<Array<{ focus: () => void }>>([]);
        const previewRules = ref<Firewall.Rule[]>([]);
        const positionRanges = ref<Partial<Record<Firewall.Family, Firewall.PositionRange>>>({});
        const firewalldPrioritySupported = ref(true);
        const form = reactive({
            protocol: 'tcp',
            sourceAddresses: [{ family: 'ipv4', address: '' }] as SourceAddressItem[],
            sourcePort: '',
            destinationAddress: '',
            destinationPorts: [''] as string[],
            action: 'accept' as Firewall.Action,
            priority: undefined as number | undefined,
            description: '',
        });
        const defaultFamily = (): Firewall.Family => 'ipv4';
        const hasRuleTarget = () =>
            splitTagValues(form.sourceAddresses.map((item) => item.address)).length > 0 ||
            Boolean(form.destinationAddress) ||
            Boolean(form.sourcePort) ||
            splitTagValues(form.destinationPorts).length > 0;
        const validateSourceAddresses = (_rule: unknown, value: SourceAddressItem[], callback: ValidationCallback) => {
            const addresses = splitTagValues((value || []).map((item) => item.address));
            if (addresses.some((address) => !isValidIPOrCIDR(address))) {
                callback(new Error(i18n.global.t('commons.rule.ip')));
                return;
            }
            if (mode.value === 'edit' && addresses.length > 1) {
                callback(
                    new Error(
                        `${i18n.global.t('firewall.sourceIP')}: ${i18n.global.t('commons.msg.notSupportOperation')}`,
                    ),
                );
                return;
            }
            if (!hasRuleTarget()) {
                callback(new Error(i18n.global.t('firewall.ruleTargetRequired')));
                return;
            }
            callback();
        };
        const validateDestinationPorts = (_rule: unknown, value: string[], callback: ValidationCallback) => {
            const ports = splitTagValues(value || []);
            if (ports.some((port) => !isValidPortRange(port))) {
                callback(new Error(i18n.global.t('commons.rule.port')));
                return;
            }
            callback();
        };
        const rules = reactive<FormRules>({
            protocol: [Rules.requiredSelect],
            action: [Rules.requiredSelect],
            sourceAddresses: [{ validator: validateSourceAddresses, trigger: ['blur', 'change'] }],
            destinationPorts: [{ validator: validateDestinationPorts, trigger: ['blur', 'change'] }],
        });
        const portProtocol = computed(() => ['tcp', 'udp', 'tcp/udp'].includes(form.protocol));
        const isWildcardAddress = (_family: Firewall.Family, address?: string) => !address?.trim();
        const priorityFieldLabel = computed(() => i18n.global.t('firewall.priority'));
        const showPriorityField = computed(() => {
            if (provider.value !== 'firewalld') return mode.value === 'edit';
            return (
                firewalldPrioritySupported.value &&
                (mode.value === 'create' || editingRule.value?.nativeKind === 'rich_rule')
            );
        });
        const selectedPositionRanges = computed(() => {
            const families =
                mode.value === 'edit' && editingRule.value
                    ? [editingRule.value.scope.family]
                    : [...new Set(form.sourceAddresses.map((item) => item.family))];
            if (families.length === 0) return [{ min: 1, max: 1 }];
            return families.map((family) => positionRanges.value[family] || { min: 1, max: 1 });
        });
        const priorityMin = computed(() => Math.max(...selectedPositionRanges.value.map((range) => range.min)));
        const priorityMax = computed(() => Math.min(...selectedPositionRanges.value.map((range) => range.max)));
        const normalizeSourceAddresses = () => {
            const seen = new Set<string>();
            let normalized = form.sourceAddresses.flatMap((item) => {
                const addresses = splitTagValues([item.address]);
                if (addresses.length === 0) return [{ family: item.family, address: '' }];
                return addresses.flatMap((address) => {
                    const family = inferAddressFamily(address);
                    const key = `${family}:${address}`;
                    if (seen.has(key)) return [];
                    seen.add(key);
                    return [{ family, address }];
                });
            });
            if (normalized.some((item) => item.address)) {
                normalized = normalized.filter((item) => item.address);
            }
            if (mode.value === 'edit' && normalized.length > 1) {
                MsgError(`${i18n.global.t('firewall.sourceIP')}: ${i18n.global.t('commons.msg.notSupportOperation')}`);
                return false;
            }
            const fallback = form.sourceAddresses[0] || { family: 'ipv4', address: '' };
            form.sourceAddresses =
                mode.value === 'edit'
                    ? [normalized[0] || { ...fallback, address: '' }]
                    : normalized.length > 0
                      ? normalized
                      : [{ ...fallback, address: '' }];
            return true;
        };
        const normalizeDestinationPorts = (values = form.destinationPorts) => {
            const normalized = splitTagValues(values).map(normalizePortRange);
            if (provider.value === 'ufw' || provider.value === 'iptables') {
                form.destinationPorts = [normalized.join(',')];
                return true;
            }
            if (mode.value === 'edit' && normalized.length > 1) {
                MsgError(i18n.global.t('commons.msg.notSupportOperation'));
                return false;
            }
            form.destinationPorts = normalized.length > 0 ? normalized : [''];
            return true;
        };
        const addSourceAddress = () => {
            const family = form.sourceAddresses.at(-1)?.family || 'ipv4';
            form.sourceAddresses.push({ family, address: '' });
        };
        const addSourceAddressOnEnter = async (index: number) => {
            await nextTick();
            if (mode.value !== 'create' || !form.sourceAddresses[index]?.address.trim()) return;
            if (index < form.sourceAddresses.length - 1) {
                sourceAddressRefs.value[index + 1]?.focus();
                return;
            }
            addSourceAddress();
            await nextTick();
            sourceAddressRefs.value.at(-1)?.focus();
        };
        const removeSourceAddress = (index: number) => {
            form.sourceAddresses.splice(index, 1);
        };
        const addRuleRow = () => {
            form.destinationPorts.push('');
        };
        const addDestinationPortOnEnter = async (index: number) => {
            if (mode.value !== 'create' || !portProtocol.value || !form.destinationPorts[index]?.trim()) return;
            if (index < form.destinationPorts.length - 1) {
                destinationPortRefs.value[index + 1]?.focus();
                return;
            }
            addRuleRow();
            await nextTick();
            destinationPortRefs.value.at(-1)?.focus();
        };
        const removeRuleRow = (index: number) => {
            form.destinationPorts.splice(index, 1);
        };
        const resetForm = () => {
            form.protocol = 'tcp';
            form.sourceAddresses = [{ family: defaultFamily(), address: '' }];
            form.sourcePort = '';
            form.destinationAddress = '';
            form.destinationPorts = [''];
            form.action = 'accept';
            form.priority = undefined;
            form.description = '';
            editingTarget.value = undefined;
            editAccess.value = 'rule';
            editingRule.value = undefined;
            originalFormRule.value = undefined;
            resetBatch();
            formRef.value?.clearValidate();
        };
        const acceptParams = (
            value: Firewall.Provider,
            item?: Firewall.InventoryItem,
            ranges: Partial<Record<Firewall.Family, Firewall.PositionRange>> = {},
            supportsExplicitPriority = true,
        ) => {
            provider.value = value;
            firewalldPrioritySupported.value = supportsExplicitPriority;
            positionRanges.value = ranges;
            mode.value = item?.observed?.instanceKey ? 'edit' : 'create';
            resetForm();
            if (mode.value === 'edit') {
                editAccess.value =
                    item.observed.parseStatus !== 'supported' ? 'description' : item.isWhitelist ? 'metadata' : 'rule';
            }
            if (mode.value === 'edit' && item?.observed?.instanceKey) {
                const rule = item.rule;
                const currentPosition = item.observed?.locator.position || rule.orderIndex;
                editingTarget.value = { scope: item.rule.scope, instanceKey: item.observed.instanceKey };
                editingRule.value = {
                    ...rule,
                    scope: { ...rule.scope },
                    orderIndex: provider.value === 'firewalld' ? undefined : currentPosition,
                };
                form.protocol =
                    provider.value === 'ufw' && rule.protocol === 'all' && rule.destinationPort
                        ? 'tcp/udp'
                        : rule.protocol;
                form.sourceAddresses = [
                    {
                        family: rule.scope.family,
                        address: formatHostAddress(rule.sourceAddress, rule.scope.family),
                    },
                ];
                form.sourcePort = rule.sourcePort || '';
                form.destinationAddress = formatHostAddress(rule.destinationAddress, rule.scope.family);
                form.destinationPorts = [rule.destinationPort || ''];
                if (form.destinationPorts.length === 0) form.destinationPorts = [''];
                form.action = rule.action === 'reject' ? 'drop' : rule.action;
                form.priority = provider.value === 'firewalld' ? rule.priority : currentPosition || priorityMax.value;
                form.description = rule.description || '';
                originalFormRule.value = buildRule();
            }
            drawerVisible.value = true;
        };
        watch(priorityMax, (max) => {
            if (form.priority !== undefined && form.priority > max) form.priority = max;
        });
        watch(priorityMin, (min) => {
            if (form.priority !== undefined && form.priority < min) form.priority = min;
        });
        const handleClose = () => {
            drawerVisible.value = false;
            mode.value = 'create';
            resetBatch();
        };
        const resetBatch = () => {
            previewRules.value = [];
        };
        const changeProtocol = () => {
            if (!portProtocol.value) {
                form.sourcePort = '';
                form.destinationPorts = [''];
            }
        };
        const buildRule = (
            source: SourceAddressItem = form.sourceAddresses[0] || { family: 'ipv4', address: '' },
            destinationPort = form.destinationPorts[0] || '',
            protocol = form.protocol,
        ): Firewall.Rule => {
            const family = source.address
                ? source.family
                : protocol === 'icmpv6'
                  ? 'ipv6'
                  : protocol === 'icmp'
                    ? 'ipv4'
                    : mode.value === 'edit'
                      ? editingRule.value?.scope.family || source.family
                      : provider.value === 'firewalld'
                        ? 'inet'
                        : source.family;
            const action =
                mode.value === 'edit' && editingRule.value?.action === 'reject' && form.action === 'drop'
                    ? 'reject'
                    : form.action;
            return {
                ...(editingRule.value || {}),
                scope:
                    provider.value === 'iptables' || provider.value === 'nftables'
                        ? {
                              provider: provider.value,
                              family,
                              table: 'filter',
                              chain:
                                  mode.value === 'edit'
                                      ? editingRule.value?.scope.chain || '1PANEL_BASIC'
                                      : '1PANEL_BASIC',
                              direction: 'input',
                          }
                        : provider.value === 'firewalld'
                          ? {
                                provider: provider.value,
                                family,
                                zone: 'public',
                                direction: 'input',
                            }
                          : {
                                provider: provider.value,
                                family,
                                chain: 'incoming',
                                direction: 'input',
                            },
                protocol:
                    mode.value === 'edit' && provider.value === 'ufw' && protocol === 'tcp/udp' ? 'all' : protocol,
                sourceAddress: isWildcardAddress(source.family, source.address) ? '' : source.address,
                sourcePort: form.sourcePort,
                destinationAddress: form.destinationAddress,
                destinationPort,
                action,
                priority:
                    provider.value === 'firewalld' && firewalldPrioritySupported.value ? form.priority : undefined,
                orderIndex: provider.value === 'firewalld' || mode.value === 'create' ? undefined : form.priority,
                description: form.description,
            };
        };
        const editableFieldLabels: Array<[keyof Firewall.Rule, string]> = [
            ['protocol', 'commons.table.protocol'],
            ['sourceAddress', 'firewall.sourceIP'],
            ['sourcePort', 'firewall.sourcePort'],
            ['destinationAddress', 'firewall.destIP'],
            ['destinationPort', 'firewall.destPort'],
            ['action', 'firewall.action'],
            ['priority', 'firewall.priority'],
            ['orderIndex', 'firewall.priority'],
            ['description', 'commons.table.description'],
        ];
        const changedRuleFields = (before: Firewall.Rule, after: Firewall.Rule) =>
            editableFieldLabels
                .filter(([field]) => JSON.stringify(before[field] ?? '') !== JSON.stringify(after[field] ?? ''))
                .map(([field]) => field);
        const isMetadataOnlyEdit = (before: Firewall.Rule, after: Firewall.Rule) =>
            changedRuleFields(before, after).every((field) =>
                ['description', 'orderIndex', 'priority'].includes(field),
            );
        const buildPreviewRules = () => {
            if (!normalizeSourceAddresses()) return false;
            if (!normalizeDestinationPorts()) return false;
            const addresses =
                form.sourceAddresses.length > 0 ? form.sourceAddresses : [{ family: 'ipv4' as const, address: '' }];
            const ports = form.destinationPorts.length > 0 ? form.destinationPorts : [''];
            const protocolCount = (port: string) => {
                if (form.protocol === 'tcp/udp') {
                    return provider.value === 'ufw' && port && !/[,-]/.test(port) ? 1 : 2;
                }
                return provider.value === 'ufw' && form.protocol === 'all' && /[,-]/.test(port) ? 2 : 1;
            };
            const count = addresses.length * ports.reduce((total, port) => total + protocolCount(port), 0);
            if (count > FIREWALL_BATCH_LIMIT) {
                MsgError(i18n.global.t('firewall.batchLimit', [FIREWALL_BATCH_LIMIT]));
                return false;
            }
            const rules = addresses.flatMap((address) =>
                ports.flatMap((port) =>
                    (form.protocol === 'tcp/udp'
                        ? provider.value === 'ufw' && port && !port.includes(',')
                            ? ['all']
                            : ['tcp', 'udp']
                        : [form.protocol]
                    ).map((protocol) => buildRule(address, port, protocol)),
                ),
            );
            if (mode.value === 'edit' && rules.length !== 1) {
                MsgError(i18n.global.t('commons.msg.notSupportOperation'));
                return false;
            }
            previewRules.value = rules;
            return true;
        };
        const submitCreateTask = async () => {
            if (!(await prepareRulesFromForm())) return;
            const result = await rpc.firewall.createRules({
                items: previewRules.value.map((rule) => ({ rule: rule as any, sourceKind: 'user' })),
            } as any);
            if (!result.taskId || !result.queued) {
                MsgError(i18n.global.t('commons.msg.operationFailed'));
                return;
            }
            drawerVisible.value = false;
            ctx.emit('created', result.taskId);
        };
        const prepareRulesFromForm = async () => {
            if (!formRef.value) return previewRules.value.length > 0;
            const valid = await formRef.value.validate().catch(() => false);
            if (!valid) return false;
            if (!normalizeSourceAddresses()) return false;
            if (!normalizeDestinationPorts()) return false;
            return buildPreviewRules();
        };
        const executeEdit = async () => {
            if (!editingTarget.value || previewRules.value.length === 0) return;
            const updatedRule = previewRules.value[0];
            const before = originalFormRule.value || editingRule.value;
            const changed = before ? changedRuleFields(before, updatedRule) : [];
            if (changed.length === 0) {
                drawerVisible.value = false;
                return;
            }
            try {
                await ElMessageBox.confirm(i18n.global.t('firewall.editRuleConfirm'), i18n.global.t('firewall.edit'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'warning',
                });
            } catch {
                return;
            }
            let request: Firewall.UpdateRequest = { rule: updatedRule };
            if (before && isMetadataOnlyEdit(before, updatedRule)) {
                const description = changed.includes('description') ? updatedRule.description || '' : undefined;
                if (changed.includes('priority')) {
                    request = { priority: updatedRule.priority!, description };
                } else if (changed.includes('orderIndex')) {
                    request = { orderIndex: updatedRule.orderIndex!, description };
                } else {
                    request = { description: description || '' };
                }
            }
            await rpc.firewall.updateRule({
                scope: editingTarget.value!.scope as any,
                instanceKey: editingTarget.value!.instanceKey,
                ...request,
            } as any);
            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            ctx.emit('search');
            drawerVisible.value = false;
        };
        const onSubmit = async () => {
            if (loading.value) return;
            loading.value = true;
            try {
                if (mode.value === 'create') {
                    await submitCreateTask();
                } else if (
                    originalFormRule.value &&
                    (descriptionOnly.value || isMetadataOnlyEdit(originalFormRule.value, buildRule()))
                ) {
                    const rule = descriptionOnly.value
                        ? { ...originalFormRule.value, description: form.description }
                        : buildRule();
                    const changed = changedRuleFields(originalFormRule.value, rule);
                    if (changed.some((field) => field === 'priority' || field === 'orderIndex')) {
                        const value = rule.priority ?? rule.orderIndex;
                        if (
                            typeof value !== 'number' ||
                            !Number.isInteger(value) ||
                            value < priorityMin.value ||
                            value > priorityMax.value
                        ) {
                            MsgError(i18n.global.t('commons.rule.numberRange', [priorityMin.value, priorityMax.value]));
                            return;
                        }
                    }
                    previewRules.value = [rule];
                    await executeEdit();
                } else if (await prepareRulesFromForm()) {
                    await executeEdit();
                }
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t(unref(mode) === 'edit' ? 'firewall.edit' : 'firewall.create')}
                size="large"
                auto-close={!unref(loading)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                disabled={unref(loading)}
                                onClick={($event?: any) => {
                                    drawerVisible.value = false;
                                }}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            <ElButton
                                type="primary"
                                disabled={unref(loading)}
                                onClick={($event?: any) => {
                                    (onSubmit as any)($event);
                                }}
                            >
                                {$t('commons.button.submit')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                {unref(editAccess) === 'metadata' ? (
                    <ElAlert
                        type="info"
                        show-icon
                        closable={false}
                        title={$t('firewall.whitelistRuleProtected')}
                        class={'!mb-4'}
                    />
                ) : null}
                {withDirectives(
                    <ElForm ref={formRef} label-position="top" model={form} rules={rules}>
                        <ElFormItem label={$t('firewall.action')} prop="action">
                            <ElRadioGroup
                                modelValue={form.action}
                                onUpdate:modelValue={($v) => {
                                    form.action = $v as any;
                                }}
                                disabled={unref(contentReadonly)}
                            >
                                <ElRadioButton value="accept">{$t('firewall.accept')}</ElRadioButton>
                                <ElRadioButton value="drop">{$t('firewall.drop')}</ElRadioButton>
                            </ElRadioGroup>
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.protocol')} prop="protocol">
                            <ElSelect
                                modelValue={form.protocol}
                                onUpdate:modelValue={($v) => {
                                    form.protocol = $v as any;
                                }}
                                disabled={unref(contentReadonly)}
                                onChange={($event?: any) => {
                                    (changeProtocol as any)($event);
                                }}
                                class={'w-full'}
                            >
                                {unref(mode) === 'create' || unref(provider) === 'ufw' ? (
                                    <ElOption label="TCP/UDP" value="tcp/udp" />
                                ) : null}
                                <ElOption label="TCP" value="tcp" />
                                <ElOption label="UDP" value="udp" />
                                <ElOption label="ALL" value="all">
                                    <div class={'protocol-option'}>
                                        <span>{'ALL'}</span>
                                        <span class={'protocol-option-description'}>
                                            {$t('firewall.allProtocolHelper')}
                                        </span>
                                    </div>
                                </ElOption>
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label="IP" prop="sourceAddresses">
                            {(form.sourceAddresses || []).map((item, index) => (
                                <div class={'source-address-row mt-2'} key={index}>
                                    <ElInput
                                        ref={sourceAddressRefs}
                                        modelValue={item.address}
                                        onUpdate:modelValue={($v) => {
                                            item.address = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        disabled={unref(contentReadonly)}
                                        clearable
                                        placeholder={$t('firewall.sourceAddressPlaceholder')}
                                        onKeyup={($event?: any) => {
                                            $event.preventDefault();
                                            if (!($event.key === 'Enter')) return;
                                            addSourceAddressOnEnter(index);
                                        }}
                                        class={'source-address-select'}
                                        v-slots={{
                                            append: () => (
                                                <>
                                                    {unref(mode) === 'create' ? (
                                                        <ElButton
                                                            icon="Delete"
                                                            onClick={($event?: any) => {
                                                                removeSourceAddress(index);
                                                            }}
                                                        />
                                                    ) : null}
                                                </>
                                            ),
                                        }}
                                    />
                                </div>
                            ))}
                            {unref(mode) === 'create' ? (
                                <ElButton
                                    onClick={($event?: any) => {
                                        (addSourceAddress as any)($event);
                                    }}
                                    class={'mt-2'}
                                >
                                    {$t('commons.button.add')}
                                </ElButton>
                            ) : null}
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.port')} prop="destinationPorts">
                            {(form.destinationPorts || []).map((_, index) => (
                                <div class={'destination-port-row mt-2'} key={index}>
                                    <ElInput
                                        ref={destinationPortRefs}
                                        modelValue={form.destinationPorts[index]}
                                        onUpdate:modelValue={($v) => {
                                            form.destinationPorts[index] = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        clearable
                                        disabled={unref(contentReadonly) || !unref(portProtocol)}
                                        placeholder={$t('firewall.destinationPortPlaceholder')}
                                        onKeyup={($event?: any) => {
                                            $event.preventDefault();
                                            if (!($event.key === 'Enter')) return;
                                            addDestinationPortOnEnter(index);
                                        }}
                                        class={'destination-port-input'}
                                        v-slots={{
                                            append: () => (
                                                <>
                                                    {unref(mode) === 'create' ? (
                                                        <ElButton
                                                            icon="Delete"
                                                            disabled={unref(contentReadonly) || !unref(portProtocol)}
                                                            onClick={($event?: any) => {
                                                                removeRuleRow(index);
                                                            }}
                                                        />
                                                    ) : null}
                                                </>
                                            ),
                                        }}
                                    />
                                </div>
                            ))}
                            {unref(mode) === 'create' ? (
                                <ElButton
                                    disabled={unref(contentReadonly) || !unref(portProtocol)}
                                    onClick={($event?: any) => {
                                        (addRuleRow as any)($event);
                                    }}
                                    class={'mt-2'}
                                >
                                    {$t('commons.button.add')}
                                </ElButton>
                            ) : null}
                        </ElFormItem>
                        {unref(showPriorityField) ? (
                            <ElFormItem label={unref(priorityFieldLabel)}>
                                <ElInputNumber
                                    modelValue={form.priority}
                                    onUpdate:modelValue={($v) => {
                                        form.priority = $v as any;
                                    }}
                                    disabled={unref(descriptionOnly)}
                                    min={unref(priorityMin)}
                                    max={unref(priorityMax)}
                                    controls-position="right"
                                />
                                {!unref(descriptionOnly) ? (
                                    <span class={'priority-range'}>
                                        {unref(priorityMin)}
                                        {' ~ '}
                                        {unref(priorityMax)}
                                    </span>
                                ) : null}
                            </ElFormItem>
                        ) : null}
                        <ElFormItem label={$t('commons.table.description')}>
                            <ElInput
                                modelValue={form.description}
                                onUpdate:modelValue={($v) => {
                                    form.description = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                                clearable
                            />
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
