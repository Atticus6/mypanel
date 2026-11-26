import { $t } from '@/utils/i18n-t';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import i18n from '@/lang';
import { MsgError, MsgSuccess, MsgWarning } from '@/utils/message';
import { FormInstance } from 'element-plus';
import { resolveAlertConfigExcludeTypes } from '@/api/modules/alert';
import { rpc } from '@/lib/rpc';
import { Rules, checkNumberRange } from '@/global/form-rules';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { Alert } from '@/types/alert';
import CustomWebhookForm from './custom-webhook-form';
import {
    CustomWebhookValidationIssue,
    beginCustomWebhookTest,
    completeCustomWebhookTest,
    createCustomWebhookTestState,
    createDefaultCustomWebhookDraft,
    hydrateCustomWebhookDraft,
    invalidateCustomWebhookTest,
    serializeCustomWebhookDraft,
    validateCustomWebhookDraft,
} from './custom-webhook';
import { buildLegacyEmailTestFields, rawSecretValue, serializeLegacySecretValue } from './secret-field';
interface DrawerProps {
    id?: number;
    revision?: string;
    type?: string;
    config?: Record<string, any>;
    status?: string;
    updateUser?: string;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElForm } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElSwitch } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'drawer',
    props: {},
    emits: emits,
    __scopeId: 'data-v-c02fae3e',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isProductPro, isIntl, isEE, isMobile } = useGlobalStore();
        const emailRules = {
            'config.displayName': [Rules.requiredInput, { validator: checkDisplayNameDuplicate, trigger: 'blur' }],
            'config.sender': [Rules.requiredInput],
            'config.host': [Rules.requiredInput],
            'config.port': [Rules.requiredInput],
            recipient: [Rules.requiredInput],
        };
        const smsRules = {
            smsDisplayName: [Rules.requiredInput, { validator: checkSmsDisplayNameDuplicate, trigger: 'blur' }],
            smsPhone: [Rules.phone],
            smsDailyAlertNum: [Rules.integerNumber, checkNumberRange(20, 100)],
        };
        const webhookRules = {
            webhookName: [Rules.requiredInput, { validator: checkDisplayNameDuplicate, trigger: 'blur' }],
            webhookUrl: [Rules.requiredInput],
        };
        const customWebhookRules = {
            'customWebhook.displayName': [{ validator: checkDisplayNameDuplicate, trigger: 'blur' }],
        };
        const currentRules = computed(() => {
            if (form.type === 'email') return emailRules;
            if (form.type === 'sms') return smsRules;
            if (form.type === 'custom') return customWebhookRules;
            return webhookRules;
        });
        const typeOptions = computed(() => {
            const options: { value: string; label: string }[] = [
                { value: 'email', label: i18n.global.t('xpack.alert.mail') },
            ];
            if (isProductPro.value && !isIntl.value) {
                options.push({ value: 'weCom', label: i18n.global.t('xpack.alert.weCom') });
                options.push({ value: 'dingTalk', label: i18n.global.t('xpack.alert.dingTalk') });
                options.push({ value: 'feiShu', label: i18n.global.t('xpack.alert.feiShu') });
            }
            options.push({ value: 'bark', label: i18n.global.t('xpack.alert.bark') });
            options.push({ value: 'custom', label: i18n.global.t('xpack.alert.custom') });
            if (isProductPro.value && !isEE.value && !isIntl.value) {
                options.push({ value: 'sms', label: i18n.global.t('xpack.alert.sms') });
            }
            return options;
        });
        const defaultEmailForm = {
            displayName: '',
            sender: '',
            userName: '',
            host: '',
            port: 465,
            encryption: 'NONE',
            status: 'Enable',
            recipient: '',
        };
        const drawerVisible = ref(false);
        const loading = ref(false);
        const customWebhookTestState = reactive(createCustomWebhookTestState());
        const testLoading = computed(() => customWebhookTestState.pending);
        const isEdit = ref(false);
        const isOK = ref(false);
        const emailRevision = ref(0);
        const formRef = ref<FormInstance>();
        const alertConfigs = ref<Alert.AlertConfigInfo[]>([]);
        const loadAlertConfigs = async () => {
            loading.value = true;
            try {
                const res = await rpc.alert.getAlertConfig({ excludeTypes: resolveAlertConfigExcludeTypes() });
                alertConfigs.value = res.items.filter((item: Alert.AlertConfigInfo) => item.type !== 'common') || [];
            } catch {
                alertConfigs.value = [];
            } finally {
                loading.value = false;
            }
        };
        const form = reactive({
            id: undefined as number | undefined,
            revision: undefined as string | undefined,
            type: 'email',
            title: '',
            status: 'Enable',
            updateUser: '',
            config: { ...defaultEmailForm } as Record<string, any>,
            emailPassword: '',
            recipient: '',
            webhookName: '',
            webhookUrl: '',
            smsDisplayName: '',
            smsPhone: '',
            smsDailyAlertNum: 50,
            customWebhook: createDefaultCustomWebhookDraft(),
        });
        const customWebhookValidationIssues = ref<CustomWebhookValidationIssue[]>([]);
        const customWebhookTestPassed = computed(() => customWebhookTestState.passed);
        const customWebhookSaveAllowed = computed(
            () =>
                !testLoading.value &&
                (customWebhookTestPassed.value ||
                    (form.status === 'Disable' && form.customWebhook.url.action === 'clear')),
        );
        const drawerHeader = computed(() => {
            if (isEdit.value) {
                return i18n.global.t('xpack.alert.' + form.type);
            }
            return i18n.global.t('commons.button.create');
        });
        const normalizeDisplayName = (value?: string) => value?.trim() || '';
        function checkDisplayNameDuplicate(_rule: unknown, value: string, callback: (error?: Error) => void) {
            const currentValue = normalizeDisplayName(value);
            if (!currentValue) {
                callback();
                return;
            }

            const duplicated = alertConfigs.value.some((item) => {
                if (item.type !== form.type) {
                    return false;
                }
                if (form.id && item.id === form.id) {
                    return false;
                }
                try {
                    const config = JSON.parse(item.config || '{}') as { displayName?: string };
                    return normalizeDisplayName(config.displayName) === currentValue;
                } catch {
                    return false;
                }
            });

            if (duplicated) {
                callback(new Error(i18n.global.t('commons.rule.duplicate')));
                return;
            }

            callback();
        }
        function checkSmsDisplayNameDuplicate(_rule: unknown, value: string, callback: (error?: Error) => void) {
            const currentValue = normalizeDisplayName(value);
            if (!currentValue) {
                callback();
                return;
            }

            const duplicated = alertConfigs.value.some((item) => {
                if (item.type !== 'sms') {
                    return false;
                }
                if (form.id && item.id === form.id) {
                    return false;
                }
                try {
                    const config = JSON.parse(item.config || '{}') as { displayName?: string };
                    return normalizeDisplayName(config.displayName) === currentValue;
                } catch {
                    return false;
                }
            });

            if (duplicated) {
                callback(new Error(i18n.global.t('commons.rule.duplicate')));
                return;
            }

            callback();
        }
        const titleMap: Record<string, string> = {
            email: 'xpack.alert.emailConfig',
            weCom: 'xpack.alert.weCom',
            dingTalk: 'xpack.alert.dingTalk',
            feiShu: 'xpack.alert.feiShu',
            bark: 'xpack.alert.bark',
            sms: 'xpack.alert.smsConfig',
            custom: 'xpack.alert.custom',
        };
        const acceptParams = (params: DrawerProps): void => {
            form.emailPassword = '';
            form.smsPhone = '';
            form.webhookUrl = '';
            form.customWebhook = createDefaultCustomWebhookDraft();
            if (params.id && params.id > 0) {
                isEdit.value = true;
                form.id = params.id;
                form.revision = params.revision;
                form.type = params.type || 'email';
                form.title = titleMap[form.type] || '';
                form.status = params.status || 'Enable';
                form.updateUser = params.updateUser || '';

                if (form.type === 'email') {
                    form.config = { ...defaultEmailForm, ...(params.config || {}) };
                    delete form.config.password;
                    form.emailPassword = rawSecretValue(params.config?.password);
                    form.recipient = params.config?.recipient || '';
                } else if (form.type === 'sms') {
                    form.smsDisplayName = params.config?.displayName || '';
                    form.smsPhone = rawSecretValue(params.config?.phone);
                    form.smsDailyAlertNum = params.config?.alertDailyNum || 50;
                } else if (form.type === 'custom') {
                    form.customWebhook = hydrateCustomWebhookDraft(params.config || {});
                } else {
                    form.webhookName = params.config?.displayName || '';
                    form.webhookUrl = rawSecretValue(params.config?.url);
                }
            } else {
                isEdit.value = false;
                form.id = undefined;
                form.revision = undefined;
                form.type = params.type || 'email';
                form.title = titleMap[form.type] || '';
                form.status = 'Enable';
                form.updateUser = '';
                form.config = { ...defaultEmailForm };
                form.emailPassword = '';
                form.recipient = '';
                form.smsDisplayName = '';
                form.webhookName = '';
                form.webhookUrl = '';
                form.smsPhone = '';
                form.smsDailyAlertNum = 50;
                form.customWebhook = createDefaultCustomWebhookDraft();
            }

            isOK.value = false;
            customWebhookValidationIssues.value = [];
            invalidateCustomWebhookTest(customWebhookTestState);
            drawerVisible.value = true;
            void loadAlertConfigs();
        };
        const onTypeChange = (type: string) => {
            form.emailPassword = '';
            form.smsPhone = '';
            form.webhookUrl = '';
            form.customWebhook = createDefaultCustomWebhookDraft();
            form.title = titleMap[type] || '';
            if (type === 'email') {
                form.config = { ...defaultEmailForm };
                form.emailPassword = '';
                form.recipient = '';
            } else if (type === 'sms') {
                form.smsDisplayName = '';
                form.smsPhone = '';
                form.smsDailyAlertNum = 50;
            } else if (type === 'custom') {
                form.config = {};
                form.customWebhook = createDefaultCustomWebhookDraft();
            } else {
                form.config = {};
                form.webhookName = '';
                form.webhookUrl = '';
            }
            isOK.value = false;
            customWebhookValidationIssues.value = [];
            invalidateCustomWebhookTest(customWebhookTestState);
            formRef.value?.clearValidate();
        };
        const buildEmailConfig = () => ({
            ...form.config,
            password: serializeLegacySecretValue(form.emailPassword),
            recipient: form.recipient,
        });
        const revisionPayload = () => (form.id && form.revision ? { revision: form.revision } : {});
        const buildSavePayload = () => {
            if (form.type === 'email') {
                const configInfo = buildEmailConfig();
                return {
                    id: form.id || 0,
                    ...revisionPayload(),
                    type: 'email',
                    title: titleMap['email'],
                    status: form.status,
                    config: JSON.stringify(configInfo),
                    displayName: form.config.displayName,
                };
            }
            if (form.type === 'sms') {
                const configInfo = {
                    displayName: form.smsDisplayName,
                    phone: serializeLegacySecretValue(form.smsPhone, true),
                    alertDailyNum: form.smsDailyAlertNum,
                };
                return {
                    id: form.id || 0,
                    ...revisionPayload(),
                    type: 'sms',
                    title: titleMap['sms'],
                    status: form.status,
                    config: JSON.stringify(configInfo),
                    displayName: configInfo.displayName,
                };
            }
            if (form.type === 'custom') {
                const configInfo = serializeCustomWebhookDraft(form.customWebhook);
                return {
                    id: form.id || 0,
                    ...revisionPayload(),
                    type: 'custom',
                    title: titleMap['custom'],
                    status: form.status,
                    config: JSON.stringify(configInfo),
                    displayName: configInfo.displayName,
                };
            }
            const configInfo = {
                displayName: form.webhookName,
                url: serializeLegacySecretValue(form.webhookUrl, true),
            };
            return {
                id: form.id || 0,
                ...revisionPayload(),
                type: form.type,
                title: form.title,
                status: form.status,
                config: JSON.stringify(configInfo),
                displayName: configInfo.displayName,
            };
        };
        const validateCustomWebhook = async (formEl: FormInstance, allowClearedUrl = false): Promise<boolean> => {
            customWebhookValidationIssues.value = validateCustomWebhookDraft(form.customWebhook, { allowClearedUrl });
            if (customWebhookValidationIssues.value.length > 0) {
                const issue = customWebhookValidationIssues.value[0];
                MsgError(i18n.global.t(`xpack.alert.customWebhookValidation.${issue.code}`));
                return false;
            }
            try {
                await formEl.validate();
                return true;
            } catch {
                return false;
            }
        };
        const saveAlertConfig = async () => {
            loading.value = true;
            try {
                await rpc.alert.updateAlertConfig(buildSavePayload());
                void loadAlertConfigs();
                handleClose();
                ctx.emit('search');
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } finally {
                loading.value = false;
            }
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            if (isEdit.value && !form.revision) {
                MsgError(i18n.global.t('xpack.alert.alertConfigChanged'));
                return;
            }
            if (form.type === 'custom') {
                if (!customWebhookSaveAllowed.value) return;
                const testedAttempt = customWebhookTestState.attempt;
                if (await validateCustomWebhook(formEl, form.status === 'Disable')) {
                    if (testedAttempt !== customWebhookTestState.attempt || !customWebhookSaveAllowed.value) return;
                    try {
                        await saveAlertConfig();
                    } catch {
                        return;
                    }
                }
                return;
            }
            await formEl.validate(async (valid) => {
                if (!valid) return;
                try {
                    await saveAlertConfig();
                } catch {
                    return;
                }
            });
        };
        const onTest = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            if (form.type === 'custom') {
                const attempt = beginCustomWebhookTest(customWebhookTestState);
                try {
                    if (!(await validateCustomWebhook(formEl)) || attempt !== customWebhookTestState.attempt) return;
                    const config = JSON.stringify(serializeCustomWebhookDraft(form.customWebhook));
                    const res = await rpc.alert.testAlertConfig({
                        ...(form.id ? { id: form.id } : {}),
                        type: 'custom',
                        config,
                    });
                    const success = res.success === true;
                    if (!completeCustomWebhookTest(customWebhookTestState, attempt, success)) return;
                    if (success) {
                        MsgSuccess(i18n.global.t('xpack.alert.alertTestOk'));
                        return;
                    }
                    MsgError(res.message || i18n.global.t('xpack.alert.alertTestFailed'));
                } catch {
                    return;
                } finally {
                    completeCustomWebhookTest(customWebhookTestState, attempt, false);
                }
                return;
            }
            if (form.type !== 'email') return;
            await formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                isOK.value = false;
                const testedEmailRevision = emailRevision.value;
                try {
                    const emailConfig = buildEmailConfig();
                    const legacyEmailFields = buildLegacyEmailTestFields(emailConfig);
                    const testConfig: Alert.AlertConfigTest = {
                        ...legacyEmailFields,
                        ...(form.id ? { id: form.id } : {}),
                        type: 'email',
                        config: JSON.stringify(emailConfig),
                    };
                    const res = await rpc.alert.testAlertConfig(testConfig);
                    loading.value = false;
                    if (res.success) {
                        if (testedEmailRevision !== emailRevision.value) {
                            MsgWarning(i18n.global.t('xpack.alert.testResultStale'));
                            return;
                        }
                        isOK.value = true;
                        MsgSuccess(i18n.global.t('xpack.alert.alertTestOk'));
                    } else {
                        MsgError(i18n.global.t('xpack.alert.alertTestFailed'));
                    }
                } catch {
                    loading.value = false;
                    return;
                }
            });
        };
        watch(
            () => form.config,
            () => {
                if (form.type === 'email') {
                    isOK.value = false;
                    emailRevision.value += 1;
                }
            },
            { deep: true, flush: 'sync' },
        );
        watch(
            () => form.emailPassword,
            () => {
                if (form.type !== 'email') return;
                isOK.value = false;
                emailRevision.value += 1;
            },
            { deep: true, flush: 'sync' },
        );
        watch(
            () => form.customWebhook,
            () => {
                if (form.type !== 'custom') return;
                customWebhookValidationIssues.value = [];
                invalidateCustomWebhookTest(customWebhookTestState);
            },
            { deep: true, flush: 'sync' },
        );
        watch(
            () => form.recipient,
            () => {
                if (form.type === 'email') {
                    isOK.value = false;
                    emailRevision.value += 1;
                }
            },
            { flush: 'sync' },
        );
        watch(
            () => [form.smsDisplayName, form.smsPhone, form.smsDailyAlertNum],
            () => {
                if (form.type === 'sms') {
                    formRef.value?.clearValidate(['smsDisplayName', 'smsPhone']);
                }
            },
            { deep: true, flush: 'sync' },
        );
        const handleClose = () => {
            isOK.value = false;
            invalidateCustomWebhookTest(customWebhookTestState);
            drawerVisible.value = false;
        };
        onMounted(() => {
            void loadAlertConfigs();
        });
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={unref(drawerHeader)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size={unref(isMobile) ? 'full' : '736px'}
                v-slots={{
                    footer: () => (
                        <>
                            {form.type === 'email' ? (
                                <div class={'flex items-center justify-between'}>
                                    {withDirectives(
                                        <ElButton
                                            disabled={unref(loading)}
                                            onClick={($event?: any) => {
                                                onTest(unref(formRef));
                                            }}
                                            plain
                                            type="primary"
                                        >
                                            {$t('xpack.alert.test')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                    <div>
                                        <ElButton
                                            onClick={($event?: any) => {
                                                drawerVisible.value = false;
                                            }}
                                        >
                                            {$t('commons.button.cancel')}
                                        </ElButton>
                                        {withDirectives(
                                            <ElButton
                                                disabled={unref(loading) || (form.type === 'email' && !unref(isOK))}
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    onSave(unref(formRef));
                                                }}
                                            >
                                                {$t('commons.button.confirm')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                    </div>
                                </div>
                            ) : form.type === 'custom' ? (
                                <div class={'custom-webhook-footer'}>
                                    {withDirectives(
                                        <ElButton
                                            plain
                                            type="primary"
                                            loading={unref(testLoading)}
                                            onClick={($event?: any) => {
                                                onTest(unref(formRef));
                                            }}
                                        >
                                            {$t('xpack.alert.test')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                    <div class={'custom-webhook-footer__actions'}>
                                        <ElButton
                                            onClick={($event?: any) => {
                                                drawerVisible.value = false;
                                            }}
                                        >
                                            {$t('commons.button.cancel')}
                                        </ElButton>
                                        {withDirectives(
                                            <ElButton
                                                disabled={
                                                    unref(loading) ||
                                                    unref(testLoading) ||
                                                    !unref(customWebhookSaveAllowed)
                                                }
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    onSave(unref(formRef));
                                                }}
                                            >
                                                {$t('commons.button.confirm')}
                                            </ElButton>,
                                            [[permissionDirective, true]],
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div class={'flex justify-end gap-2'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            drawerVisible.value = false;
                                        }}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    {withDirectives(
                                        <ElButton
                                            disabled={unref(loading)}
                                            type="primary"
                                            onClick={($event?: any) => {
                                                onSave(unref(formRef));
                                            }}
                                        >
                                            {$t('commons.button.confirm')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                </div>
                            )}
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        ref={formRef}
                        rules={unref(currentRules)}
                        label-position="top"
                        model={form}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElRow type="flex" justify="center">
                            <ElCol span={unref(isMobile) ? 24 : 22}>
                                {!unref(isEdit) ? (
                                    <ElFormItem label={$t('commons.table.type')} prop="type">
                                        <ElSelect
                                            modelValue={form.type}
                                            onUpdate:modelValue={($v) => {
                                                form.type = $v as any;
                                            }}
                                            onChange={($event?: any) => {
                                                (onTypeChange as any)($event);
                                            }}
                                            class={'w-full'}
                                        >
                                            {(unref(typeOptions) || []).map((item) => (
                                                <ElOption label={item.label} value={item.value} key={item.value} />
                                            ))}
                                        </ElSelect>
                                    </ElFormItem>
                                ) : null}
                                {form.type === 'email' ? (
                                    <>
                                        <ElFormItem label={$t('xpack.alert.displayName')} prop="config.displayName">
                                            <ElInput
                                                modelValue={form.config.displayName}
                                                onUpdate:modelValue={($v) => {
                                                    form.config.displayName = $v as any;
                                                }}
                                            />
                                            <span class={'input-help'}>{$t('xpack.alert.displayNameHelper')}</span>
                                        </ElFormItem>
                                        <ElFormItem label={$t('xpack.alert.sender')} prop="config.sender">
                                            <ElInput
                                                modelValue={form.config.sender}
                                                onUpdate:modelValue={($v) => {
                                                    form.config.sender = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                            />
                                            <span class={'input-help'}>{$t('xpack.alert.senderHelper')}</span>
                                        </ElFormItem>
                                        <ElFormItem label={$t('commons.login.username')} prop="config.userName">
                                            <ElInput
                                                modelValue={form.config.userName}
                                                onUpdate:modelValue={($v) => {
                                                    form.config.userName = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                            />
                                            <span class={'input-help'}>{$t('xpack.alert.userNameHelper')}</span>
                                        </ElFormItem>
                                        <ElFormItem label={$t('xpack.alert.password')} prop="emailPassword">
                                            <ElInput
                                                modelValue={form.emailPassword}
                                                onUpdate:modelValue={($v) => {
                                                    form.emailPassword = $v as any;
                                                }}
                                                type="password"
                                                show-password
                                            />
                                            <span class={'input-help'}>{$t('xpack.alert.passwordHelper')}</span>
                                        </ElFormItem>
                                        <ElFormItem label={$t('xpack.alert.host')} prop="config.host">
                                            <ElInput
                                                modelValue={form.config.host}
                                                onUpdate:modelValue={($v) => {
                                                    form.config.host = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                placeholder="smtp.qq.com"
                                            />
                                            <span class={'input-help'}>{$t('xpack.alert.hostHelper')}</span>
                                        </ElFormItem>
                                        <ElFormItem label={$t('xpack.alert.port')} prop="config.port">
                                            <ElInput
                                                modelValue={form.config.port}
                                                onUpdate:modelValue={($v) => {
                                                    form.config.port = $v === '' ? $v : Number($v);
                                                }}
                                                min={1}
                                                max={65535}
                                            />
                                        </ElFormItem>
                                        <ElFormItem label={$t('xpack.alert.encryption')} prop="config.encryption">
                                            <div class={'flex items-center gap-2'}>
                                                <span class={'el-form-item__label'}>{'SSL'}</span>
                                                {withDirectives(
                                                    <ElSwitch
                                                        modelValue={form.config.encryption}
                                                        onUpdate:modelValue={($v) => {
                                                            form.config.encryption = $v as any;
                                                        }}
                                                        active-value={'SSL'}
                                                        inactive-value={
                                                            form.config.encryption === 'SSL'
                                                                ? 'NONE'
                                                                : form.config.encryption
                                                        }
                                                    />,
                                                    [[permissionDirective, true]],
                                                )}
                                            </div>
                                            <span class={'input-help'}>{$t('xpack.alert.sslHelper')}</span>
                                            <div class={'flex items-center gap-2'}>
                                                <span class={'el-form-item__label'}>{'TLS'}</span>
                                                {withDirectives(
                                                    <ElSwitch
                                                        modelValue={form.config.encryption}
                                                        onUpdate:modelValue={($v) => {
                                                            form.config.encryption = $v as any;
                                                        }}
                                                        active-value={'TLS'}
                                                        inactive-value={
                                                            form.config.encryption === 'TLS'
                                                                ? 'NONE'
                                                                : form.config.encryption
                                                        }
                                                    />,
                                                    [[permissionDirective, true]],
                                                )}
                                            </div>
                                            <span class={'input-help'}>{$t('xpack.alert.tlsHelper')}</span>
                                        </ElFormItem>
                                        <ElFormItem label={$t('xpack.alert.recipient')} prop="recipient">
                                            <ElInput
                                                modelValue={form.recipient}
                                                onUpdate:modelValue={($v) => {
                                                    form.recipient = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                placeholder={$t('xpack.alert.recipientPlaceholder')}
                                            />
                                        </ElFormItem>
                                    </>
                                ) : form.type === 'sms' ? (
                                    <>
                                        <ElFormItem label={$t('xpack.alert.displayName')} prop="smsDisplayName">
                                            <ElInput
                                                modelValue={form.smsDisplayName}
                                                onUpdate:modelValue={($v) => {
                                                    form.smsDisplayName = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                            />
                                        </ElFormItem>
                                        <ElFormItem label={$t('xpack.alert.phone')} prop="smsPhone">
                                            <ElInput
                                                clearable
                                                modelValue={form.smsPhone}
                                                onUpdate:modelValue={($v) => {
                                                    form.smsPhone = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                            />
                                            <span class={'input-help'}>{$t('xpack.alert.phoneHelper')}</span>
                                        </ElFormItem>
                                        <ElFormItem label={$t('xpack.alert.dailyAlertNum')} prop="smsDailyAlertNum">
                                            <ElInput
                                                clearable
                                                modelValue={form.smsDailyAlertNum}
                                                onUpdate:modelValue={($v) => {
                                                    form.smsDailyAlertNum = $v === '' ? $v : Number($v);
                                                }}
                                                min="20"
                                                max="100"
                                            />
                                            <span class={'input-help'}>{$t('xpack.alert.dailyAlertNumHelper')}</span>
                                        </ElFormItem>
                                    </>
                                ) : form.type === 'custom' ? (
                                    <CustomWebhookForm
                                        modelValue={form.customWebhook}
                                        onUpdate:modelValue={($v) => {
                                            form.customWebhook = $v as any;
                                        }}
                                        validation-issues={unref(customWebhookValidationIssues)}
                                        allow-clear-url={form.status === 'Disable'}
                                    />
                                ) : (
                                    <>
                                        <ElFormItem label={$t('xpack.alert.webhookName')} prop="webhookName">
                                            <ElInput
                                                modelValue={form.webhookName}
                                                onUpdate:modelValue={($v) => {
                                                    form.webhookName = $v as any;
                                                }}
                                            />
                                        </ElFormItem>
                                        <ElFormItem label={$t('xpack.alert.webhookUrl')} prop="webhookUrl">
                                            <ElInput
                                                modelValue={form.webhookUrl}
                                                onUpdate:modelValue={($v) => {
                                                    form.webhookUrl = typeof $v === 'string' ? $v.trim() : $v;
                                                }}
                                                rows={2}
                                                type="password"
                                                show-password
                                            />
                                        </ElFormItem>
                                    </>
                                )}
                                {unref(isEdit) && unref(isEE) ? (
                                    <ElFormItem label={$t('commons.table.updater')}>
                                        <ElInput model-value={form.updateUser || '-'} readonly />
                                    </ElFormItem>
                                ) : null}
                            </ElCol>
                        </ElRow>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
