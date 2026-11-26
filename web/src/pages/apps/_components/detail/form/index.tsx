import { $t } from '@/utils/i18n-t';
interface Locale {
    zh: string;
    en: string;
    'zh-Hant': string;
    ja: string;
    ms: string;
    'pt-br': string;
    ru: string;
    ko: string;
    tr: string;
    'es-es': string;
    fa: string;
    lo: string;
}
import type { App } from '@/types/app';
interface FromParam {
    type: string;
    key: string;
    value: string;
    envKey: string;
}
interface FromFieldChild extends FromField {
    services: App.AppService[];
}
interface ServiceParam {
    label: '';
    value: '';
    from?: '';
}
interface FromField {
    type: string;
    labelZh: string;
    labelEn: string;
    required: boolean;
    default: any;
    envKey: string;
    key?: string;
    values?: ServiceParam[];
    child?: FromFieldChild;
    params?: FromParam[];
    multiple?: boolean;
    allowCreate?: boolean;
    label: Locale;
    description: Locale;
}
interface AppParams {
    formFields: FromField[];
}
import { expandInvalidFormSection } from '@/components/form-section';
import { Rules, checkNumberRange } from '@/global/form-rules';
import { rpc } from '@/lib/rpc';
import Params from '../params/index';
import { Container } from '@/types/container';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { computeSizeFromMB } from '@/utils/size';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface ClusterProps {
    key: string;
    node: string;
    masterNode: string;
    appInstallID: number;
    masterVersion: string;
    masterNodeAddr: string;
    role: string;
}
interface Props {
    loading?: boolean;
    modelValue?: any;
    batchInstallSupport?: boolean;
    sectioned?: boolean;
    hideGpuConfig?: boolean;
}
interface Emits {
    (e: 'update:modelValue', value: any): void;
}
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    loading?: boolean;
    modelValue?: any;
    batchInstallSupport?: boolean;
    sectioned?: boolean;
    hideGpuConfig?: boolean;
}

const emits = {};

type SlotsShape = {
    'after-params': (arg?: unknown) => VNode[];
};

