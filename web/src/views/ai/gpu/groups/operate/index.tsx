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
import { saveGPUGroup } from '@/api/modules/ai';
import GPUConfig from '@/views/ai/components/gpu-config/index';
import DrawerPro from '@/components/drawer-pro/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { Rules } from '@/global/form-rules';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    group?: GPUGroup;
    groups?: GPUGroup[];
    devices?: ModelGPUDevice[];
    imageType?: string;
    modelValue?: boolean;
}

const emits = {
    'update:modelValue': (value: boolean) => true,
    saved: (arg0?: string) => true,
};

const options = {
    name: 'operate',
    props: {
        group: { type: null },
        groups: Array,
        devices: Array,
        imageType: String,
        modelValue: { type: Boolean },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-db33f909',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const visible = computed({
            get: () => __panelSetupProps.modelValue,
            set: ($v) => ctx.emit('update:modelValue', $v),
        });
        const { currentNode } = useGlobalStore();
        const initializing = ref(true);
        const vendorOptions = computed(() =>
            [
                { value: 'nvidia', label: 'NVIDIA' },
                { value: 'intel', label: 'Intel' },
                { value: 'ascend', label: 'Ascend' },
            ].map((vendor) => ({
                ...vendor,
                count: __panelSetupProps.devices.filter((device) => device.type === vendor.value && device.available)
                    .length,
            })),
        );
        const saving = ref(false);
        const formRef = ref<FormInstance>();
        const gpuRef = ref<InstanceType<typeof GPUConfig>>();
        const emptyGPU = (): ModelGPUConfig => ({
            enabled: true,
            mode: 'devices',
            deviceIDs: [],
            capabilities: ['gpu', 'utility', 'compute'],
            numa: { mode: 'off', nodes: [] },
        });
        const form = ref(
            __panelSetupProps.group
                ? {
                      id: __panelSetupProps.group.id,
                      name: __panelSetupProps.group.name,
                      description: __panelSetupProps.group.description || '',
                      imageType: __panelSetupProps.group.imageType,
                      gpu: JSON.parse(JSON.stringify(__panelSetupProps.group.gpu)) as ModelGPUConfig,
                  }
                : {
                      id: 0,
                      name: '',
                      description: '',
                      imageType:
                          __panelSetupProps.imageType ||
                          __panelSetupProps.devices.find((device) => device.available)?.type ||
                          'nvidia',
                      gpu: emptyGPU(),
                  },
        );
        const rules = {
            name: [
                Rules.requiredInput,
                {
                    validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
                        callback(
                            __panelSetupProps.groups.some(
                                (group) => group.id !== form.value.id && group.name === value.trim(),
                            )
                                ? new Error(i18n.global.t('commons.rule.duplicate'))
                                : undefined,
                        );
                    },
                    trigger: 'blur',
                },
            ],
            imageType: [Rules.requiredSelect],
        };
        const changeVendor = async () => {
            form.value.gpu = emptyGPU();
            await nextTick();
            formRef.value?.clearValidate();
            await gpuRef.value?.init(false);
        };
        const close = (done: () => void) => {
            if (!saving.value) done();
        };
        const save = async () => {
            if (initializing.value || saving.value || gpuRef.value?.loading) return;
            const node = currentNode.value;
            if (!(await formRef.value?.validate().catch(() => false))) return;
            if (node !== currentNode.value) return;
            saving.value = true;
            try {
                const name = form.value.name.trim();
                await saveGPUGroup(form.value);
                if (node !== currentNode.value) return;
                visible.value = false;
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                ctx.emit('saved', name);
            } finally {
                saving.value = false;
            }
        };
        onMounted(async () => {
            try {
                await nextTick();
                await gpuRef.value?.init(false);
            } finally {
                initializing.value = false;
            }
        });
        watch(currentNode, () => {
            visible.value = false;
        });
        return () => (
            <DrawerPro
                modelValue={unref(visible)}
                onUpdate:modelValue={($v) => {
                    visible.value = $v as any;
                }}
                header={$t(unref(form).id ? 'commons.button.edit' : 'commons.button.create')}
                resource={$t('aiTools.gpuGroup.groups')}
                size="large"
                auto-close={false}
                confirm-before-close
                onBeforeClose={($event?: any) => {
                    (close as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                disabled={unref(saving)}
                                onClick={($event?: any) => {
                                    visible.value = false;
                                }}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            <ElButton
                                type="primary"
                                loading={unref(saving)}
                                disabled={unref(initializing) || unref(gpuRef)?.loading}
                                onClick={($event?: any) => {
                                    (save as any)($event);
                                }}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        ref={formRef}
                        model={unref(form)}
                        rules={rules}
                        label-position="top"
                        disabled={unref(initializing) || unref(saving)}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <h3 class={'group-form-heading'}>{$t('home.baseInfo')}</h3>
                        <ElFormItem label={$t('commons.table.name')} prop="name">
                            <ElInput
                                modelValue={unref(form).name}
                                onUpdate:modelValue={($v) => {
                                    unref(form).name = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                                maxlength="128"
                                clearable
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('aiTools.gpuGroup.vendor')} prop="imageType">
                            <ElSelect
                                modelValue={unref(form).imageType}
                                onUpdate:modelValue={($v) => {
                                    unref(form).imageType = $v as any;
                                }}
                                disabled={!!__panelSetupProps.imageType}
                                onChange={($event?: any) => {
                                    (changeVendor as any)($event);
                                }}
                            >
                                {(unref(vendorOptions) || []).map((vendor) => (
                                    <ElOption
                                        value={vendor.value}
                                        label={`${vendor.label} (${vendor.count})`}
                                        disabled={vendor.count === 0}
                                        key={vendor.value}
                                    />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                        <GPUConfig
                            ref={gpuRef}
                            modelValue={unref(form).gpu}
                            onUpdate:modelValue={($v) => {
                                unref(form).gpu = $v as any;
                            }}
                            image-type={unref(form).imageType}
                            group-editor
                            v-slots={{
                                'device-meta': ({ device }) => (
                                    <>
                                        {__panelSetupProps.groups.some(
                                            (group) =>
                                                __panelSetupProps.group.id !== unref(form).id &&
                                                __panelSetupProps.group.gpu.deviceIDs.includes(device.id),
                                        ) ? (
                                            <span class={'device-existing-groups'}>
                                                {$t('aiTools.gpuGroup.groups')}
                                                {' · '}
                                                {__panelSetupProps.groups
                                                    .filter(
                                                        (group) =>
                                                            __panelSetupProps.group.id !== unref(form).id &&
                                                            __panelSetupProps.group.gpu.deviceIDs.includes(device.id),
                                                    )
                                                    .map((group) => __panelSetupProps.group.name)
                                                    .join(', ')}
                                            </span>
                                        ) : null}
                                    </>
                                ),
                            }}
                        />
                        {unref(form).id ? <div class={'input-help'}>{$t('aiTools.gpuGroup.snapshotHelp')}</div> : null}
                        <ElFormItem label={$t('commons.table.description')} prop="description">
                            <ElInput
                                modelValue={unref(form).description}
                                onUpdate:modelValue={($v) => {
                                    unref(form).description = $v as any;
                                }}
                                type="textarea"
                                rows={2}
                                maxlength="500"
                                show-word-limit
                            />
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(initializing) || unref(saving)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
