import { $t } from '@/utils/i18n-t';
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
import './index.styles.css';
import { cn } from '@/utils/cn';

interface CodemodProps {
    [key: string]: any;
    devices?: ModelGPUDevice[];
    nodes?: ModelNUMANode[];
    selectable?: boolean;
    cards?: boolean;
    modelValue?: string[];
}

const emits = {
    'update:modelValue': (value: string[]) => true,
};

type SlotsShape = {
    'device-meta': (arg?: unknown) => VNode[];
};

const options = {
    name: 'gpu-topology',
    props: {
        devices: Array,
        nodes: Array,
        selectable: Boolean,
        cards: Boolean,
        modelValue: { type: Array },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-5aa82289',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const selected = computed({
            get: () => __panelSetupProps.modelValue,
            set: ($v) => ctx.emit('update:modelValue', $v),
        });
        const showTopology = computed(
            () =>
                __panelSetupProps.nodes.length > 1 ||
                (__panelSetupProps.nodes.length === 1 && __panelSetupProps.devices.length > 1),
        );
        const sections = computed(() => {
            if (!showTopology.value)
                return __panelSetupProps.devices.length ? [{ devices: __panelSetupProps.devices }] : [];
            const result: { id?: number; node?: ModelNUMANode; devices: ModelGPUDevice[] }[] =
                __panelSetupProps.nodes.map((node) => ({
                    id: node.id,
                    node,
                    devices: __panelSetupProps.devices.filter((device) => device.numaNode === node.id),
                }));
            const unknown = __panelSetupProps.devices.filter(
                (device) => !__panelSetupProps.nodes.some((node) => node.id === device.numaNode),
            );
            if (unknown.length) result.push({ devices: unknown });
            return result.filter((section) => !__panelSetupProps.selectable || section.devices.length > 0);
        });
        const missingDevices = computed(() =>
            selected.value.filter((id) => !__panelSetupProps.devices.some((device) => device.id === id)),
        );
        const toggleDevice = (id: string, checked: boolean) => {
            selected.value = checked
                ? [...new Set([...selected.value, id])]
                : selected.value.filter((value) => value !== id);
        };
        const toggleNode = (devices: ModelGPUDevice[], checked: boolean) => {
            const ids = devices.filter((device) => device.available).map((device) => device.id);
            selected.value = checked
                ? [...new Set([...selected.value, ...ids])]
                : selected.value.filter((id) => !ids.includes(id));
        };
        return () => (
            <div
                class={cn('gpu-topology', {
                    selectable: __panelSetupProps.selectable,
                    'topology-cards': __panelSetupProps.cards,
                })}
            >
                {(unref(sections) || []).map((section) => (
                    <section
                        class={cn('numa-node', { unknown: unref(showTopology) && section.id === undefined })}
                        key={section.id ?? 'unknown'}
                    >
                        {unref(showTopology) ? (
                            <header class={'numa-node-header'}>
                                <div>
                                    <strong>
                                        {section.id === undefined
                                            ? $t('aiTools.gpuGroup.unknownNode')
                                            : `NUMA ${section.id}`}
                                        {section.id === undefined ? (
                                            <ElTooltip
                                                content={$t('aiTools.gpuGroup.unknownNodeHelp')}
                                                placement="top"
                                                popper-style={{ maxWidth: 'min(320px, calc(100vw - 32px))' }}
                                            >
                                                <ElIcon
                                                    tabindex="0"
                                                    aria-label={$t('aiTools.gpuGroup.unknownNodeHelp')}
                                                    class={'numa-info'}
                                                >
                                                    <InfoFilled />
                                                </ElIcon>
                                            </ElTooltip>
                                        ) : null}
                                    </strong>
                                    {section.id !== undefined ? (
                                        <div class={'numa-resources'}>
                                            <span>
                                                {'CPU '}
                                                {section.node?.cpus || '—'}
                                            </span>
                                            <span>
                                                {$t('aiTools.gpuGroup.memoryNode')}
                                                {section.node?.memory ? `NUMA ${section.id}` : '—'}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                                {__panelSetupProps.selectable &&
                                section.id !== undefined &&
                                section.devices.some((device) => device.available) ? (
                                    <ElCheckbox
                                        model-value={section.devices
                                            .filter((device) => device.available)
                                            .every((device) => unref(selected).includes(device.id))}
                                        indeterminate={
                                            section.devices.some(
                                                (device) => device.available && unref(selected).includes(device.id),
                                            ) &&
                                            section.devices.some(
                                                (device) => device.available && !unref(selected).includes(device.id),
                                            )
                                        }
                                        onChange={($event?: any) => {
                                            toggleNode(section.devices, Boolean($event));
                                        }}
                                    >
                                        {$t('aiTools.gpuGroup.selectNode')}
                                    </ElCheckbox>
                                ) : null}
                            </header>
                        ) : null}
                        {section.devices.length ? (
                            <div class={'numa-devices'}>
                                {(section.devices || []).map((device) => (
                                    <div
                                        class={cn('topology-device', {
                                            selected:
                                                __panelSetupProps.selectable && unref(selected).includes(device.id),
                                            unavailable: !device.available,
                                        })}
                                        key={device.id}
                                    >
                                        {__panelSetupProps.selectable ? (
                                            <ElCheckbox
                                                model-value={unref(selected).includes(device.id)}
                                                disabled={!device.available && !unref(selected).includes(device.id)}
                                                onChange={($event?: any) => {
                                                    toggleDevice(device.id, Boolean($event));
                                                }}
                                            >
                                                {device.name}
                                            </ElCheckbox>
                                        ) : (
                                            <strong>{device.name}</strong>
                                        )}
                                        {!device.available ? (
                                            <ElTag size="small" type="warning">
                                                {$t('aiTools.model.gpuMissing')}
                                            </ElTag>
                                        ) : null}
                                        {ctx.slots['device-meta']?.({ device })}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div class={'numa-empty'}>{$t('aiTools.gpuGroup.noDevices')}</div>
                        )}
                    </section>
                ))}
                {__panelSetupProps.selectable && unref(missingDevices).length ? (
                    <div class={'missing-devices'}>
                        {(unref(missingDevices) || []).map((id) => (
                            <ElTag
                                type="warning"
                                closable
                                onClose={($event?: any) => {
                                    toggleDevice(id, false);
                                }}
                                key={id}
                            >
                                {id}
                                {' · '}
                                {$t('aiTools.model.gpuMissing')}
                            </ElTag>
                        ))}
                    </div>
                ) : null}
                {!unref(sections).length ? (
                    <ElEmpty description={$t('aiTools.model.gpuNotDetected')} image-size={60} />
                ) : null}
            </div>
        );
    },
    options,
);
