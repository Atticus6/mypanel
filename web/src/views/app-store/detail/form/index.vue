<template>
    <div>
        <el-alert
            :title="$t('app.hostModeHelper')"
            class="common-prompt"
            :closable="false"
            type="warning"
            v-if="isHostMode"
        />
        <el-alert
            :title="$t('app.memoryRequiredHelper', [computeSizeFromMB(memoryRequired)])"
            class="common-prompt"
            :closable="false"
            type="warning"
            v-if="memoryRequired > 0"
        />

        <el-form
            @validate="(prop, valid) => expandInvalidFormSection(formRef, prop, valid)"
            scroll-to-error
            v-loading="loading"
            @submit.prevent
            ref="formRef"
            label-position="top"
            :model="formData"
            label-width="150px"
            :rules="formRules"
            :validate-on-rule-change="false"
        >
            <component :is="sectioned ? 'details' : 'section'" :open="sectioned" :class="{ 'form-section': sectioned }">
                <summary v-if="sectioned" class="form-section-header">{{ $t('home.baseInfo') }}</summary>
                <div :class="{ 'form-section-body': sectioned }">
                    <el-form-item :label="$t('commons.table.name')" prop="name">
                        <el-input v-model.trim="formData.name"></el-input>
                    </el-form-item>
                    <el-form-item :label="$t('app.version')" prop="version">
                        <el-select v-model="formData.version" @change="handleVersionChange">
                            <el-option
                                v-for="(version, index) in appVersions"
                                :key="index"
                                :label="version"
                                :value="version"
                            ></el-option>
                        </el-select>
                    </el-form-item>

                    <Params
                        :key="paramKey"
                        v-if="showParams"
                        v-model:form="formData.params"
                        v-model:params="installParams"
                        v-model:rules="formRules.params"
                        :propStart="'params.'"
                    />
                </div>
            </component>

            <slot name="after-params" />

            <component :is="sectioned ? 'details' : 'section'" :open="sectioned" :class="{ 'form-section': sectioned }">
                <summary v-if="sectioned" class="form-section-header">{{ $t('app.advanced') }}</summary>
                <el-form-item v-if="!sectioned" prop="advanced">
                    <el-checkbox v-model="formData.advanced" :label="$t('app.advanced')" size="large" />
                </el-form-item>

                <div v-if="formData.advanced" :class="{ 'form-section-body': sectioned }">
                    <el-form-item :label="$t('app.containerName')" prop="containerName">
                        <el-input v-model.trim="formData.containerName" :placeholder="$t('app.containerNameHelper')" />
                    </el-form-item>

                    <el-form-item prop="allowPort" v-if="!isHostMode">
                        <el-checkbox v-model="formData.allowPort" :label="$t('app.allowPort')" size="large" />
                        <span class="input-help">{{ $t('app.allowPortHelper') }}</span>
                    </el-form-item>

                    <el-form-item :label="$t('app.specifyIP')" v-if="formData.allowPort" prop="specifyIP">
                        <el-input v-model="formData.specifyIP" />
                        <span class="input-help">{{ $t('app.specifyIPHelper') }}</span>
                    </el-form-item>

                    <el-form-item :label="$t('container.restartPolicy')" prop="restartPolicy">
                        <el-select v-model="formData.restartPolicy" class="p-w-300">
                            <el-option :label="$t('container.no')" value="no"></el-option>
                            <el-option :label="$t('container.always')" value="always"></el-option>
                            <el-option :label="$t('container.onFailure')" value="on-failure"></el-option>
                            <el-option :label="$t('container.unlessStopped')" value="unless-stopped"></el-option>
                        </el-select>
                    </el-form-item>

                    <el-form-item
                        :label="$t('container.cpuQuota')"
                        prop="cpuQuota"
                        :rules="checkNumberRange(0, limits.cpu)"
                    >
                        <el-input type="number" class="!w-2/5" v-model.number="formData.cpuQuota" maxlength="5">
                            <template #append>{{ $t('app.cpuCore') }}</template>
                        </el-input>
                        <span class="input-help">
                            {{ $t('container.limitHelper', [limits.cpu]) }}{{ $t('commons.units.core') }}
                        </span>
                    </el-form-item>

                    <el-form-item
                        :label="$t('container.memoryLimit')"
                        prop="memoryLimit"
                        :rules="checkNumberRange(0, limits.memory)"
                    >
                        <el-input class="!w-2/5" v-model.number="formData.memoryLimit" maxlength="10">
                            <template #append>
                                <el-select
                                    v-model="formData.memoryUnit"
                                    placeholder="Select"
                                    class="p-w-100"
                                    @change="changeUnit"
                                >
                                    <el-option label="MB" value="M" />
                                    <el-option label="GB" value="G" />
                                </el-select>
                            </template>
                        </el-input>
                        <span class="input-help">
                            {{ $t('container.limitHelper', [limits.memory]) }}{{ formData.memoryUnit }}B
                        </span>
                    </el-form-item>

                    <el-form-item pro="gpuConfig" v-if="gpuSupport && !hideGpuConfig">
                        <el-checkbox v-model="formData.gpuConfig" :label="$t('app.gpuConfig')" size="large" />
                        <span class="input-help">{{ $t('app.gpuConfigHelper') }}</span>
                    </el-form-item>

                    <el-form-item pro="pullImage">
                        <el-checkbox v-model="formData.pullImage" :label="$t('app.pullImage')" size="large" />
                        <span class="input-help">{{ $t('app.pullImageHelper') }}</span>
                    </el-form-item>

                    <PushToNode
                        v-if="isMaster && isXpackOrEE && batchInstallSupport"
                        :push-node="formData.pushNode"
                        :nodes="formData.nodes"
                        type="app"
                        @update:push-node="formData.pushNode = $event"
                        @update:nodes="formData.nodes = $event"
                    />

                    <el-form-item prop="editCompose">
                        <el-checkbox v-model="formData.editCompose" :label="$t('app.editCompose')" size="large" />
                        <span class="input-help">{{ $t('app.editComposeHelper') }}</span>
                    </el-form-item>

                    <div v-if="formData.editCompose">
                        <CodemirrorPro v-model="formData.dockerCompose" mode="yaml" />
                    </div>
                </div>
            </component>
        </el-form>
    </div>
