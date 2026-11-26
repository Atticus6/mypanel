import { $t } from '@/utils/i18n-t';
interface GPUGroup {
    description: string;
    id: number;
    name: string;
    imageType: string;
    revision: number;
    gpu: ModelGPUConfig;
    deployments: string[];
}
interface ModelGPUConfig {
    group?: { id: number; name: string; revision: number };
    numa?: { mode: 'off' | 'auto' | 'manual'; nodes: number[] };
    mode: 'all' | 'count' | 'devices';
    count?: number;
    error?: string;
    enabled: boolean;
    deviceIDs: string[];
    capabilities: string[];
}
interface ModelGPUDevice {
    index?: number;
    id: string;
    name: string;
    type: string;
    uuid?: string;
    numaNode?: number;
    available: boolean;
}
interface ModelNUMANode {
    id: number;
    cpus: string;
    memory: boolean;
}
import { InfoFilled } from '@element-plus/icons-vue';
import GPUTopology from '@/pages/views/ai/components/gpu-topology/index';
import { loadModelGPUDevices, listGPUGroups } from '@/api/modules/ai';
import i18n from '@/lang';
import { useGlobalStore } from '@/composables/useGlobalStore';
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';
import { cn } from '@/utils/cn';

interface CodemodProps {
    [key: string]: any;
    imageType?: string;
    collapsed?: boolean;
    groupEditor?: boolean;
    modelValue?: ModelGPUConfig;
}

const emits = {
    'update:modelValue': (value: ModelGPUConfig) => true,
};

type SlotsShape = {
    'device-meta': (arg?: unknown) => VNode[];
};

