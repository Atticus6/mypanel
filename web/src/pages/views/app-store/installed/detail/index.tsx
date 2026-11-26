import { $t } from '@/utils/i18n-t';
import type { DescMessage, MessageInitShape } from '@bufbuild/protobuf';
type Init<T extends DescMessage> = MessageInitShape<T>;
import { UpdateInstalledConfigRequestSchema } from '@/gen/panel/agent/v1/app_pb';
import type { AI } from '@/types/ai';
type AppConfigUpdate = Init<typeof UpdateInstalledConfigRequestSchema> & {
    installID: number;
    webUI: string;
};
interface AppConfig {
    gpu?: AI.ModelGPUConfig;
    appKey: string;
    name: string;
    httpPort: number;
    syncModelAccount: boolean;
    modelAccountBaseURLType: string;
    modelAccountBaseURL: string;
    params: InstallParams[];
    rawCompose?: string;
    isEdit?: boolean;
    cpuQuota: number;
    memoryLimit: number;
    memoryUnit: string;
    containerName: string;
    allowPort: boolean;
    dockerCompose: string;
    hostMode?: boolean;
    type: string;
    webUI: string;
    specifyIP: string;
    restartPolicy: string;
}
interface InstallParams {
    labelZh: string;
    labelEn: string;
    value: any;
    edit: boolean;
    key: string;
    rule: string;
    type: string;
    values?: any;
    showValue?: string;
    required?: boolean;
    multiple?: boolean;
    label: Locale;
    showPassword: boolean;
}
import { expandInvalidFormSection } from '@/components/form-section';
import AccountAddress from '@/pages/views/ai/components/account-address/index';
import GPUConfig from '@/pages/views/ai/components/gpu-config/index';
import Diff from '@/pages/views/app-store/installed/upgrade/diff/index';
import { Rules, checkNumberRange } from '@/global/form-rules';
import { MsgError, MsgSuccess } from '@/utils/message';
import { getLabel } from '@/utils/app-store';
import { splitHttp, checkIpV4V6, checkDomain } from '@/utils/validate';
import i18n from '@/lang';
import { Container } from '@/types/container';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
interface ParamProps {
    id: number;
    app?: any;
    edit?: boolean;
}
interface EditForm extends InstallParams {
    default: any;
}
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';
import CopyButton from '@/components/copy-button/index';
import CodemirrorPro from '@/components/codemirror-pro/index';