</template>

<script lang="ts" setup>
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

export interface FromParam {
    type: string;
    key: string;
    value: string;
    envKey: string;
}

export interface FromFieldChild extends FromField {
    services: App.AppService[];
}

export interface ServiceParam {
    label: '';
    value: '';
    from?: '';
}

export interface FromField {
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

export interface AppParams {
    formFields: FromField[];
}
import { expandInvalidFormSection } from '@/components/form-section';
import { Rules, checkNumberRange } from '@/global/form-rules';
import { rpc } from '@/lib/rpc';
import { FormInstance, FormRules } from 'element-plus';
import { ref, watch } from 'vue';
import Params from '../params/index.vue';
import { Container } from '@/types/container';
import CodemirrorPro from '@/components/codemirror-pro/index.vue';
import { computeSizeFromMB } from '@/utils/size';
import { useGlobalStore } from '@/composables/useGlobalStore';
const { isMaster, isOffline, isXpackOrEE } = useGlobalStore();

const PushToNode = defineAsyncComponent(async () => {
    const modules = import.meta.glob('@/xpack/views/ssl/index.vue');
    const loader = modules['/src/xpack/views/ssl/index.vue'];
    if (loader) {
        return ((await loader()) as any).default;
    }
    return { template: '<div></div>' };
});

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

const limits = ref<Container.ResourceLimit>({
    cpu: null as number,
    memory: null as number,
});

const props = withDefaults(defineProps<Props>(), {
    loading: false,
    batchInstallSupport: false,
    sectioned: false,
});

interface Emits {
    (e: 'update:modelValue', value: any): void;
}

const emit = defineEmits<Emits>();

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

const formData = ref(props.modelValue || initFormData());

watch(
    formData.value,
    (newVal) => {
        emit('update:modelValue', newVal);
    },
    { deep: true },
);

watch(
    () => props.modelValue,
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

const initClusterForm = async (props: ClusterProps) => {
    if (props.appInstallID && props.masterNode) {
        getMasterAppInstall(props.appInstallID);
    }
    masterNodeAddr.value = props.masterNodeAddr;
    await loadInstallDefaultConfig();
    const res = await rpc.app.getApp({ key: props.key });
    currentApp.value = res;
    appVersions.value = currentApp.value.versions;
    if (appVersions.value.length > 0) {
        appVersions.value = appVersions.value.filter((v: string) => {
            return v.includes(props.role) && v.includes(props.masterVersion);
        });
        const defaultVersion = appVersions.value[0];
        formData.value.version = defaultVersion;
        getVersionDetail(defaultVersion);
    }
    formData.value.name = props.key + '-' + props.role;
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

defineExpose({
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
</script>

<style lang="scss" scoped>
@use '@/components/form-section/index.scss';
</style>