const options = {
    name: 'gpu-config',
    props: {
        imageType: String,
        collapsed: Boolean,
        groupEditor: Boolean,
        modelValue: { type: null },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-3f08fd1d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const GroupOperate = defineAsyncComponent(() => import('@/pages/views/ai/gpu/groups/operate/index'));
        const groupEditorVisible = ref(false);
        const { currentNode } = useGlobalStore();
        const model = computed({
            get: () => __panelSetupProps.modelValue,
            set: ($v) => ctx.emit('update:modelValue', $v),
        });
        const sectionRef = ref<HTMLDetailsElement>();
        const loading = ref(false);
        const gpuWarnings = ref<string[]>([]);
        const gpuDevices = ref<ModelGPUDevice[]>();
        const hasMultipleGPUs = computed(() => (gpuDevices.value?.length || 0) > 1);
        const numaNodes = ref<ModelNUMANode[]>([]);
        const numaBound = computed(() => Boolean(model.value.numa && model.value.numa.mode !== 'off'));
        const groups = ref<GPUGroup[]>([]);
        const groupsFailed = ref(false);
        const selectionMode = ref<'group' | 'custom'>('custom');
        const gpuSource = computed(() => (selectionMode.value === 'group' ? 'group' : model.value.mode));
        const compatibleGroups = computed(() =>
            groups.value.filter((group) => group.imageType === __panelSetupProps.imageType),
        );
        const currentGroup = computed(() => compatibleGroups.value.find((group) => group.id === model.value.group?.id));
        const sourceChanged = computed(
            () =>
                !groupsFailed.value &&
                model.value.group &&
                (!currentGroup.value || currentGroup.value.revision !== model.value.group.revision),
        );
        const groupSummary = computed(() => {
            const devices = model.value.deviceIDs
                .map((id) => gpuDevices.value?.find((device) => device.id === id)?.name || id)
                .join(', ');
            const config = model.value.numa;
            if (numaNodes.value.length <= 1 && !numaBound.value) return devices;
            const nodes =
                config?.mode === 'auto'
                    ? [
                          ...new Set(
                              selectedNUMAGPUs.value.map((device) => device.numaNode).filter((id) => id !== undefined),
                          ),
                      ]
                    : config?.nodes || [];
            return (
                devices +
                ' · ' +
                (config?.mode && config.mode !== 'off'
                    ? nodes
                          .map(
                              (id) => `NUMA ${id} · CPU ${numaNodes.value.find((node) => node.id === id)?.cpus || '—'}`,
                          )
                          .join(', ')
                    : i18n.global.t('aiTools.model.numaOff'))
            );
        });
        const groupRules = [
            {
                validator: (_rule: unknown, _value: unknown, callback: (error?: Error) => void) => {
                    let error = '';
                    if (model.value.enabled && hasMultipleGPUs.value && selectionMode.value === 'group') {
                        if (!model.value.group) error = i18n.global.t('aiTools.gpuGroup.selectRequired');
                        else if (numaError.value) error = numaError.value;
                        else if (!gpuDevices.value) error = i18n.global.t('aiTools.model.loadFailed');
                        else if (
                            model.value.deviceIDs.some(
                                (id) =>
                                    !gpuDevices.value?.some(
                                        (device) =>
                                            device.id === id &&
                                            device.available &&
                                            device.type === __panelSetupProps.imageType,
                                    ),
                            )
                        )
                            error = i18n.global.t('aiTools.model.gpuMissing');
                        else if (model.value.error) error = model.value.error;
                    }
                    callback(error ? new Error(error) : undefined);
                },
                trigger: 'change',
            },
        ];
        const changeSource = (source: 'group' | ModelGPUConfig['mode']) => {
            if (source === 'group') {
                selectionMode.value = 'group';
                return;
            }
            selectionMode.value = 'custom';
            model.value.group = undefined;
            model.value.error = undefined;
            if (model.value.mode !== source) {
                model.value.mode = source;
                model.value.deviceIDs = [];
                model.value.count = source === 'count' ? 1 : undefined;
            }
        };
        const applyGroup = (id: number) => {
            const group = compatibleGroups.value.find((item) => item.id === id);
            if (!group) return;
            model.value = {
                ...JSON.parse(JSON.stringify(group.gpu)),
                capabilities: model.value.capabilities,
                group: { id: group.id, name: group.name, revision: group.revision },
            };
        };
        const groupCreated = async (name: string) => {
            const version = requestVersion;
            const node = currentNode.value;
            loading.value = true;
            try {
                const { data } = await listGPUGroups(node);
                if (version !== requestVersion || node !== currentNode.value) return;
                groups.value = data || [];
                groupsFailed.value = false;
                const group = compatibleGroups.value.find((item) => item.name === name);
                if (group && selectionMode.value === 'group' && model.value.enabled) applyGroup(group.id);
            } catch {
                if (version === requestVersion && node === currentNode.value) groupsFailed.value = true;
            } finally {
                if (version === requestVersion) loading.value = false;
            }
        };
        watch([() => __panelSetupProps.imageType, currentNode], () => {
            groupEditorVisible.value = false;
        });
        const selectedNUMAGPUs = computed(() =>
            (gpuDevices.value || []).filter(
                (device) =>
                    device.type === __panelSetupProps.imageType &&
                    (model.value.mode === 'all' || model.value.deviceIDs.includes(device.id)),
            ),
        );
        const missingNUMANodes = computed(() =>
            (model.value.numa?.nodes || []).filter((id) => !numaNodes.value.some((node) => node.id === id)),
        );
        const numaError = computed(() => {
            const config = model.value.numa;
            if (!model.value.enabled || !config || config.mode === 'off') return '';
            let ids = config.nodes;
            if (config.mode === 'auto') {
                if (model.value.mode === 'count') return i18n.global.t('aiTools.model.numaCount');
                if (!gpuDevices.value) return i18n.global.t('aiTools.model.loadFailed');
                if (model.value.mode === 'devices' && !model.value.deviceIDs.length)
                    return i18n.global.t('aiTools.model.gpuSelectRequired');
                const devices = selectedNUMAGPUs.value;
                if (
                    !devices.length ||
                    (model.value.mode === 'devices' && devices.length !== model.value.deviceIDs.length) ||
                    devices.some((device) => !device.available || device.numaNode === undefined)
                ) {
                    return i18n.global.t('aiTools.model.numaUnknown');
                }
                ids = [...new Set(devices.map((device) => device.numaNode!))];
                if (ids.length !== 1) return i18n.global.t('aiTools.model.numaCross');
            }
            if (!ids.length) return i18n.global.t('aiTools.model.numaRequired');
            if (ids.some((id) => !numaNodes.value.some((node) => node.id === id && node.cpus && node.memory))) {
                return i18n.global.t('aiTools.model.numaUnavailable');
            }
            return '';
        });
        const numaRules = [
            {
                validator: (_rule: unknown, _value: unknown, callback: (error?: Error) => void) =>
                    callback(numaError.value ? new Error(numaError.value) : undefined),
                trigger: 'change',
            },
        ];
        const hasSupportedGPU = computed(() =>
            Boolean(gpuDevices.value?.some((item) => item.type === __panelSetupProps.imageType && item.available)),
        );
        const selectingDevices = computed(() => model.value.enabled && model.value.mode === 'devices');
        const gpuModeRules = [
            {
                validator: (_rule: unknown, _value: string, callback: (error?: Error) => void) => {
                    if (model.value.error) {
                        callback(new Error(model.value.error));
                    } else if (model.value.enabled && !gpuDevices.value) {
                        callback(new Error(i18n.global.t('aiTools.model.loadFailed')));
                    } else if (model.value.enabled && !hasSupportedGPU.value) {
                        callback(new Error(i18n.global.t('aiTools.model.gpuNotDetected')));
                    } else if (
                        model.value.enabled &&
                        (!['all', 'count', 'devices'].includes(model.value.mode) ||
                            (model.value.mode === 'count' && __panelSetupProps.imageType !== 'nvidia'))
                    ) {
                        callback(new Error(i18n.global.t('aiTools.model.gpuSelectRequired')));
                    } else {
                        callback();
                    }
                },
                trigger: 'change',
            },
        ];
        const gpuCountRules = [
            {
                validator: (_rule: unknown, value: number, callback: (error?: Error) => void) => {
                    const availableCount =
                        gpuDevices.value?.filter((item) => item.type === __panelSetupProps.imageType && item.available)
                            .length || 0;
                    if (
                        model.value.enabled &&
                        model.value.mode === 'count' &&
                        (!Number.isInteger(value) || value < 1)
                    ) {
                        callback(new Error(i18n.global.t('aiTools.model.gpuCountRequired')));
                    } else if (
                        model.value.enabled &&
                        model.value.mode === 'count' &&
                        availableCount > 0 &&
                        value > availableCount
                    ) {
                        callback(new Error(i18n.global.t('commons.rule.numberRange', [1, availableCount])));
                    } else {
                        callback();
                    }
                },
                trigger: 'change',
            },
        ];
        const gpuDeviceRules = [
            {
                required: true,
                validator: (_rule: unknown, value: string[], callback: (error?: Error) => void) => {
                    if (selectingDevices.value && !value.length) {
                        callback(new Error(i18n.global.t('aiTools.model.gpuSelectRequired')));
                    } else if (
                        selectingDevices.value &&
                        value.some(
                            (id) =>
                                !gpuDevices.value?.some(
                                    (device) =>
                                        device.id === id &&
                                        device.type === __panelSetupProps.imageType &&
                                        device.available,
                                ),
                        )
                    ) {
                        callback(new Error(i18n.global.t('aiTools.model.gpuMissing')));
                    } else {
                        callback();
                    }
                },
                trigger: 'change',
            },
        ];
        const changeEnabled = () => {
            model.value.error = undefined;
            if (model.value.enabled && sectionRef.value) {
                sectionRef.value.open = true;
            }
            if (!model.value.enabled) {
                model.value.group = undefined;
                selectionMode.value = 'custom';
                model.value.numa = { mode: 'off', nodes: [] };
                model.value.mode = 'all';
                model.value.count = undefined;
                model.value.deviceIDs = [];
            }
        };
        let requestVersion = 0;
        const init = async (create: boolean) => {
            const version = ++requestVersion;
            groupEditorVisible.value = false;
            loading.value = true;

            gpuDevices.value = undefined;
            gpuWarnings.value = [];
            numaNodes.value = [];
            model.value.numa ??= { mode: 'off', nodes: [] };
            if (create) {
                model.value.group = undefined;
                model.value.enabled = false;
                model.value.numa = { mode: 'off', nodes: [] };
                model.value.mode = 'all';
                model.value.count = undefined;
                model.value.deviceIDs = [];
                model.value.error = undefined;
            }
            selectionMode.value = model.value.group ? 'group' : 'custom';
            groups.value = [];
            groupsFailed.value = false;
            try {
                const { data } = await loadModelGPUDevices();
                if (version !== requestVersion) return;
                gpuDevices.value = data.devices || [];
                if (__panelSetupProps.imageType === 'nvidia' && model.value.mode === 'devices') {
                    model.value.deviceIDs = [
                        ...new Set(
                            model.value.deviceIDs.map(
                                (id) =>
                                    gpuDevices.value.find(
                                        (device) =>
                                            device.type === 'nvidia' &&
                                            (device.id === id ||
                                                (device.uuid && `nvidia:${device.uuid}` === id) ||
                                                (device.index !== undefined && `nvidia:${device.index}` === id)),
                                    )?.id || id,
                            ),
                        ),
                    ];
                }
                numaNodes.value = data.numaNodes || [];
                gpuWarnings.value = data.warnings || [];
                if (create) model.value.enabled = hasSupportedGPU.value;
                if (!hasMultipleGPUs.value) {
                    selectionMode.value = 'custom';
                    model.value.group = undefined;
                } else if (!__panelSetupProps.groupEditor) {
                    try {
                        const { data: groupData } = await listGPUGroups();
                        if (version !== requestVersion) return;
                        groups.value = groupData || [];
                    } catch {
                        if (version === requestVersion) groupsFailed.value = true;
                    }
                }
            } catch {
            } finally {
                if (version === requestVersion) {
                    loading.value = false;
                }
            }
        };
        onBeforeUnmount(() => {
            requestVersion++;
        });
        ctx.expose({ init, loading: computed(() => loading.value || groupEditorVisible.value) });
        return () => (
            <>
                {h(
                    __panelSetupProps.groupEditor ? 'div' : 'details',
                    {
                        ref: sectionRef,
                        open: __panelSetupProps.groupEditor || !__panelSetupProps.collapsed,
                        class: cn('form-section', { 'group-editor': __panelSetupProps.groupEditor }),
                    },
                    {
                        default: () => (
                            <>
                                <summary
                                    class={'form-section-header'}
                                    style={[{}, { display: !__panelSetupProps.groupEditor ? '' : 'none' }]}
                                >
                                    <span>{$t('aiTools.model.gpuAcceleration')}</span>
                                    {!__panelSetupProps.groupEditor ? (
                                        <ElSwitch
                                            onClick={($event?: any) => {
                                                $event.stopPropagation();
                                            }}
                                            onKeydown={($event?: any) => {
                                                $event.stopPropagation();
                                            }}
                                            modelValue={unref(model).enabled}
                                            onUpdate:modelValue={($v) => {
                                                unref(model).enabled = $v as any;
                                            }}
                                            disabled={unref(loading)}
                                            aria-label={$t('aiTools.model.gpuAcceleration')}
                                            onChange={($event?: any) => {
                                                (changeEnabled as any)($event);
                                            }}
                                        />
                                    ) : null}
                                    {!unref(loading) && !unref(hasSupportedGPU) && !unref(model).enabled ? (
                                        <ElText type="info" size="small">
                                            {$t(
                                                unref(gpuDevices)
                                                    ? 'aiTools.model.gpuNotDetected'
                                                    : 'aiTools.model.loadFailed',
                                            )}
                                        </ElText>
                                    ) : null}
                                </summary>
                                {unref(model).enabled || unref(model).error ? (
                                    <div
                                        class={'form-section-body'}
                                        style={[{}, { display: !unref(loading) ? '' : 'none' }]}
                                    >
                                        <ElFormItem
                                            prop="gpu.mode"
                                            rules={gpuModeRules}
                                            error={unref(model).error}
                                            label={unref(model).enabled ? $t('aiTools.gpuGroup.source') : undefined}
                                            style={[{}, { display: !__panelSetupProps.groupEditor ? '' : 'none' }]}
                                        >
                                            {unref(model).enabled && !__panelSetupProps.groupEditor ? (
                                                <ElSelect
                                                    model-value={unref(gpuSource)}
                                                    onChange={($event?: any) => {
                                                        (changeSource as any)($event);
                                                    }}
                                                    class={'w-full'}
                                                >
                                                    <ElOption value="all" label={$t('aiTools.model.gpuAll')} />
                                                    <ElOption value="devices" label={$t('aiTools.model.gpuSpecific')} />
                                                    {__panelSetupProps.imageType === 'nvidia' ? (
                                                        <ElOption value="count" label={$t('aiTools.model.gpuCount')} />
                                                    ) : null}
                                                    {unref(hasMultipleGPUs) ? (
                                                        <ElOption value="group" label={$t('aiTools.gpuGroup.groups')} />
                                                    ) : null}
                                                </ElSelect>
                                            ) : null}
                                            {unref(model).enabled && unref(gpuSource) === 'all' ? (
                                                <span class={'input-help'}>{$t('aiTools.model.gpuAllHelper')}</span>
                                            ) : null}
                                            {unref(model).enabled && unref(gpuSource) === 'count' ? (
                                                <span class={'input-help'}>{$t('aiTools.model.gpuCountHelper')}</span>
                                            ) : null}
                                            {unref(model).enabled && unref(gpuSource) === 'devices' ? (
                                                <span class={'input-help'}>
                                                    {$t('aiTools.model.gpuSpecificHelper')}
                                                </span>
                                            ) : null}
                                        </ElFormItem>
                                        {!__panelSetupProps.groupEditor &&
                                        unref(model).enabled &&
                                        unref(hasMultipleGPUs) ? (
                                            <>
                                                {unref(selectionMode) === 'group' ? (
                                                    <ElFormItem
                                                        label={$t('aiTools.gpuGroup.groups')}
                                                        prop="gpu.group"
                                                        rules={groupRules}
                                                    >
                                                        <div class={'gpu-group-control'}>
                                                            <ElSelect
                                                                model-value={unref(model).group?.id}
                                                                fit-input-width
                                                                onChange={($event?: any) => {
                                                                    (applyGroup as any)($event);
                                                                }}
                                                                class={'w-full'}
                                                            >
                                                                {(unref(compatibleGroups) || []).map((group) => (
                                                                    <ElOption
                                                                        value={group.id}
                                                                        label={group.name}
                                                                        class={'gpu-group-option'}
                                                                        key={group.id}
                                                                    >
                                                                        <span
                                                                            title={group.name}
                                                                            class={'gpu-group-option-name'}
                                                                        >
                                                                            {group.name}
                                                                        </span>
                                                                        {group.description ? (
                                                                            <span
                                                                                title={group.description}
                                                                                class={'gpu-group-option-description'}
                                                                            >
                                                                                {group.description}
                                                                            </span>
                                                                        ) : null}
                                                                    </ElOption>
                                                                ))}
                                                                {unref(model).group &&
                                                                !unref(compatibleGroups).some(
                                                                    (group) => group.id === unref(model).group?.id,
                                                                ) ? (
                                                                    <ElOption
                                                                        value={unref(model).group.id}
                                                                        label={unref(model).group.name}
                                                                        disabled
                                                                    />
                                                                ) : null}
                                                            </ElSelect>
                                                            {withDirectives(
                                                                <ElButton
                                                                    onClick={($event?: any) => {
                                                                        groupEditorVisible.value = true;
                                                                    }}
                                                                >
                                                                    {$t('commons.button.add')}
                                                                </ElButton>,
                                                                [[permissionDirective, 'ai_gpu_manage']],
                                                            )}
                                                        </div>
                                                        <span class={'input-help'}>
                                                            {$t('aiTools.gpuGroup.snapshotHelp')}
                                                        </span>
                                                        {unref(groupsFailed) ? (
                                                            <span class={'input-help'}>
                                                                {$t('aiTools.model.loadFailed')}
                                                            </span>
                                                        ) : null}
                                                        {unref(model).group ? (
                                                            <>
                                                                <div class={'input-help'}>{unref(groupSummary)}</div>
                                                                {unref(sourceChanged) ? (
                                                                    <ElAlert
                                                                        closable={false}
                                                                        type="warning"
                                                                        title={$t('aiTools.gpuGroup.changed')}
                                                                    />
                                                                ) : null}
                                                                {unref(sourceChanged) && unref(currentGroup) ? (
                                                                    <ElButton
                                                                        link
                                                                        type="primary"
                                                                        onClick={($event?: any) => {
                                                                            applyGroup(unref(currentGroup).id);
                                                                        }}
                                                                    >
                                                                        {$t('aiTools.gpuGroup.applyLatest')}
                                                                    </ElButton>
                                                                ) : null}
                                                            </>
                                                        ) : null}
                                                    </ElFormItem>
                                                ) : null}
                                            </>
                                        ) : null}
                                        <div
                                            style={[
                                                {},
                                                {
                                                    display:
                                                        __panelSetupProps.groupEditor ||
                                                        !unref(hasMultipleGPUs) ||
                                                        unref(selectionMode) === 'custom'
                                                            ? ''
                                                            : 'none',
                                                },
                                            ]}
                                        >
                                            {unref(model).enabled ? (
                                                <>
                                                    {unref(model).mode === 'count' ? (
                                                        <ElFormItem
                                                            label={$t('aiTools.model.gpuCount')}
                                                            prop="gpu.count"
                                                            rules={gpuCountRules}
                                                        >
                                                            <ElInputNumber
                                                                modelValue={unref(model).count}
                                                                onUpdate:modelValue={($v) => {
                                                                    unref(model).count = $v as any;
                                                                }}
                                                                min={1}
                                                                precision={0}
                                                                step={1}
                                                                step-strictly
                                                                onChange={($event?: any) => {
                                                                    unref(unref(model)).error = undefined;
                                                                }}
                                                            />
                                                        </ElFormItem>
                                                    ) : null}
                                                    {unref(model).mode === 'devices' ? (
                                                        <ElFormItem
                                                            label={$t('aiTools.model.gpuDevices')}
                                                            prop="gpu.deviceIDs"
                                                            rules={gpuDeviceRules}
                                                            v-slots={{
                                                                label: () => (
                                                                    <>
                                                                        <span class={'group-device-label'}>
                                                                            {$t('aiTools.model.gpuDevices')}
                                                                            <span>
                                                                                {$t('aiTools.gpuGroup.selectedGPU', {
                                                                                    count: unref(model).deviceIDs
                                                                                        .length,
                                                                                })}
                                                                            </span>
                                                                        </span>
                                                                    </>
                                                                ),
                                                            }}
                                                        >
                                                            <GPUTopology
                                                                modelValue={unref(model).deviceIDs}
                                                                onUpdate:modelValue={($v) => {
                                                                    unref(model).deviceIDs = $v as any;
                                                                }}
                                                                devices={(unref(gpuDevices) || []).filter(
                                                                    (device) =>
                                                                        device.type === __panelSetupProps.imageType,
                                                                )}
                                                                nodes={unref(numaNodes)}
                                                                cards
                                                                selectable
                                                                onUpdate:model-value={($event?: any) => {
                                                                    unref(unref(model)).error = undefined;
                                                                }}
                                                                v-slots={{
                                                                    'device-meta': ({ device }) => (
                                                                        <>{ctx.slots['device-meta']?.({ device })}</>
                                                                    ),
                                                                }}
                                                            />
                                                            {!__panelSetupProps.groupEditor ? (
                                                                <span class={'input-help w-full'}>
                                                                    {$t('aiTools.gpuGroup.selectedGPU', {
                                                                        count: unref(model).deviceIDs.length,
                                                                    })}
                                                                </span>
                                                            ) : null}
                                                        </ElFormItem>
                                                    ) : null}
                                                </>
                                            ) : null}
                                        </div>
                                        {unref(model).enabled && !unref(numaNodes).length ? (
                                            <p class={'input-help'}>{$t('aiTools.model.numaTopologyUnavailable')}</p>
                                        ) : null}
                                        {unref(model).enabled &&
                                        unref(model).numa &&
                                        (unref(numaNodes).length > 1 || unref(numaBound)) ? (
                                            <details open={unref(numaBound)} class={'form-section'}>
                                                <summary class={'form-section-header'}>
                                                    {$t('app.advanced')}
                                                    {' · '}
                                                    {$t('aiTools.gpuGroup.affinity')}
                                                </summary>
                                                <div class={'form-section-body'}>
                                                    <ElFormItem
                                                        label={$t('aiTools.gpuGroup.affinity')}
                                                        prop="gpu.numa.mode"
                                                        rules={numaRules}
                                                        show-message={false}
                                                        v-slots={{
                                                            label: () => (
                                                                <>
                                                                    <span class={'gpu-capabilities-label'}>
                                                                        {$t('aiTools.gpuGroup.affinity')}
                                                                        <ElTooltip
                                                                            placement="top"
                                                                            v-slots={{
                                                                                content: () => (
                                                                                    <>
                                                                                        <div
                                                                                            class={
                                                                                                'gpu-capabilities-help'
                                                                                            }
                                                                                        >
                                                                                            {$t(
                                                                                                'aiTools.model.numaHelp',
                                                                                            )}
                                                                                        </div>
                                                                                    </>
                                                                                ),
                                                                            }}
                                                                        >
                                                                            <ElIcon
                                                                                tabindex="0"
                                                                                aria-label={$t(
                                                                                    'aiTools.model.numaHelp',
                                                                                )}
                                                                            >
                                                                                <InfoFilled />
                                                                            </ElIcon>
                                                                        </ElTooltip>
                                                                    </span>
                                                                </>
                                                            ),
                                                        }}
                                                    >
                                                        <ElRadioGroup
                                                            modelValue={unref(model).numa.mode}
                                                            onUpdate:modelValue={($v) => {
                                                                unref(model).numa.mode = $v as any;
                                                            }}
                                                            onChange={($event?: any) => {
                                                                selectionMode.value = 'custom';
                                                                unref(unref(model)).group = undefined;
                                                            }}
                                                        >
                                                            <ElRadioButton value="off">
                                                                {$t('aiTools.model.numaOff')}
                                                            </ElRadioButton>
                                                            <ElRadioButton
                                                                value="auto"
                                                                disabled={
                                                                    unref(numaNodes).length <= 1 ||
                                                                    unref(model).mode === 'count'
                                                                }
                                                            >
                                                                {$t('aiTools.gpuGroup.followGPU')}
                                                            </ElRadioButton>
                                                            <ElRadioButton
                                                                value="manual"
                                                                disabled={unref(numaNodes).length <= 1}
                                                            >
                                                                {$t('aiTools.model.numaManual')}
                                                            </ElRadioButton>
                                                        </ElRadioGroup>
                                                        <div aria-live="polite" class={'numa-strategy-help'}>
                                                            <p class={'input-help'}>
                                                                {$t(
                                                                    unref(model).numa.mode === 'off'
                                                                        ? 'aiTools.model.numaOffHelp'
                                                                        : unref(model).numa.mode === 'auto'
                                                                          ? 'aiTools.model.numaAutoHelp'
                                                                          : 'aiTools.model.numaManualHelp',
                                                                )}
                                                            </p>
                                                            {unref(model).numa.mode === 'auto' && !unref(loading) ? (
                                                                <p
                                                                    class={
                                                                        unref(numaError)
                                                                            ? 'numa-strategy-warning'
                                                                            : 'input-help'
                                                                    }
                                                                >
                                                                    {unref(numaError) ||
                                                                        $t('aiTools.model.numaResolved', {
                                                                            node: unref(selectedNUMAGPUs)[0]?.numaNode,
                                                                        })}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </ElFormItem>
                                                    {unref(model).numa.mode === 'manual' ? (
                                                        <ElFormItem
                                                            label={$t('aiTools.model.numaNodes')}
                                                            prop="gpu.numa.nodes"
                                                            rules={numaRules}
                                                        >
                                                            <ElSelect
                                                                modelValue={unref(model).numa.nodes}
                                                                onUpdate:modelValue={($v) => {
                                                                    unref(model).numa.nodes = $v as any;
                                                                }}
                                                                multiple
                                                                disabled={unref(numaNodes).length <= 1}
                                                                onChange={($event?: any) => {
                                                                    selectionMode.value = 'custom';
                                                                    unref(unref(model)).group = undefined;
                                                                }}
                                                                class={'w-full'}
                                                            >
                                                                {(unref(numaNodes) || []).map((node) => (
                                                                    <ElOption
                                                                        value={node.id}
                                                                        label={`NUMA ${node.id} · CPU ${node.cpus || '—'}`}
                                                                        disabled={!node.cpus || !node.memory}
                                                                        key={node.id}
                                                                    />
                                                                ))}
                                                                {(unref(missingNUMANodes) || []).map((id) => (
                                                                    <ElOption
                                                                        value={id}
                                                                        label={`NUMA ${id} (${$t('aiTools.model.numaUnavailable')})`}
                                                                        disabled
                                                                        key={id}
                                                                    />
                                                                ))}
                                                            </ElSelect>
                                                        </ElFormItem>
                                                    ) : null}
                                                </div>
                                            </details>
                                        ) : null}
                                        {!__panelSetupProps.groupEditor &&
                                        unref(model).enabled &&
                                        unref(model).numa &&
                                        unref(model).numa.mode !== 'off' ? (
                                            <p class={'input-help'}>{$t('aiTools.model.numaRequirements')}</p>
                                        ) : null}
                                        {!__panelSetupProps.groupEditor &&
                                        unref(model).enabled &&
                                        __panelSetupProps.imageType === 'nvidia' ? (
                                            <ElFormItem
                                                label="Capabilities"
                                                prop="gpu.capabilities"
                                                v-slots={{
                                                    label: () => (
                                                        <>
                                                            <span class={'gpu-capabilities-label'}>
                                                                {' Capabilities '}
                                                                <ElTooltip
                                                                    placement="top"
                                                                    v-slots={{
                                                                        content: () => (
                                                                            <>
                                                                                <div class={'gpu-capabilities-help'}>
                                                                                    {$t(
                                                                                        'aiTools.model.gpuCapabilitiesHelper',
                                                                                    )}
                                                                                </div>
                                                                            </>
                                                                        ),
                                                                    }}
                                                                >
                                                                    <ElIcon
                                                                        tabindex="0"
                                                                        aria-label={$t(
                                                                            'aiTools.model.gpuCapabilitiesHelper',
                                                                        )}
                                                                    >
                                                                        <InfoFilled />
                                                                    </ElIcon>
                                                                </ElTooltip>
                                                            </span>
                                                        </>
                                                    ),
                                                }}
                                            >
                                                <ElCheckboxGroup
                                                    modelValue={unref(model).capabilities}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(model).capabilities = $v as any;
                                                    }}
                                                >
                                                    <ElCheckbox value="gpu" disabled>
                                                        {'gpu'}
                                                    </ElCheckbox>
                                                    <ElCheckbox value="utility">{'utility'}</ElCheckbox>
                                                    <ElCheckbox value="compute">{'compute'}</ElCheckbox>
                                                </ElCheckboxGroup>
                                            </ElFormItem>
                                        ) : null}
                                        {unref(selectingDevices) && unref(gpuWarnings).length ? (
                                            <span class={'input-help'}>{unref(gpuWarnings).join('; ')}</span>
                                        ) : null}
                                    </div>
                                ) : null}
                            </>
                        ),
                    },
                )}
                {!__panelSetupProps.groupEditor && unref(groupEditorVisible) ? (
                    <GroupOperate
                        visible={unref(groupEditorVisible)}
                        onUpdate:visible={($v) => {
                            groupEditorVisible.value = $v as any;
                        }}
                        groups={unref(groups)}
                        devices={unref(gpuDevices) || []}
                        image-type={__panelSetupProps.imageType}
                        onSaved={($event?: any) => {
                            (groupCreated as any)($event);
                        }}
                    />
                ) : null}
            </>
        );
    },
    options,
);
