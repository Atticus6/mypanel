import { $t } from '@/utils/i18n-t';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { checkNumberRange } from '@/global/form-rules';
import { Container } from '@/types/container';
import { rpc } from '@/lib/rpc';

interface CodemodProps {
    [key: string]: any;
    form?: {
        advanced: boolean;
        containerName: string;
        allowPort: boolean;
        specifyIP: string;
        restartPolicy: string;
        cpuQuota: number;
        memoryLimit: number;
        memoryUnit: string;
        pullImage: boolean;
        editCompose: boolean;
        dockerCompose: string;
    };
    showToggle?: boolean;
    showAllowPort?: boolean;
    showSpecifyIP?: boolean;
    showContainerName?: boolean;
    showRestartPolicy?: boolean;
    showResourceLimit?: boolean;
    showPullImage?: boolean;
    showCompose?: boolean;
    autoLoadLimit?: boolean;
}

const emits = {};

const options = {
    name: 'advanced-setting',
    props: {
        form: Object,
        showToggle: Boolean,
        showAllowPort: Boolean,
        showSpecifyIP: Boolean,
        showContainerName: Boolean,
        showRestartPolicy: Boolean,
        showResourceLimit: Boolean,
        showPullImage: Boolean,
        showCompose: Boolean,
        autoLoadLimit: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const form = toRef(__panelSetupProps, 'form');
        const limits = ref<Container.ResourceLimit>({
            cpu: null as number,
            memory: null as number,
        });
        const oldMemory = ref(0);
        const changeUnit = () => {
            if (form.value.memoryUnit === 'M') {
                limits.value.memory = oldMemory.value;
            } else {
                limits.value.memory = Number((oldMemory.value / 1024).toFixed(2));
            }
        };
        const loadLimit = async () => {
            const res = await rpc.container.getLimit({});
            limits.value = { cpu: res.cpu, memory: Number(res.memory) };
            limits.value.memory = Number((limits.value.memory / 1024 / 1024).toFixed(2));
            oldMemory.value = limits.value.memory;
        };
        onMounted(() => {
            if (__panelSetupProps.autoLoadLimit) {
                loadLimit();
            }
        });
        return () => (
            <>
                {__panelSetupProps.showToggle ? (
                    <ElFormItem prop="advanced">
                        <ElCheckbox v-model={unref(form).advanced} label={$t('app.advanced')} size="large" />
                    </ElFormItem>
                ) : null}
                {unref(form).advanced ? (
                    <div>
                        {__panelSetupProps.showContainerName ? (
                            <ElFormItem label={$t('app.containerName')} prop="containerName">
                                <ElInput
                                    modelValue={unref(form).containerName}
                                    onUpdate:modelValue={($v) => {
                                        unref(form).containerName = typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                    placeholder={$t('app.containerNameHelper')}
                                />
                            </ElFormItem>
                        ) : null}
                        {__panelSetupProps.showAllowPort ? (
                            <ElFormItem prop="allowPort">
                                <ElCheckbox v-model={unref(form).allowPort} label={$t('app.allowPort')} size="large" />
                                <span class={'input-help'}>{$t('app.allowPortHelper')}</span>
                            </ElFormItem>
                        ) : null}
                        {__panelSetupProps.showSpecifyIP && unref(form).allowPort ? (
                            <ElFormItem label={$t('app.specifyIP')} prop="specifyIP">
                                <ElInput v-model={unref(form).specifyIP} />
                                <span class={'input-help'}>{$t('app.specifyIPHelper')}</span>
                            </ElFormItem>
                        ) : null}
                        {__panelSetupProps.showRestartPolicy ? (
                            <ElFormItem label={$t('container.restartPolicy')} prop="restartPolicy">
                                <ElSelect v-model={unref(form).restartPolicy} class={'p-w-300'}>
                                    <ElOption label={$t('container.no')} value="no" />
                                    <ElOption label={$t('container.always')} value="always" />
                                    <ElOption label={$t('container.onFailure')} value="on-failure" />
                                    <ElOption label={$t('container.unlessStopped')} value="unless-stopped" />
                                </ElSelect>
                            </ElFormItem>
                        ) : null}
                        {__panelSetupProps.showResourceLimit ? (
                            <>
                                <ElFormItem
                                    label={$t('container.cpuQuota')}
                                    prop="cpuQuota"
                                    rules={checkNumberRange(0, unref(limits).cpu)}
                                >
                                    <ElInput
                                        type="number"
                                        modelValue={unref(form).cpuQuota}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).cpuQuota = $v === '' ? $v : Number($v);
                                        }}
                                        maxlength="5"
                                        class={'!w-2/5'}
                                        v-slots={{ append: () => <>{$t('app.cpuCore')}</> }}
                                    />
                                    <span class={'input-help'}>
                                        {$t('container.limitHelper', [unref(limits).cpu])}
                                        {$t('commons.units.core')}
                                    </span>
                                </ElFormItem>
                                <ElFormItem
                                    label={$t('container.memoryLimit')}
                                    prop="memoryLimit"
                                    rules={checkNumberRange(0, unref(limits).memory)}
                                >
                                    <ElInput
                                        modelValue={unref(form).memoryLimit}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).memoryLimit = $v === '' ? $v : Number($v);
                                        }}
                                        maxlength="10"
                                        class={'!w-2/5'}
                                        v-slots={{
                                            append: () => (
                                                <>
                                                    <ElSelect
                                                        v-model={unref(form).memoryUnit}
                                                        onChange={($event?: any) => {
                                                            (changeUnit as any)($event);
                                                        }}
                                                        class={'p-w-100'}
                                                    >
                                                        <ElOption label="MB" value="M" />
                                                        <ElOption label="GB" value="G" />
                                                    </ElSelect>
                                                </>
                                            ),
                                        }}
                                    />
                                    <span class={'input-help'}>
                                        {$t('container.limitHelper', [unref(limits).memory])}
                                        {unref(form).memoryUnit}
                                        {'B'}
                                    </span>
                                </ElFormItem>
                            </>
                        ) : null}
                        {__panelSetupProps.showPullImage ? (
                            <ElFormItem prop="pullImage">
                                <ElCheckbox v-model={unref(form).pullImage} label={$t('app.pullImage')} />
                                <span class={'input-help'}>{$t('app.pullImageHelper')}</span>
                            </ElFormItem>
                        ) : null}
                        {__panelSetupProps.showCompose ? (
                            <ElFormItem prop="editCompose">
                                <ElCheckbox v-model={unref(form).editCompose} label={$t('app.editCompose')} />
                                <span class={'input-help'}>{$t('app.editComposeHelper')}</span>
                            </ElFormItem>
                        ) : null}
                        {__panelSetupProps.showCompose && unref(form).editCompose ? (
                            <div>
                                <CodemirrorPro v-model={unref(form).dockerCompose} mode="yaml" />
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </>
        );
    },
    options,
);
