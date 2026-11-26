import { $t } from '@/utils/i18n-t';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { pageAgentAccounts } from '@/api/modules/ai';
import { rpc } from '@/lib/rpc';
import { MsgSuccess } from '@/utils/message';
import {
    AI_PREFIX_OPTIONS,
    DEFAULT_AI_PREFIX,
    formatRiskCommandsText,
    normalizeRiskCommands,
    parseRiskCommands,
} from '@/pages/views/terminal/setting/ai/helper';
interface AgentAccountOption {
    id: number | string;
    name: string;
    provider?: string;
    providerName?: string;
    verified?: boolean;
    validateAvailability?: boolean;
}
type FormInstance = InstanceType<typeof ElForm>;
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ai',
    props: {},
    emits: emits,
    __scopeId: 'data-v-8ea9a857',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const formRef = ref<FormInstance>();
        const drawerVisible = ref(false);
        const loading = ref(false);
        const agentAccountOptions = ref<AgentAccountOption[]>([]);
        const defaultRiskCommands = ref<string[]>([]);
        const prefixOptions = AI_PREFIX_OPTIONS;
        const formModel = reactive({
            status: 'Disable',
            accountId: '',
            prefix: DEFAULT_AI_PREFIX,
            riskCommands: '',
        });
        const loadTerminalAISettings = async () => {
            const res = await rpc.agentSetting.getTerminalAI({});
            formModel.status = res.aiStatus || 'Disable';
            formModel.accountId = res.aiAccountId || '';
            formModel.prefix = res.aiPrefix || DEFAULT_AI_PREFIX;
            formModel.riskCommands = formatRiskCommandsText(parseRiskCommands(res.aiRiskCommands || ''));
            defaultRiskCommands.value = parseRiskCommands(res.aiRiskCommandsDefault || '');
        };
        const openDrawer = () => {
            drawerVisible.value = true;
            loading.value = true;
            Promise.all([loadTerminalAISettings(), loadAgentAccounts()]).finally(() => {
                loading.value = false;
            });
        };
        const verificationLabel = (item: AgentAccountOption) => {
            if (item.validateAvailability === false) return i18n.global.t('aiTools.agents.verifySkipped');
            return item.verified ? 'OK' : 'N/A';
        };
        const verificationTagType = (item: AgentAccountOption) => {
            if (item.validateAvailability === false) return 'info';
            return item.verified ? 'success' : 'warning';
        };
        const loadAgentAccounts = async () => {
            await pageAgentAccounts({
                page: 1,
                pageSize: 1000,
                provider: '',
                textOnly: true,
                name: '',
            }).then((res) => {
                agentAccountOptions.value = res.data?.items || [];
            });
        };
        const accountRules = [
            {
                ...Rules.requiredSelect,
                validator: (_rule, value, callback) => {
                    if (formModel.status !== 'Enable') {
                        callback();
                        return;
                    }
                    if (!value) {
                        callback(new Error(i18n.global.t('commons.rule.requiredSelect')));
                        return;
                    }
                    callback();
                },
            },
        ];
        const resetRiskCommands = () => {
            formModel.prefix = DEFAULT_AI_PREFIX;
            formModel.riskCommands = formatRiskCommandsText(defaultRiskCommands.value);
        };
        const handleConfirm = async () => {
            await nextTick();
            if (!formRef.value) {
                return;
            }
            try {
                await formRef.value.validate();
            } catch {
                return;
            }
            loading.value = true;
            try {
                await rpc.agentSetting.updateTerminalAI({
                    aiStatus: formModel.status,
                    aiAccountId: formModel.status === 'Enable' ? formModel.accountId : '',
                    aiPrefix: formModel.prefix.trim() || DEFAULT_AI_PREFIX,
                    aiRiskCommands: JSON.stringify(normalizeRiskCommands(parseRiskCommands(formModel.riskCommands))),
                });
                await loadTerminalAISettings();
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                drawerVisible.value = false;
            } finally {
                loading.value = false;
            }
        };
        const handleClose = () => {
            formRef.value?.clearValidate();
        };
        return () => (
            <>
                <ElButton
                    onClick={($event?: any) => {
                        (openDrawer as any)($event);
                    }}
                    type="primary"
                >
                    {$t('terminal.aiAssistant')}
                </ElButton>
                <DrawerPro
                    modelValue={unref(drawerVisible)}
                    onUpdate:modelValue={($v) => {
                        drawerVisible.value = $v as any;
                    }}
                    header={$t('terminal.aiAssistant')}
                    size="60%"
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    plain
                                    onClick={($event?: any) => {
                                        (resetRiskCommands as any)($event);
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.setDefault')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (handleConfirm as any)($event);
                                    }}
                                    loading={unref(loading)}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <div>
                            <ElForm ref={formRef} model={formModel} label-position="top">
                                <ElFormItem label={$t('terminal.aiAssistant')}>
                                    <ElSwitch
                                        modelValue={formModel.status}
                                        onUpdate:modelValue={($v) => {
                                            formModel.status = $v as any;
                                        }}
                                        active-value="Enable"
                                        inactive-value="Disable"
                                    />
                                </ElFormItem>
                                {formModel.status === 'Enable' ? (
                                    <ElFormItem
                                        label={$t('aiTools.agents.account')}
                                        prop="accountId"
                                        rules={accountRules}
                                    >
                                        <ElSelect
                                            modelValue={formModel.accountId}
                                            onUpdate:modelValue={($v) => {
                                                formModel.accountId = $v as any;
                                            }}
                                            clearable
                                            filterable
                                            class={'formInput'}
                                        >
                                            {(unref(agentAccountOptions) || []).map((item) => (
                                                <ElOption label={item.name} value={String(item.id)} key={item.id}>
                                                    <div class={'account-option'}>
                                                        <span class={'account-option__name'}>{item.name}</span>
                                                        <div class={'account-option__tags'}>
                                                            <ElTag size="small" effect="plain">
                                                                {item.providerName || item.provider}
                                                            </ElTag>
                                                            <ElTag
                                                                size="small"
                                                                effect="plain"
                                                                type={verificationTagType(item)}
                                                            >
                                                                {verificationLabel(item)}
                                                            </ElTag>
                                                        </div>
                                                    </div>
                                                </ElOption>
                                            ))}
                                        </ElSelect>
                                        <span class={'input-help'}>{$t('terminal.aiAccountHelper')}</span>
                                    </ElFormItem>
                                ) : null}
                                <ElFormItem label={$t('terminal.aiPrefix')} prop="prefix" rules={Rules.requiredSelect}>
                                    <ElSelect
                                        modelValue={formModel.prefix}
                                        onUpdate:modelValue={($v) => {
                                            formModel.prefix = $v as any;
                                        }}
                                        class={'formInput'}
                                    >
                                        {(prefixOptions || []).map((item) => (
                                            <ElOption label={item} value={item} key={item} />
                                        ))}
                                    </ElSelect>
                                    <span class={'input-help'}>
                                        {$t('terminal.aiPrefixHelper', [formModel.prefix || DEFAULT_AI_PREFIX])}
                                    </span>
                                </ElFormItem>
                                <ElFormItem label={$t('terminal.aiRiskCommands')}>
                                    <CodemirrorPro
                                        modelValue={formModel.riskCommands}
                                        onUpdate:modelValue={($v) => {
                                            formModel.riskCommands = $v as any;
                                        }}
                                        mode="shell"
                                        line-wrapping
                                        height-diff={560}
                                        min-height={180}
                                    />
                                    <span class={'input-help'}>{$t('terminal.aiRiskCommandsHelper')}</span>
                                </ElFormItem>
                            </ElForm>
                        </div>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
            </>
        );
    },
    options,
);