interface CodemodProps {
    [key: string]: any;
    modelGPU?: boolean;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'detail',
    props: {
        modelGPU: { type: Boolean },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-2458cf4e',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const paramData = ref<ParamProps>({
            id: 0,
            app: {},
        });
        const { currentNode, isMobile } = useGlobalStore();
        const open = ref(false);
        const loading = ref(false);
        const params = ref<EditForm[]>();
        const edit = ref(false);
        const paramForm = ref<FormInstance>();
        const paramModel = reactive<any>({
            params: {},
        });
        const advancedFields = [
            'memoryLimit',
            'cpuQuota',
            'memoryUnit',
            'allowPort',
            'specifyIP',
            'containerName',
            'restartPolicy',
        ];
        let initialAdvancedConfig: Record<string, unknown> = {};
        const rules = reactive({
            params: {},
            cpuQuota: [Rules.requiredInput, checkNumberRange(0, 999)],
            memoryLimit: [Rules.requiredInput, checkNumberRange(0, 9999999999)],
            containerName: [Rules.containerName],
            restartPolicy: [Rules.requiredSelect],
        });
        const appType = ref('');
        const appKey = ref('');
        const showModelGPU = computed(() => __panelSetupProps.modelGPU && appKey.value === 'ollama');
        const accountRef = ref<InstanceType<typeof AccountAddress>>();
        const syncSectionRef = ref<HTMLDetailsElement>();
        const gpuRef = ref<InstanceType<typeof GPUConfig>>();
        const appConfigUpdate = ref<AppConfigUpdate>({
            installID: 0,
            webUI: '',
        });
        const openConfig = ref(false);
        const webUI = reactive({
            protocol: 'http://',
            domain: '',
        });
        const limits = ref<Container.ResourceLimit>({
            cpu: null as number,
            memory: null as number,
        });
        const oldMemory = ref<number>(0);
        const composeDiffRef = ref();
        const rawCompose = ref('');
        const getNewCompose = (compose: string) => {
            if (compose != '') {
                paramModel.dockerCompose = compose;
            }
        };
        const openDiff = () => {
            composeDiffRef.value.acceptParams(rawCompose.value, paramModel.dockerCompose);
        };
        function checkWebUI() {
            if (webUI.domain !== '') {
                let domain = webUI.domain;
                let port = null;

                if (domain.includes('/')) {
                    domain = domain.split('/')[0];
                }

                if (domain.includes(':')) {
                    const parts = domain.split(':');
                    domain = parts[0];
                    port = parts[1];

                    if (!checkPort(port)) {
                        return false;
                    }
                }

                if (checkIpV4V6(domain) && checkDomain(domain)) {
                    return false;
                }
            }
            return true;
        }
        function checkPort(port: string) {
            const portNum = parseInt(port, 10);
            return !isNaN(portNum) && portNum > 0 && portNum <= 65535;
        }
        const acceptParams = async (__panelSetupProps: ParamProps) => {
            params.value = [];
            paramData.value.id = __panelSetupProps.id;
            paramModel.params = {};
            edit.value = false;
            rules.params = {};
            if (!(await get())) return;
            open.value = true;
            openConfig.value = false;
            if (__panelSetupProps.edit) await editParam();
        };
        const handleClose = () => {
            ctx.emit('close');
            open.value = false;
        };
        const editParam = async () => {
            params.value.forEach((param: EditForm) => {
                paramModel.params[param.key] = param.value;
            });

            edit.value = !edit.value;
            loadLimit();
            if (edit.value && showModelGPU.value) {
                await nextTick();
                await gpuRef.value?.init(false);
            }
        };
        const changeAllowPort = () => {
            if (paramModel.allowPort) {
                paramModel.specifyIP = '';
            }
        };
        const get = async () => {
            try {
                loading.value = true;
                const res = await rpc.app.getInstalledParams({ appInstallId: Number(paramData.value.id) });
                // 容器相关字段随应用定义变化，服务端以 JSON 透传，这里合并回原 AppConfig 形状。
                const config: AppConfig = Object.assign(
                    {
                        appKey: res.appKey,
                        name: res.name,
                        httpPort: res.httpPort,
                        syncModelAccount: res.syncModelAccount,
                        modelAccountBaseURLType: res.modelAccountBaseUrlType,
                        modelAccountBaseURL: res.modelAccountBaseUrl,
                        params: JSON.parse(res.paramsJson || '[]'),
                        rawCompose: res.rawCompose,
                        isEdit: res.isEdit,
                    },
                    JSON.parse(res.containerJson || '{}'),
                );
                rawCompose.value = config.rawCompose;
                const configParams = config.params || [];
                if (configParams && configParams.length > 0) {
                    configParams.forEach((d) => {
                        let value = d.value;
                        if (d.type === 'number') {
                            value = Number(value);
                        }
                        params.value.push({
                            default: value,
                            labelEn: d.labelEn,
                            labelZh: d.labelZh,
                            rule: d.rule,
                            value: value,
                            edit: d.edit,
                            key: d.key,
                            type: d.type,
                            values: d.values,
                            showValue: d.showValue,
                            multiple: d.multiple,
                            label: d.label,
                            required: d.required,
                            showPassword: false,
                        });
                        if (d.required) {
                            rules.params[d.key] = [Rules.requiredInput];
                            if (d.rule) {
                                rules.params[d.key].push(Rules[d.rule]);
                            }
                        } else {
                            rules.params[d.key] = [];
                        }
                    });
                }
                paramModel.memoryLimit = config.memoryLimit;
                paramModel.cpuQuota = config.cpuQuota;
                paramModel.memoryUnit = config.memoryUnit !== '' ? config.memoryUnit : 'MB';
                paramModel.allowPort = config.allowPort;
                paramModel.containerName = config.containerName;
                paramModel.advanced = false;
                paramModel.editCompose = false;
                paramModel.dockerCompose = config.dockerCompose;
                paramModel.isHostMode = config.hostMode;
                paramModel.specifyIP = config.specifyIP;
                paramModel.restartPolicy = config.restartPolicy || 'no';
                if (paramModel.restartPolicy === 'on-failure:5') {
                    paramModel.restartPolicy = 'on-failure';
                }
                appConfigUpdate.value.webUI = config.webUI;
                if (config.webUI != '') {
                    const httpConfig = splitHttp(config.webUI);
                    webUI.domain = httpConfig.url;
                    webUI.protocol = httpConfig.proto + '://';
                }
                appType.value = config.type;
                appKey.value = config.appKey;
                if (showModelGPU.value) {
                    paramModel.gpu = config.gpu || {
                        enabled: false,
                        mode: 'devices',
                        deviceIDs: [],
                        capabilities: ['gpu', 'utility', 'compute'],
                        error: i18n.global.t('aiTools.model.loadFailed'),
                    };
                }
                paramModel.name = config.name;
                paramModel.httpPort = config.httpPort;
                paramModel.syncModelAccount = config.syncModelAccount;
                paramModel.modelAccountBaseURLType = config.modelAccountBaseURLType || 'container';
                paramModel.modelAccountBaseURL = config.modelAccountBaseURL;
                initialAdvancedConfig = Object.fromEntries(advancedFields.map((key) => [key, paramModel[key]]));
                return true;
            } catch (error) {
                return false;
            } finally {
                loading.value = false;
            }
        };
        const submit = async (formEl: FormInstance) => {
            if (!formEl || loading.value || gpuRef.value?.loading) return;
            const node = currentNode.value;
            const installId = paramData.value.id;
            await formEl.validate((valid) => {
                if (!valid) return;
                ElMessageBox.confirm(i18n.global.t('app.updateWarn'), i18n.global.t('commons.button.update'), {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                }).then(async () => {
                    if (!open.value || node !== currentNode.value || installId !== paramData.value.id) return;
                    const submitModel: Record<string, any> = { installId, params: paramModel.params };
                    if (showModelGPU.value) submitModel.gpu = paramModel.gpu;
                    if (appKey.value === 'ollama') {
                        submitModel.syncModelAccount = paramModel.syncModelAccount;
                        submitModel.modelAccountBaseURLType = paramModel.modelAccountBaseURLType;
                        submitModel.modelAccountBaseURL = accountRef.value.baseURL;
                    }
                    const updateAdvanced =
                        appKey.value === 'ollama'
                            ? paramModel.editCompose ||
                              advancedFields.some((key) => paramModel[key] !== initialAdvancedConfig[key])
                            : paramModel.advanced;
                    if (updateAdvanced) {
                        submitModel.advanced = true;
                        for (const key of advancedFields) {
                            submitModel[key] = paramModel[key];
                        }
                        if (paramModel.editCompose) {
                            submitModel.editCompose = paramModel.editCompose;
                            submitModel.dockerCompose = paramModel.dockerCompose;
                        }
                    }
                    try {
                        loading.value = true;
                        await rpc.app.updateInstalled({
                            installId: submitModel.installId,
                            payloadJson: JSON.stringify(submitModel),
                        });
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        handleClose();
                    } catch (error) {
                        loading.value = false;
                    }
                });
            });
        };
        const updateAppConfig = async () => {
            try {
                let req = {
                    installID: Number(paramData.value.id),
                    webUI: webUI.protocol + webUI.domain,
                };
                if (!webUI.domain || webUI.domain === '') {
                    req.webUI = '';
                }
                if (!checkWebUI()) {
                    MsgError(i18n.global.t('commons.rule.host'));
                    return;
                }
                await rpc.app.updateInstalledConfig({ installId: req.installID, webUi: req.webUI });
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                handleClose();
            } catch (error) {}
        };
        const showCopyButton = (key: string) => {
            const keys = [
                'PANEL_DB_ROOT_PASSWORD',
                'PANEL_DB_NAME',
                'PANEL_DB_USER',
                'PANEL_DB_USER_PASSWORD',
                'PANEL_REDIS_ROOT_PASSWORD',
                'PANEL_DB_ROOT_USER',
            ];
            for (let i = 0; i < keys.length; i++) {
                if (key === keys[i]) {
                    return true;
                }
            }
            return false;
        };
        const loadLimit = async () => {
            const res = await rpc.container.getLimit({});
            limits.value = { cpu: res.cpu, memory: Number(res.memory) } as any;
            limits.value.memory = Number((limits.value.memory / 1024 / 1024).toFixed(2));
            oldMemory.value = limits.value.memory;
        };
        const changeUnit = () => {
            if (paramModel.memoryUnit == 'M') {
                limits.value.memory = oldMemory.value;
            } else {
                limits.value.memory = Number((oldMemory.value / 1024).toFixed(2));
            }
        };
        onBeforeUnmount(() => {
            open.value = false;
        });
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('app.param')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size={unref(isMobile) ? 'full' : unref(appKey) === 'ollama' ? 'large' : 'normal'}
                v-slots={{
                    buttons: () => (
                        <>
                            <ElButton
                                type="primary"
                                plain
                                onClick={($event?: any) => {
                                    (editParam as any)($event);
                                }}
                                disabled={unref(loading)}
                                icon={unref(edit) ? '' : 'Edit'}
                            >
                                {unref(edit) ? $t('app.detail') : $t('commons.button.edit')}
                            </ElButton>
                        </>
                    ),
                    footer: () => (
                        <>
                            <ElButton
                                onClick={($event?: any) => {
                                    (handleClose as any)($event);
                                }}
                                disabled={unref(loading)}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            <ElButton
                                type="primary"
                                disabled={unref(loading) || unref(gpuRef)?.loading}
                                onClick={($event?: any) => {
                                    submit(unref(paramForm));
                                }}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                {!unref(edit) ? (
                    <div>
                        <ElDescriptions border column={1}>
                            <ElDescriptionsItem label={$t('app.webUI')}>
                                {!unref(openConfig) ? (
                                    <span>
                                        {unref(appConfigUpdate).webUI}
                                        <ElButton
                                            size="small"
                                            onClick={($event?: any) => {
                                                openConfig.value = true;
                                            }}
                                        >
                                            {$t('container.custom')}
                                        </ElButton>
                                    </span>
                                ) : (
                                    <span class={'flex'}>
                                        <ElInput
                                            modelValue={webUI.domain}
                                            onUpdate:modelValue={($v) => {
                                                webUI.domain = $v as any;
                                            }}
                                            placeholder={$t('app.webUIPlaceholder')}
                                            v-slots={{
                                                prepend: () => (
                                                    <>
                                                        <ElSelect
                                                            modelValue={webUI.protocol}
                                                            onUpdate:modelValue={($v) => {
                                                                webUI.protocol = $v as any;
                                                            }}
                                                            class={'pre-select'}
                                                        >
                                                            <ElOption label="http" value="http://" />
                                                            <ElOption label="https" value="https://" />
                                                        </ElSelect>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                (updateAppConfig as any)($event);
                                            }}
                                            class={'ml-2'}
                                        >
                                            {$t('commons.button.confirm')}
                                        </ElButton>
                                    </span>
                                )}
                            </ElDescriptionsItem>
                            {(unref(params) || []).map((param, key) => (
                                <ElDescriptionsItem label-class-name="system-label" label={getLabel(param)} key={key}>
                                    {param.type === 'password' && !param.showPassword ? (
                                        <span>{'********'}</span>
                                    ) : (
                                        <span class={'break-all whitespace-normal'}>
                                            {param.showValue && param.showValue != '' ? param.showValue : param.value}
                                        </span>
                                    )}
                                    {param.type === 'password' ? (
                                        <>
                                            {!param.showPassword ? (
                                                <ElButton
                                                    link
                                                    onClick={($event?: any) => {
                                                        param.showPassword = true;
                                                    }}
                                                    icon="View"
                                                    class={'-mt-1 ml-3'}
                                                />
                                            ) : null}
                                            {param.showPassword ? (
                                                <ElButton
                                                    link
                                                    onClick={($event?: any) => {
                                                        param.showPassword = false;
                                                    }}
                                                    icon="Hide"
                                                    class={'-mt-1 ml-3'}
                                                />
                                            ) : null}
                                        </>
                                    ) : null}
                                    {showCopyButton(param.key) ? (
                                        <CopyButton content={param.value} class={'-mt-1'} />
                                    ) : null}
                                </ElDescriptionsItem>
                            ))}
                        </ElDescriptions>
                    </div>
                ) : (
                    withDirectives(
                        <div>
                            <ElAlert
                                title={$t('app.updateHelper')}
                                type="warning"
                                closable={false}
                                class={'common-prompt'}
                            />
                            <ElForm
                                onValidate={($event?: any) => {
                                    (prop, valid) => expandInvalidFormSection(unref(paramForm), prop, valid);
                                }}
                                scroll-to-error
                                onSubmit={($event?: any) => {
                                    $event.preventDefault();
                                }}
                                ref={paramForm}
                                model={paramModel}
                                label-position="top"
                                rules={rules}
                            >
                                {h(
                                    unref(appKey) === 'ollama' ? 'details' : 'section',
                                    {
                                        open: unref(appKey) === 'ollama',
                                        class: { 'form-section': unref(appKey) === 'ollama' },
                                    },
                                    {
                                        default: () => (
                                            <>
                                                {unref(appKey) === 'ollama' ? (
                                                    <summary class={'form-section-header'}>
                                                        {$t('home.baseInfo')}
                                                    </summary>
                                                ) : null}
                                                <div class={{ 'form-section-body': unref(appKey) === 'ollama' }}>
                                                    {(unref(params) || []).map((p, index) => (
                                                        <div key={index}>
                                                            <ElFormItem prop={'params.' + p.key} label={getLabel(p)}>
                                                                {p.type == 'number' ? (
                                                                    <ElInput
                                                                        type="number"
                                                                        modelValue={paramModel.params[p.key]}
                                                                        onUpdate:modelValue={($v) => {
                                                                            paramModel.params[p.key] =
                                                                                $v === '' ? $v : Number($v);
                                                                        }}
                                                                        disabled={!p.edit}
                                                                    />
                                                                ) : p.type == 'password' ? (
                                                                    <ElInput
                                                                        type={p.showPassword ? 'text' : 'password'}
                                                                        modelValue={paramModel.params[p.key]}
                                                                        onUpdate:modelValue={($v) => {
                                                                            paramModel.params[p.key] = $v as any;
                                                                        }}
                                                                        disabled={!p.edit}
                                                                        v-slots={{
                                                                            append: () => (
                                                                                <>
                                                                                    <ElButton
                                                                                        icon={
                                                                                            p.showPassword
                                                                                                ? 'Hide'
                                                                                                : 'View'
                                                                                        }
                                                                                        onClick={($event?: any) => {
                                                                                            p.showPassword =
                                                                                                !p.showPassword;
                                                                                        }}
                                                                                    />
                                                                                </>
                                                                            ),
                                                                        }}
                                                                    />
                                                                ) : p.type == 'select' ? (
                                                                    <ElSelect
                                                                        modelValue={paramModel.params[p.key]}
                                                                        onUpdate:modelValue={($v) => {
                                                                            paramModel.params[p.key] = $v as any;
                                                                        }}
                                                                        multiple={p.multiple}
                                                                    >
                                                                        {(p.values || []).map((value) => (
                                                                            <ElOption
                                                                                value={value.value}
                                                                                label={value.label}
                                                                                disabled={!p.edit}
                                                                                key={value.label}
                                                                            />
                                                                        ))}
                                                                    </ElSelect>
                                                                ) : (
                                                                    <ElInput
                                                                        modelValue={paramModel.params[p.key]}
                                                                        onUpdate:modelValue={($v) => {
                                                                            paramModel.params[p.key] =
                                                                                typeof $v === 'string' ? $v.trim() : $v;
                                                                        }}
                                                                        disabled={!p.edit}
                                                                    />
                                                                )}
                                                            </ElFormItem>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ),
                                    },
                                )}
                                {unref(showModelGPU) ? (
                                    <GPUConfig
                                        ref={gpuRef}
                                        modelValue={paramModel.gpu}
                                        onUpdate:modelValue={($v) => {
                                            paramModel.gpu = $v as any;
                                        }}
                                    />
                                ) : null}
                                {unref(appKey) === 'ollama' ? (
                                    <details ref={syncSectionRef} open class={'form-section'}>
                                        <summary class={'form-section-header'}>
                                            <span>{$t('aiTools.model.syncModelAccount')}</span>
                                            <ElSwitch
                                                onClick={($event?: any) => {
                                                    $event.stopPropagation();
                                                }}
                                                onKeydown={($event?: any) => {
                                                    $event.stopPropagation();
                                                }}
                                                modelValue={paramModel.syncModelAccount}
                                                onUpdate:modelValue={($v) => {
                                                    paramModel.syncModelAccount = $v as any;
                                                }}
                                                aria-label={$t('aiTools.model.syncModelAccount')}
                                                onChange={($event?: any) => {
                                                    (enabled) =>
                                                        enabled &&
                                                        unref(syncSectionRef) &&
                                                        (unref(unref(syncSectionRef)).open = true);
                                                }}
                                            />
                                        </summary>
                                        <div
                                            class={'form-section-body'}
                                            style={[{}, { display: paramModel.syncModelAccount ? '' : 'none' }]}
                                        >
                                            <AccountAddress
                                                ref={accountRef}
                                                show-sync
                                                hide-sync-toggle
                                                form={paramModel}
                                                host-port={
                                                    Number(paramModel.params.PANEL_APP_PORT_HTTP) || paramModel.httpPort
                                                }
                                                container-port="11434"
                                                host-mode={paramModel.isHostMode}
                                            />
                                        </div>
                                    </details>
                                ) : null}
                                {h(
                                    unref(appKey) === 'ollama' ? 'details' : 'section',
                                    {
                                        open: unref(appKey) === 'ollama',
                                        class: { 'form-section': unref(appKey) === 'ollama' },
                                    },
                                    {
                                        default: () => (
                                            <>
                                                {unref(appKey) === 'ollama' ? (
                                                    <summary class={'form-section-header'}>
                                                        {$t('app.advanced')}
                                                    </summary>
                                                ) : null}
                                                {unref(appKey) !== 'ollama' ? (
                                                    <ElFormItem prop="advanced">
                                                        <ElCheckbox
                                                            modelValue={paramModel.advanced}
                                                            onUpdate:modelValue={($v) => {
                                                                paramModel.advanced = $v as any;
                                                            }}
                                                            label={$t('app.advanced')}
                                                            size="large"
                                                        />
                                                    </ElFormItem>
                                                ) : null}
                                                {unref(appKey) === 'ollama' || paramModel.advanced ? (
                                                    <div class={{ 'form-section-body': unref(appKey) === 'ollama' }}>
                                                        <ElFormItem
                                                            label={$t('app.containerName')}
                                                            prop="containerName"
                                                        >
                                                            <ElInput
                                                                modelValue={paramModel.containerName}
                                                                onUpdate:modelValue={($v) => {
                                                                    paramModel.containerName =
                                                                        typeof $v === 'string' ? $v.trim() : $v;
                                                                }}
                                                                placeholder={$t('app.containerNameHelper')}
                                                            />
                                                        </ElFormItem>
                                                        {!paramModel.isHostMode ? (
                                                            <ElFormItem prop="allowPort">
                                                                <ElCheckbox
                                                                    modelValue={paramModel.allowPort}
                                                                    onUpdate:modelValue={($v) => {
                                                                        paramModel.allowPort = $v as any;
                                                                    }}
                                                                    label={$t('app.allowPort')}
                                                                    size="large"
                                                                    onChange={($event?: any) => {
                                                                        (changeAllowPort as any)($event);
                                                                    }}
                                                                />
                                                                <span class={'input-help'}>
                                                                    {$t('app.allowPortHelper')}
                                                                </span>
                                                            </ElFormItem>
                                                        ) : null}
                                                        {paramModel.allowPort ? (
                                                            <ElFormItem label={$t('app.specifyIP')} prop="specifyIP">
                                                                <ElInput
                                                                    modelValue={paramModel.specifyIP}
                                                                    onUpdate:modelValue={($v) => {
                                                                        paramModel.specifyIP = $v as any;
                                                                    }}
                                                                />
                                                                <span class={'input-help'}>
                                                                    {$t('app.specifyIPHelper')}
                                                                </span>
                                                            </ElFormItem>
                                                        ) : null}
                                                        <ElFormItem
                                                            label={$t('container.restartPolicy')}
                                                            prop="restartPolicy"
                                                        >
                                                            <ElSelect
                                                                modelValue={paramModel.restartPolicy}
                                                                onUpdate:modelValue={($v) => {
                                                                    paramModel.restartPolicy = $v as any;
                                                                }}
                                                                class={'p-w-300'}
                                                            >
                                                                <ElOption label={$t('container.no')} value="no" />
                                                                <ElOption
                                                                    label={$t('container.always')}
                                                                    value="always"
                                                                />
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
                                                        <ElFormItem label={$t('container.cpuQuota')} prop="cpuQuota">
                                                            <ElInput
                                                                type="number"
                                                                modelValue={paramModel.cpuQuota}
                                                                onUpdate:modelValue={($v) => {
                                                                    paramModel.cpuQuota = $v === '' ? $v : Number($v);
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
                                                        >
                                                            <ElInput
                                                                modelValue={paramModel.memoryLimit}
                                                                onUpdate:modelValue={($v) => {
                                                                    paramModel.memoryLimit =
                                                                        $v === '' ? $v : Number($v);
                                                                }}
                                                                maxlength="10"
                                                                class={'!w-2/5'}
                                                                v-slots={{
                                                                    append: () => (
                                                                        <>
                                                                            <ElSelect
                                                                                modelValue={paramModel.memoryUnit}
                                                                                onUpdate:modelValue={($v) => {
                                                                                    paramModel.memoryUnit = $v as any;
                                                                                }}
                                                                                placeholder="Select"
                                                                                onChange={($event?: any) => {
                                                                                    (changeUnit as any)($event);
                                                                                }}
                                                                                class={'!w-[85px]'}
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
                                                                {paramModel.memoryUnit}
                                                                {'B '}
                                                            </span>
                                                        </ElFormItem>
                                                        <ElFormItem prop="editCompose">
                                                            <ElCheckbox
                                                                modelValue={paramModel.editCompose}
                                                                onUpdate:modelValue={($v) => {
                                                                    paramModel.editCompose = $v as any;
                                                                }}
                                                                label={$t('app.editCompose')}
                                                                size="large"
                                                            />
                                                            <span class={'input-help'}>
                                                                {$t('app.editComposeHelper')}
                                                            </span>
                                                        </ElFormItem>
                                                        {paramModel.editCompose ? (
                                                            <div>
                                                                <ElButton
                                                                    onClick={($event?: any) => {
                                                                        openDiff();
                                                                    }}
                                                                    type="primary"
                                                                    class={'!mb-2'}
                                                                >
                                                                    {$t('app.showDiff')}
                                                                </ElButton>
                                                                <CodemirrorPro
                                                                    modelValue={paramModel.dockerCompose}
                                                                    onUpdate:modelValue={($v) => {
                                                                        paramModel.dockerCompose = $v as any;
                                                                    }}
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
                        </div>,
                        [[vLoading, unref(loading)]],
                    )
                )}
                <Diff
                    ref={composeDiffRef}
                    onConfirm={($event?: any) => {
                        (getNewCompose as any)($event);
                    }}
                />
            </DrawerPro>
        );
    },
    options,
);
