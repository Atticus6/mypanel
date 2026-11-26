import { $t } from '@/utils/i18n-t';
import { Rules, checkNumberRange } from '@/global/form-rules';
import { getAlgorithms, getStatusStrategy, Units } from '@/global/mimetype';
import { Monitor, QuestionFilled } from '@element-plus/icons-vue';
interface Server {
    server: string;
    weight?: number;
    maxFails?: number;
    maxConns?: number;
    failTimeout?: number;
    failTimeoutUnit: string;
    flag: string;
}
interface LoadBalanceFormData {
    name: string;
    algorithm: string;
    servers: Server[];
}
interface Props {
    modelValue: LoadBalanceFormData;
    disabled?: boolean;
    type?: string;
}
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';

interface CodemodProps {
    [key: string]: any;
    modelValue?: LoadBalanceFormData;
    disabled?: boolean;
    type?: string;
}

const emits = {
    'update:modelValue': (arg0?: LoadBalanceFormData) => true,
};

const options = {
    name: 'form',
    props: {
        modelValue: { type: null },
        disabled: Boolean,
        type: String,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-e6f3aa58',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const lbFormRef = ref<FormInstance>();
        const formData = computed({
            get: () => __panelSetupProps.modelValue,
            set: (value) => ctx.emit('update:modelValue', value),
        });
        const rules = ref<any>({
            name: [Rules.appName],
            algorithm: [Rules.requiredSelect],
            server: [Rules.requiredInput],
            weight: [checkNumberRange(0, 100)],
            servers: {
                type: Array,
            },
            maxFails: [checkNumberRange(0, 1000)],
            maxConns: [checkNumberRange(0, 10000)],
            failTimeout: [checkNumberRange(0, 300)],
        });
        const Algorithms = getAlgorithms(__panelSetupProps.type);
        const helper = ref();
        const getHelper = (key: string) => {
            Algorithms.forEach((algorithm) => {
                if (algorithm.value === key) {
                    helper.value = algorithm.placeHolder;
                }
            });
            return helper.value;
        };
        const initServer = (): Server => ({
            server: '',
            weight: undefined,
            maxFails: undefined,
            maxConns: undefined,
            failTimeout: undefined,
            failTimeoutUnit: 's',
            flag: '',
        });
        const addServer = () => {
            const newServers = [...formData.value.servers, initServer()];
            ctx.emit('update:modelValue', { ...formData.value, servers: newServers });
        };
        const removeServer = (index: number) => {
            const newServers = [...formData.value.servers];
            newServers.splice(index, 1);
            ctx.emit('update:modelValue', { ...formData.value, servers: newServers });
        };
        const handleChange = () => {
            ctx.emit('update:modelValue', { ...formData.value });
        };
        const handleAlgorithmChange = () => {
            handleChange();
        };
        const validate = async () => {
            if (!lbFormRef.value) return false;
            return await lbFormRef.value.validate();
        };
        const resetFields = () => {
            lbFormRef.value?.resetFields();
        };
        const clearValidate = () => {
            lbFormRef.value?.clearValidate();
        };
        ctx.expose({
            validate,
            resetFields,
            clearValidate,
            formRef: lbFormRef,
        });
        return () => (
            <ElForm ref={lbFormRef} label-position="top" model={unref(formData)} rules={unref(rules)}>
                <ElFormItem label={$t('commons.table.name')} prop="name">
                    <ElInput
                        modelValue={unref(formData).name}
                        onUpdate:modelValue={($v) => {
                            unref(formData).name = typeof $v === 'string' ? $v.trim() : $v;
                        }}
                        disabled={__panelSetupProps.disabled}
                    />
                </ElFormItem>
                <ElFormItem label={$t('website.algorithm')} prop="algorithm">
                    <ElSelect
                        modelValue={unref(formData).algorithm}
                        onUpdate:modelValue={($v) => {
                            unref(formData).algorithm = $v as any;
                        }}
                        onChange={($event?: any) => {
                            (handleAlgorithmChange as any)($event);
                        }}
                    >
                        {(Algorithms || []).map((algorithm, index) => (
                            <ElOption label={algorithm.label} value={algorithm.value} key={index} />
                        ))}
                    </ElSelect>
                    <span class={'input-help'}>{getHelper(unref(formData).algorithm)}</span>
                </ElFormItem>
                <div>
                    {(unref(formData).servers || []).map((server, index) => (
                        <ElCard
                            shadow="hover"
                            class={'server-card'}
                            key={index}
                            v-slots={{
                                header: () => (
                                    <>
                                        <div class={'card-header'}>
                                            <span class={'server-title'}>
                                                <ElIcon>
                                                    <Monitor />
                                                </ElIcon>
                                                <span class={'ml-2'}>
                                                    {$t('website.server')}
                                                    {' - '}
                                                    {server.server || index + 1}
                                                </span>
                                            </span>
                                            {unref(formData).servers.length > 1 ? (
                                                <ElButton
                                                    text
                                                    type="danger"
                                                    icon="Delete"
                                                    size="small"
                                                    onClick={($event?: any) => {
                                                        removeServer(index);
                                                    }}
                                                />
                                            ) : null}
                                        </div>
                                    </>
                                ),
                            }}
                        >
                            <div>
                                <ElRow gutter={16}>
                                    <ElCol span={24}>
                                        <ElFormItem
                                            label={$t('setting.address')}
                                            prop={`servers.${index}.server`}
                                            rules={unref(rules).server}
                                        >
                                            <ElInput
                                                modelValue={unref(formData).servers[index].server}
                                                onUpdate:modelValue={($v) => {
                                                    unref(formData).servers[index].server = $v as any;
                                                }}
                                                placeholder={
                                                    __panelSetupProps.type === 'stream'
                                                        ? '127.0.0.1:3306'
                                                        : '127.0.0.1:8080'
                                                }
                                                onInput={($event?: any) => {
                                                    (handleChange as any)($event);
                                                }}
                                            />
                                        </ElFormItem>
                                    </ElCol>
                                </ElRow>
                                <ElRow gutter={16}>
                                    <ElCol xs={24} sm={24} md={12} lg={12} xl={12}>
                                        <ElFormItem
                                            label={$t('website.weight')}
                                            prop={`servers.${index}.weight`}
                                            rules={unref(rules).weight}
                                        >
                                            <ElInput
                                                type="number"
                                                modelValue={unref(formData).servers[index].weight}
                                                onUpdate:modelValue={($v) => {
                                                    unref(formData).servers[index].weight = $v === '' ? $v : Number($v);
                                                }}
                                                onInput={($event?: any) => {
                                                    (handleChange as any)($event);
                                                }}
                                            />
                                        </ElFormItem>
                                    </ElCol>
                                    <ElCol xs={24} sm={24} md={12} lg={12} xl={12}>
                                        <ElFormItem
                                            label={$t('website.strategy')}
                                            prop={`servers.${index}.flag`}
                                            rules={unref(rules).flag}
                                        >
                                            <ElSelect
                                                modelValue={unref(formData).servers[index].flag}
                                                onUpdate:modelValue={($v) => {
                                                    unref(formData).servers[index].flag = $v as any;
                                                }}
                                                clearable
                                                onChange={($event?: any) => {
                                                    (handleChange as any)($event);
                                                }}
                                            >
                                                {(getStatusStrategy() || []).map((flag) => (
                                                    <ElOption label={flag.label} value={flag.value} key={flag.value} />
                                                ))}
                                            </ElSelect>
                                        </ElFormItem>
                                    </ElCol>
                                </ElRow>
                                <ElRow gutter={16}>
                                    <ElCol xs={24} sm={24} md={12} lg={12} xl={12}>
                                        <ElFormItem
                                            label={$t('website.maxFails')}
                                            prop={`servers.${index}.maxFails`}
                                            rules={unref(rules).maxFails}
                                        >
                                            <ElInput
                                                type="number"
                                                modelValue={unref(formData).servers[index].maxFails}
                                                onUpdate:modelValue={($v) => {
                                                    unref(formData).servers[index].maxFails =
                                                        $v === '' ? $v : Number($v);
                                                }}
                                                onInput={($event?: any) => {
                                                    (handleChange as any)($event);
                                                }}
                                                v-slots={{ append: () => <>{$t('commons.units.time')}</> }}
                                            />
                                        </ElFormItem>
                                    </ElCol>
                                    <ElCol xs={24} sm={24} md={12} lg={12} xl={12}>
                                        <ElFormItem
                                            prop={`servers.${index}.failTimeout`}
                                            rules={unref(rules).failTimeout}
                                            v-slots={{
                                                label: () => (
                                                    <>
                                                        <span class={'inline-flex items-center'}>
                                                            {$t('website.failTimeout')}
                                                            <ElTooltip
                                                                content={$t('website.failTimeoutHelper')}
                                                                placement="top"
                                                            >
                                                                <ElIcon>
                                                                    <QuestionFilled />
                                                                </ElIcon>
                                                            </ElTooltip>
                                                        </span>
                                                    </>
                                                ),
                                            }}
                                        >
                                            <ElInput
                                                type="number"
                                                modelValue={unref(formData).servers[index].failTimeout}
                                                onUpdate:modelValue={($v) => {
                                                    unref(formData).servers[index].failTimeout =
                                                        $v === '' ? $v : Number($v);
                                                }}
                                                onInput={($event?: any) => {
                                                    (handleChange as any)($event);
                                                }}
                                                v-slots={{
                                                    append: () => (
                                                        <>
                                                            <ElSelect
                                                                modelValue={
                                                                    unref(formData).servers[index].failTimeoutUnit
                                                                }
                                                                onUpdate:modelValue={($v) => {
                                                                    unref(formData).servers[index].failTimeoutUnit =
                                                                        $v === '' ? $v : Number($v);
                                                                }}
                                                                onChange={($event?: any) => {
                                                                    (handleChange as any)($event);
                                                                }}
                                                                class={'!w-24'}
                                                            >
                                                                {(Units || []).map((unit, indexKey) => (
                                                                    <ElOption
                                                                        label={unit.label}
                                                                        value={unit.value}
                                                                        key={indexKey}
                                                                    />
                                                                ))}
                                                            </ElSelect>
                                                        </>
                                                    ),
                                                }}
                                            />
                                        </ElFormItem>
                                    </ElCol>
                                </ElRow>
                                <ElRow gutter={16}>
                                    <ElCol xs={24} sm={24} md={12} lg={12} xl={12}>
                                        <ElFormItem
                                            label={$t('website.maxConns')}
                                            prop={`servers.${index}.maxConns`}
                                            rules={unref(rules).maxConns}
                                        >
                                            <ElInput
                                                type="number"
                                                modelValue={unref(formData).servers[index].maxConns}
                                                onUpdate:modelValue={($v) => {
                                                    unref(formData).servers[index].maxConns =
                                                        $v === '' ? $v : Number($v);
                                                }}
                                                onInput={($event?: any) => {
                                                    (handleChange as any)($event);
                                                }}
                                            />
                                        </ElFormItem>
                                    </ElCol>
                                </ElRow>
                            </div>
                        </ElCard>
                    ))}
                    {withDirectives(
                        <ElButton
                            type="primary"
                            plain
                            onClick={($event?: any) => {
                                (addServer as any)($event);
                            }}
                            icon="Plus"
                            class={'add-server-btn'}
                        >
                            {$t('commons.button.add')}
                        </ElButton>,
                        [[permissionDirective, true]],
                    )}
                </div>
            </ElForm>
        );
    },
    options,
);
