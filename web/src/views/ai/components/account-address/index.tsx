import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import './index.styles.css';

interface CodemodProps {
    [key: string]: any;
    form?: {
        name: string;
        syncModelAccount?: boolean;
        containerName: string;
        modelAccountBaseURLType: string;
        modelAccountBaseURL: string;
    };
    hostPort?: number;
    containerPort?: string;
    hostMode?: boolean;
    showSync?: boolean;
    hideSyncToggle?: boolean;
}

const emits = {};

const options = {
    name: 'account-address',
    props: {
        form: Object,
        hostPort: Number,
        containerPort: String,
        hostMode: Boolean,
        showSync: Boolean,
        hideSyncToggle: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-f1120c43',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const systemIP = ref('');
        const addressTypes = computed(() => [
            { label: i18n.global.t('aiTools.model.containerAddress'), value: 'container' },
            { label: '127.0.0.1', value: 'localhost' },
            { label: i18n.global.t('setting.systemIP'), value: 'systemIP' },
            { label: i18n.global.t('aiTools.model.customAddress'), value: 'custom' },
        ]);
        const customURLRules = [
            Rules.requiredInput,
            {
                pattern: /^https?:\/\/.+/i,
                message: i18n.global.t('aiTools.agents.allowedOriginsInvalid'),
                trigger: 'blur',
            },
        ];
        const baseURL = computed(() => {
            if (__panelSetupProps.form.modelAccountBaseURLType === 'custom')
                return __panelSetupProps.form.modelAccountBaseURL;
            if (__panelSetupProps.form.modelAccountBaseURLType === 'localhost')
                return `http://127.0.0.1:${__panelSetupProps.hostPort}/v1`;
            if (__panelSetupProps.form.modelAccountBaseURLType === 'systemIP')
                return `http://${systemIP.value || '127.0.0.1'}:${__panelSetupProps.hostPort}/v1`;
            return `http://${__panelSetupProps.form.containerName || __panelSetupProps.form.name}:${__panelSetupProps.containerPort}/v1`;
        });
        onMounted(async () => {
            try {
                const data = await rpc.agentSetting.getInfo({});
                systemIP.value = data.systemIp || '';
            } catch {
                systemIP.value = '';
            }
        });
        ctx.expose({ baseURL });
        return () => (
            <>
                {__panelSetupProps.showSync && !__panelSetupProps.hideSyncToggle ? (
                    <ElFormItem>
                        <ElCheckbox
                            modelValue={__panelSetupProps.form.syncModelAccount}
                            onUpdate:modelValue={($v) => {
                                __panelSetupProps.form.syncModelAccount = $v as any;
                            }}
                        >
                            {$t('aiTools.model.syncModelAccount')}
                        </ElCheckbox>
                    </ElFormItem>
                ) : null}
                {!__panelSetupProps.showSync || __panelSetupProps.form.syncModelAccount ? (
                    <>
                        <span class={'input-help model-account-helper'}>
                            {$t('aiTools.model.modelAccountAddressHelper')}
                        </span>
                        <ElFormItem
                            label={$t('aiTools.agents.allowedOrigins')}
                            prop="modelAccountBaseURLType"
                            rules={Rules.requiredSelect}
                        >
                            <ElRadioGroup
                                modelValue={__panelSetupProps.form.modelAccountBaseURLType}
                                onUpdate:modelValue={($v) => {
                                    __panelSetupProps.form.modelAccountBaseURLType = $v as any;
                                }}
                            >
                                {(unref(addressTypes) || []).map((item) => (
                                    <ElRadioButton
                                        value={item.value}
                                        disabled={__panelSetupProps.hostMode && item.value === 'container'}
                                        key={item.value}
                                    >
                                        {item.label}
                                    </ElRadioButton>
                                ))}
                            </ElRadioGroup>
                        </ElFormItem>
                        {__panelSetupProps.form.modelAccountBaseURLType === 'custom' ? (
                            <ElFormItem label="Base URL" prop="modelAccountBaseURL" rules={customURLRules}>
                                <ElInput
                                    modelValue={__panelSetupProps.form.modelAccountBaseURL}
                                    onUpdate:modelValue={($v) => {
                                        __panelSetupProps.form.modelAccountBaseURL =
                                            typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                    placeholder="http://192.168.1.100:8000/v1"
                                />
                            </ElFormItem>
                        ) : (
                            <ElFormItem label="Base URL">
                                <ElInput model-value={unref(baseURL)} readonly />
                            </ElFormItem>
                        )}
                    </>
                ) : null}
            </>
        );
    },
    options,
);