const options = {
    name: 'form',
    props: {
        loading: Boolean,
        modelValue: { type: null },
        batchInstallSupport: Boolean,
        sectioned: Boolean,
        hideGpuConfig: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-f7444ba4',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const { isMaster, isOffline, isXpackOrEE } = useGlobalStore();
        const PushToNode = defineAsyncComponent(async () => {
            const modules = import.meta.glob('@/xpack/views/ssl/index.vue');
            const loader = modules['/src/xpack/views/ssl/index.vue'];
            if (loader) {
                return ((await loader()) as any).default;
            }
            return { template: '<div></div>' };
        });
        const limits = ref<Container.ResourceLimit>({
            cpu: null as number,
            memory: null as number,
        });
        const formRef = ref<FormInstance>();
        const paramKey = ref(1);
        const isHostMode = ref(false);
        const memoryRequired = ref(0);
        const gpuSupport = ref(false);
        const installParams = ref<AppParams>();
        const oldMemory = ref<number>(0);
        const showParams = ref(false);
        const currentApp = ref<any>({});
        const appVersions = ref<string[]>([]);
        const env = ref();
        const masterNodeAddr = ref();
        const formRules = ref<FormRules>({
            name: [Rules.appName],
            params: [],
            version: [Rules.requiredSelect],
            containerName: [Rules.containerName],
            cpuQuota: [Rules.requiredInput, checkNumberRange(0, 99999)],
            memoryLimit: [Rules.requiredInput, checkNumberRange(0, 9999999999)],
            specifyIP: [Rules.ipv4orV6],
            restartPolicy: [Rules.requiredSelect],
            format: [Rules.requiredInput],
            nodes: [Rules.requiredSelect],
        });
        const initFormData = () => ({
            appDetailId: 0,
            params: {},
            name: '',
            advanced: true,
            cpuQuota: 0,
            memoryLimit: 0,
            memoryUnit: 'M',
            containerName: '',
            allowPort: false,
            editCompose: false,
            dockerCompose: '',
            version: '',
            appID: '',
            pullImage: true,
            taskID: '',
            gpuConfig: false,
            specifyIP: '',
            restartPolicy: 'always',
            pushNode: false,
            nodes: [],
        });
        const formData = ref(__panelSetupProps.modelValue || initFormData());
        watch(
            formData.value,
            (newVal) => {
                ctx.emit('update:modelValue', newVal);
            },
            { deep: true },
        );
        watch(
            () => __panelSetupProps.modelValue,
            (newVal) => {
                if (newVal) {
                    Object.assign(formData.value, newVal);
                }
            },
            { immediate: true, deep: true },
        );
        const changeUnit = () => {
            if (formData.value.memoryUnit == 'M') {
                limits.value.memory = oldMemory.value;
            } else {
                limits.value.memory = Number((oldMemory.value / 1024).toFixed(2));
            }
        };
        const handleVersionChange = async (version: string) => {
            await getVersionDetail(version);
        };
        const getVersionDetail = async (version: string) => {
            formData.value.appDetailId = 0;
            formData.value.dockerCompose = '';
            formData.value.params = {};
            formRules.value.params = [];
            showParams.value = false;
            isHostMode.value = false;
            memoryRequired.value = 0;
            gpuSupport.value = false;

            try {
                const res = await rpc.app.getAppDetail({ appId: currentApp.value.id, version, type: 'app' });
                const detail = JSON.parse(res.detailJson || '{}');
                if (formData.value.version !== version) {
                    return;
                }
                formData.value.appDetailId = detail.id;
                formData.value.dockerCompose = detail.dockerCompose;
                isHostMode.value = detail.hostMode;
                if (env.value) {
                    installParams.value = addMasterParams(detail.params);
                } else {
                    installParams.value = detail.params;
                }
                paramKey.value++;
                memoryRequired.value = detail.memoryRequired;
                gpuSupport.value = detail.gpuSupport;
                showParams.value = true;
            } catch (error) {}
        };
        const loadInstallDefaultConfig = async () => {
            try {
                const res = await rpc.core.setting.getAppStoreConfig({});
                formData.value.allowPort = res.installAllowPort === 'Enable';
            } catch (error) {
                formData.value.allowPort = false;
            }
        };
        const initForm = async (appKey: string, allowPort?: boolean) => {
            env.value = undefined;
            masterNodeAddr.value = undefined;
            formData.value.name = appKey.replace(/^local/, '');
            if (allowPort === undefined) {
                await loadInstallDefaultConfig();
            } else {
                formData.value.allowPort = allowPort;
            }
            const res = await rpc.app.getApp({ key: appKey });
            currentApp.value = res;
            appVersions.value = currentApp.value.versions;
            if (appVersions.value.length > 0) {
                const defaultVersion = appVersions.value[0];
                formData.value.version = defaultVersion;
                await getVersionDetail(defaultVersion);
            }
            if (isOffline.value) {
                formData.value.pullImage = false;
            }
        };
        const getMasterAppInstall = async (appInstallID: number) => {
            try {
                const res = await rpc.app.getInstalledInfo({ appInstallId: appInstallID });
                env.value = JSON.parse(res.envJson || '{}');
            } catch (error) {}
        };
        const addMasterParams = (appParams: AppParams) => {
            for (const key in appParams.formFields) {
                const field = appParams.formFields[key];
                if (field?.envKey === 'MASTER_ROOT_PASSWORD') {
                    field.default = env.value['PANEL_DB_ROOT_PASSWORD']
                        ? env.value['PANEL_DB_ROOT_PASSWORD']
                        : env.value['PANEL_REDIS_ROOT_PASSWORD'];
                }
                if (field?.envKey === 'PANEL_DB_ROOT_PASSWORD') {
                    field.default = env.value['PANEL_DB_ROOT_PASSWORD'];
                }
                if (field?.envKey === 'REPLICATION_USER') {
                    field.default = env.value['REPLICATION_USER'];
                }
                if (field?.envKey === 'REPLICATION_PASSWORD') {
                    field.default = env.value['REPLICATION_PASSWORD'];
                }
                if (field?.envKey === 'MASTER_PORT') {
                    field.default = env.value['PANEL_APP_PORT_HTTP'];
                }
                if (field?.envKey === 'MASTER_HOST' && masterNodeAddr.value != '127.0.0.1') {
                    field.default = masterNodeAddr.value;
                }
            }
            return appParams;
        };
        const initClusterForm = async (__panelSetupProps: ClusterProps) => {
            if (__panelSetupProps.appInstallID && __panelSetupProps.masterNode) {
                getMasterAppInstall(__panelSetupProps.appInstallID);
            }
            masterNodeAddr.value = __panelSetupProps.masterNodeAddr;
            await loadInstallDefaultConfig();
            const res = await rpc.app.getApp({ key: __panelSetupProps.key });
            currentApp.value = res;
            appVersions.value = currentApp.value.versions;
            if (appVersions.value.length > 0) {
                appVersions.value = appVersions.value.filter((v: string) => {
                    return v.includes(__panelSetupProps.role) && v.includes(__panelSetupProps.masterVersion);
                });
                const defaultVersion = appVersions.value[0];
                formData.value.version = defaultVersion;
                getVersionDetail(defaultVersion);
            }
            formData.value.name = __panelSetupProps.key + '-' + __panelSetupProps.role;
        };
        const resetForm = () => {
            if (formRef.value) {
                formRef.value.clearValidate();
                formRef.value.resetFields();
            }
            Object.assign(formData.value, initFormData());
            isHostMode.value = false;
            memoryRequired.value = 0;
            gpuSupport.value = false;
            showParams.value = false;
        };
        const validate = async (): Promise<boolean> => {
            if (!formRef.value) return false;
            try {
                const isValid = await formRef.value.validate();
                return isValid;
            } catch (error) {
                return false;
            }
        };
        const clearValidate = () => {
            if (formRef.value) {
                formRef.value.clearValidate();
            }
        };
        const getFormData = () => {
            return { ...formData.value };
        };
        const setFormData = (data: any) => {
            Object.assign(formData.value, data);
        };
        const loadLimit = async () => {
            const res = await rpc.container.getLimit({});
            limits.value = { cpu: res.cpu, memory: Number(res.memory) } as any;
            limits.value.memory = Number((limits.value.memory / 1024 / 1024).toFixed(2));
            oldMemory.value = limits.value.memory;
        };
        onMounted(() => {
            loadLimit();
        });
        ctx.expose({
            formRef,
            formData,
            initForm,
            resetForm,
            validate,
            clearValidate,
            getFormData,
            setFormData,
            isHostMode: () => isHostMode.value,
            initClusterForm,
        });
        return () => (
            <div>
                {unref(isHostMode) ? (
                    <ElAlert title={$t('app.hostModeHelper')} closable={false} type="warning" class={'common-prompt'} />
                ) : null}
                {unref(memoryRequired) > 0 ? (
                    <ElAlert
                        title={$t('app.memoryRequiredHelper', [computeSizeFromMB(unref(memoryRequired))])}
                        closable={false}
                        type="warning"
                        class={'common-prompt'}
                    />
                ) : null}
                {
                    <ElForm
                        onValidate={($event?: any) => {
                            (prop, valid) => expandInvalidFormSection(unref(formRef), prop, valid);
                        }}
                        scroll-to-error
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        ref={formRef}
                        label-position="top"
                        model={unref(formData)}
                        label-width="150px"
                        rules={unref(formRules)}
                        validate-on-rule-change={false}
                        v-loading={__panelSetupProps.loading}
                    >
                        {h(
                            __panelSetupProps.sectioned ? 'details' : 'section',
                            {
                                open: __panelSetupProps.sectioned,
                                class: { 'form-section': __panelSetupProps.sectioned },
                            },
                            {
                                default: () => (
                                    <>
                                        {__panelSetupProps.sectioned ? (
                                            <summary class={'form-section-header'}>{$t('home.baseInfo')}</summary>
                                        ) : null}
                                        <div class={{ 'form-section-body': __panelSetupProps.sectioned }}>
                                            <ElFormItem label={$t('commons.table.name')} prop="name">
                                                <ElInput
                                                    modelValue={unref(formData).name}
                                                    onUpdate:modelValue={($v) => {
                                                        unref(formData).name = typeof $v === 'string' ? $v.trim() : $v;
                                                    }}
                                                />
                                            </ElFormItem>
                                            <ElFormItem label={$t('app.version')} prop="version">
                                                <ElSelect
                                                    v-model={unref(formData).version}
                                                    onChange={($event?: any) => {
                                                        (handleVersionChange as any)($event);
                                                    }}
                                                >
                                                    {(unref(appVersions) || []).map((version, index) => (
                                                        <ElOption label={version} value={version} key={index} />
                                                    ))}
                                                </ElSelect>
                                            </ElFormItem>
                                            {unref(showParams) ? (
                                                <Params
                                                    form={unref(formData).params}
                                                    onUpdate:form={($v) => {
                                                        unref(formData).params = $v as any;
                                                    }}
                                                    params={unref(installParams)}
                                                    onUpdate:params={($v) => {
                                                        installParams.value = $v as any;
                                                    }}
                                                    rules={unref(formRules).params}
                                                    onUpdate:rules={($v) => {
                                                        unref(formRules).params = $v as any;
                                                    }}
                                                    propStart={'params.'}
                                                    key={unref(paramKey)}
                                                />
                                            ) : null}
                                        </div>
                                    </>
                                ),
                            },
                        )}
                        {ctx.slots['after-params']?.(undefined)}
                        {h(
                            __panelSetupProps.sectioned ? 'details' : 'section',
                            {
                                open: __panelSetupProps.sectioned,
                                class: { 'form-section': __panelSetupProps.sectioned },
                            },
                            {
                                default: () => (
                                    <>
                                        {__panelSetupProps.sectioned ? (
                                            <summary class={'form-section-header'}>{$t('app.advanced')}</summary>
                                        ) : null}
                                        {!__panelSetupProps.sectioned ? (
                                            <ElFormItem prop="advanced">
                                                <ElCheckbox
                                                    v-model={unref(formData).advanced}
                                                    label={$t('app.advanced')}
                                                    size="large"
                                                />
                                            </ElFormItem>
                                        ) : null}
                                        {unref(formData).advanced ? (
                                            <div class={{ 'form-section-body': __panelSetupProps.sectioned }}>
                                                <ElFormItem label={$t('app.containerName')} prop="containerName">
                                                    <ElInput
                                                        modelValue={unref(formData).containerName}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(formData).containerName =
                                                                typeof $v === 'string' ? $v.trim() : $v;
                                                        }}
                                                        placeholder={$t('app.containerNameHelper')}
                                                    />
                                                </ElFormItem>
                                                {!unref(isHostMode) ? (
                                                    <ElFormItem prop="allowPort">
                                                        <ElCheckbox
                                                            v-model={unref(formData).allowPort}
                                                            label={$t('app.allowPort')}
                                                            size="large"
                                                        />
                                                        <span class={'input-help'}>{$t('app.allowPortHelper')}</span>
                                                    </ElFormItem>
                                                ) : null}
                                                {unref(formData).allowPort ? (
                                                    <ElFormItem label={$t('app.specifyIP')} prop="specifyIP">
                                                        <ElInput v-model={unref(formData).specifyIP} />
                                                        <span class={'input-help'}>{$t('app.specifyIPHelper')}</span>
                                                    </ElFormItem>
                                                ) : null}
                                                <ElFormItem label={$t('container.restartPolicy')} prop="restartPolicy">
                                                    <ElSelect v-model={unref(formData).restartPolicy} class={'p-w-300'}>
                                                        <ElOption label={$t('container.no')} value="no" />
                                                        <ElOption label={$t('container.always')} value="always" />
                                                        <ElOption
                                                            label={$t('container.onFailure')}
                                                            value="on-failure"
                                                        />
                                                        <ElOption
                                                            label={$t('container.unlessStopped')}
                                                            value="unless-stopped"
                                                        />
                                                    </ElSelect>
                                                </ElFormItem>
                                                <ElFormItem
                                                    label={$t('container.cpuQuota')}
                                                    prop="cpuQuota"
                                                    rules={checkNumberRange(0, unref(limits).cpu)}
                                                >
                                                    <ElInput
                                                        type="number"
                                                        modelValue={unref(formData).cpuQuota}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(formData).cpuQuota = $v === '' ? $v : Number($v);
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
                                                        modelValue={unref(formData).memoryLimit}
                                                        onUpdate:modelValue={($v) => {
                                                            unref(formData).memoryLimit = $v === '' ? $v : Number($v);
                                                        }}
                                                        maxlength="10"
                                                        class={'!w-2/5'}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    <ElSelect
                                                                        v-model={unref(formData).memoryUnit}
                                                                        placeholder="Select"
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
                                                        {unref(formData).memoryUnit}
                                                        {'B '}
                                                    </span>
                                                </ElFormItem>
                                                {unref(gpuSupport) && !__panelSetupProps.hideGpuConfig ? (
                                                    <ElFormItem pro="gpuConfig">
                                                        <ElCheckbox
                                                            v-model={unref(formData).gpuConfig}
                                                            label={$t('app.gpuConfig')}
                                                            size="large"
                                                        />
                                                        <span class={'input-help'}>{$t('app.gpuConfigHelper')}</span>
                                                    </ElFormItem>
                                                ) : null}
                                                <ElFormItem pro="pullImage">
                                                    <ElCheckbox
                                                        v-model={unref(formData).pullImage}
                                                        label={$t('app.pullImage')}
                                                        size="large"
                                                    />
                                                    <span class={'input-help'}>{$t('app.pullImageHelper')}</span>
                                                </ElFormItem>
                                                {unref(isMaster) &&
                                                unref(isXpackOrEE) &&
                                                __panelSetupProps.batchInstallSupport ? (
                                                    <PushToNode
                                                        push-node={unref(formData).pushNode}
                                                        nodes={unref(formData).nodes}
                                                        type="app"
                                                        onUpdate:push-node={($event?: any) => {
                                                            unref(unref(formData)).pushNode = $event;
                                                        }}
                                                        onUpdate:nodes={($event?: any) => {
                                                            unref(unref(formData)).nodes = $event;
                                                        }}
                                                    />
                                                ) : null}
                                                <ElFormItem prop="editCompose">
                                                    <ElCheckbox
                                                        v-model={unref(formData).editCompose}
                                                        label={$t('app.editCompose')}
                                                        size="large"
                                                    />
                                                    <span class={'input-help'}>{$t('app.editComposeHelper')}</span>
                                                </ElFormItem>
                                                {unref(formData).editCompose ? (
                                                    <div>
                                                        <CodemirrorPro
                                                            v-model={unref(formData).dockerCompose}
                                                            mode="yaml"
                                                        />
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </>
                                ),
                            },
                        )}
                    </ElForm>
                }
            </div>
        );
    },
    options,
);
