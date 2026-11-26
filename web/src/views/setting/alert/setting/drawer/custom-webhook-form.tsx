import { $t } from '@/utils/i18n-t';
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { ElInput, ElMessageBox } from 'element-plus';
import i18n from '@/lang';
import { MsgError } from '@/utils/message';
import {
    CUSTOM_WEBHOOK_VARIABLES,
    CUSTOM_WEBHOOK_LIMITS,
    CustomWebhookBody,
    CustomWebhookBodyType,
    CustomWebhookDraft,
    CustomWebhookPreset,
    CustomWebhookSecretAction,
    CustomWebhookValidationIssue,
    applyCustomWebhookPreset,
    contentTypeForBodyType,
    createCustomWebhookFormField,
    createCustomWebhookHeader,
    formatCustomWebhookJsonTemplate,
    insertCustomWebhookVariable,
    isCustomWebhookSecretHeader,
    isCustomWebhookPresetPristine,
    updateCustomWebhookBodyTemplate,
} from './custom-webhook';
import {
    clearSecretDraft,
    keepSecretDraft,
    replaceSecretDraft,
    secretEditorPlaceholder,
    secretEditorValue,
} from './secret-field';
import './custom-webhook-form.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElAlert } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElRadioGroup } from 'element-plus';
import { ElRadioButton } from 'element-plus';
import { ElCollapse } from 'element-plus';
import { ElCollapseItem } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElTag } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    modelValue?: CustomWebhookDraft;
    validationIssues?: CustomWebhookValidationIssue[];
    allowClearUrl?: boolean;
}

const emits = {
    'update:modelValue': (arg0?: CustomWebhookDraft) => true,
};

const options = {
    name: 'custom-webhook-form',
    props: {
        modelValue: { type: null },
        validationIssues: Array,
        allowClearUrl: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-d8b3eb02',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const activeSections = ref<string[]>([]);
        const derivedContentType = computed(() => contentTypeForBodyType(__panelSetupProps.modelValue.body.type));
        const webhookUrlLimit = CUSTOM_WEBHOOK_LIMITS.url;
        const webhookHeaderNameLimit = CUSTOM_WEBHOOK_LIMITS.headerName;
        const webhookHeaderValueLimit = CUSTOM_WEBHOOK_LIMITS.headerValue;
        const webhookBodyLimit = CUSTOM_WEBHOOK_LIMITS.body;
        const webhookFormFieldsLimit = CUSTOM_WEBHOOK_LIMITS.formFields;
        const webhookHeadersLimit = CUSTOM_WEBHOOK_LIMITS.headers;
        const bodyTemplateInputRef = ref<InstanceType<typeof ElInput>>();
        const bodyTemplateFocused = ref(false);
        const activeFormFieldIndex = ref<number | null>(null);
        const templateVariables = [
            { token: CUSTOM_WEBHOOK_VARIABLES[0], labelKey: 'xpack.alert.templateVariableTitle' },
            { token: CUSTOM_WEBHOOK_VARIABLES[1], labelKey: 'xpack.alert.templateVariableMessage' },
            { token: CUSTOM_WEBHOOK_VARIABLES[2], labelKey: 'xpack.alert.templateVariableType' },
            { token: CUSTOM_WEBHOOK_VARIABLES[3], labelKey: 'xpack.alert.templateVariableNodeName' },
            { token: CUSTOM_WEBHOOK_VARIABLES[4], labelKey: 'xpack.alert.templateVariableTimestamp' },
        ];
        const bodyDrafts = reactive<Record<CustomWebhookBodyType, CustomWebhookBody>>({
            json: { type: 'json', template: '', fields: [] },
            form: { type: 'form', template: '', fields: [] },
            text: { type: 'text', template: '{{message}}', fields: [] },
        });
        watch(
            () => __panelSetupProps.modelValue.body,
            (body) => {
                bodyDrafts[body.type] = {
                    type: body.type,
                    template: body.template,
                    fields: body.fields.map((field) => ({ ...field })),
                };
            },
            { deep: true, immediate: true },
        );
        const emitValue = (value: CustomWebhookDraft) => ctx.emit('update:modelValue', value);
        const updateDisplayName = (displayName: string) => emitValue({ ...__panelSetupProps.modelValue, displayName });
        const changePreset = async (value: string | number | boolean | undefined) => {
            const preset = value as CustomWebhookPreset;
            if (preset === __panelSetupProps.modelValue.preset) return;
            const hasBodyContent = Boolean(
                __panelSetupProps.modelValue.body.template || __panelSetupProps.modelValue.body.fields.length,
            );
            const overwritesBody =
                preset !== 'custom' && !isCustomWebhookPresetPristine(__panelSetupProps.modelValue) && hasBodyContent;
            if (overwritesBody) {
                try {
                    await ElMessageBox.confirm(
                        i18n.global.t('xpack.alert.presetOverwriteHelper'),
                        i18n.global.t('xpack.alert.webhookPreset'),
                        {
                            confirmButtonText: i18n.global.t('commons.button.confirm'),
                            cancelButtonText: i18n.global.t('commons.button.cancel'),
                        },
                    );
                } catch {
                    return;
                }
            }
            const next = applyCustomWebhookPreset(__panelSetupProps.modelValue, preset);
            bodyDrafts[next.body.type] = { ...next.body, fields: next.body.fields.map((field) => ({ ...field })) };
            bodyTemplateFocused.value = false;
            activeFormFieldIndex.value = null;
            emitValue(next);
        };
        const updateUrlValue = (value: string) => {
            emitValue({
                ...__panelSetupProps.modelValue,
                url: replaceSecretDraft(__panelSetupProps.modelValue.url, value),
            });
        };
        const keepUrl = () => {
            emitValue({ ...__panelSetupProps.modelValue, url: keepSecretDraft(__panelSetupProps.modelValue.url) });
        };
        const clearUrl = () => {
            if (!__panelSetupProps.allowClearUrl) return;
            emitValue({ ...__panelSetupProps.modelValue, url: clearSecretDraft(__panelSetupProps.modelValue.url) });
        };
        const defaultBodyForType = (type: CustomWebhookBodyType): CustomWebhookBody => {
            if (type === 'form') return { type, template: '', fields: [createCustomWebhookFormField()] };
            if (type === 'text') return { type, template: '{{message}}', fields: [] };
            return { type, template: '{}', fields: [] };
        };
        const changeBodyType = (value: string | number | boolean | undefined) => {
            const type = value as CustomWebhookBodyType;
            bodyDrafts[__panelSetupProps.modelValue.body.type] = {
                ...__panelSetupProps.modelValue.body,
                fields: __panelSetupProps.modelValue.body.fields.map((field) => ({ ...field })),
            };
            const cached = bodyDrafts[type];
            const body = cached.template || cached.fields.length ? cached : defaultBodyForType(type);
            bodyTemplateFocused.value = false;
            activeFormFieldIndex.value = null;
            emitValue({
                ...__panelSetupProps.modelValue,
                preset: 'custom',
                body: { ...body, fields: body.fields.map((field) => ({ ...field })) },
            });
        };
        const updateBodyTemplate = (template: string) => {
            emitValue(updateCustomWebhookBodyTemplate(__panelSetupProps.modelValue, template));
        };
        const formatJsonBody = () => {
            if (__panelSetupProps.modelValue.body.type !== 'json') return;
            const result = formatCustomWebhookJsonTemplate(__panelSetupProps.modelValue.body.template);
            if (!result.success) {
                MsgError(
                    i18n.global.t(
                        (result as { error?: string }).error === 'bodyTooLarge'
                            ? 'xpack.alert.jsonFormatTooLarge'
                            : 'xpack.alert.customWebhookValidation.jsonInvalid',
                    ),
                );
                return;
            }
            if (result.template === __panelSetupProps.modelValue.body.template) return;
            updateBodyTemplate(result.template);
            void nextTick(() => {
                bodyTemplateInputRef.value?.focus();
                const textarea = bodyTemplateInputRef.value?.textarea;
                if (textarea) {
                    textarea.setSelectionRange(0, 0);
                    textarea.scrollTop = 0;
                    textarea.scrollLeft = 0;
                }
                bodyTemplateFocused.value = true;
            });
        };
        const addFormField = () => {
            emitValue({
                ...__panelSetupProps.modelValue,
                preset: 'custom',
                body: {
                    ...__panelSetupProps.modelValue.body,
                    fields: [...__panelSetupProps.modelValue.body.fields, createCustomWebhookFormField()],
                },
            });
        };
        const updateFormField = (index: number, field: 'key' | 'value', value: string) => {
            const fields = __panelSetupProps.modelValue.body.fields.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item,
            );
            emitValue({
                ...__panelSetupProps.modelValue,
                preset: 'custom',
                body: { ...__panelSetupProps.modelValue.body, fields },
            });
        };
        const removeFormField = (index: number) => {
            emitValue({
                ...__panelSetupProps.modelValue,
                preset: 'custom',
                body: {
                    ...__panelSetupProps.modelValue.body,
                    fields: __panelSetupProps.modelValue.body.fields.filter((_, itemIndex) => itemIndex !== index),
                },
            });
            if (activeFormFieldIndex.value === index) {
                activeFormFieldIndex.value = null;
            } else if (activeFormFieldIndex.value !== null && activeFormFieldIndex.value > index) {
                activeFormFieldIndex.value -= 1;
            }
        };
        const addHeader = () =>
            emitValue({
                ...__panelSetupProps.modelValue,
                headers: [...__panelSetupProps.modelValue.headers, createCustomWebhookHeader()],
            });
        const updateHeader = (index: number, patch: Partial<CustomWebhookDraft['headers'][number]>) => {
            const headers = __panelSetupProps.modelValue.headers.map((header, itemIndex) =>
                itemIndex === index ? { ...header, ...patch } : header,
            );
            emitValue({ ...__panelSetupProps.modelValue, headers });
        };
        const updateSecretHeaderValue = (index: number, value: string) => {
            updateHeader(index, replaceSecretDraft(__panelSetupProps.modelValue.headers[index], value));
        };
        const updateHeaderKey = (index: number, key: string) => {
            const current = __panelSetupProps.modelValue.headers[index];
            if (!isCustomWebhookSecretHeader(key) || current.secret) {
                updateHeader(index, { key });
                return;
            }
            updateHeader(index, {
                key,
                secret: true,
                configured: false,
                masked: '',
                action: 'replace',
            });
        };
        const removeHeader = (index: number) => {
            emitValue({
                ...__panelSetupProps.modelValue,
                headers: __panelSetupProps.modelValue.headers.filter((_, itemIndex) => itemIndex !== index),
            });
        };
        const toggleHeaderSecret = (index: number, secret: boolean) => {
            const current = __panelSetupProps.modelValue.headers[index];
            if (!secret && isCustomWebhookSecretHeader(current.key)) return;
            updateHeader(index, {
                secret,
                configured: false,
                masked: '',
                action: 'replace',
                value: current.action === 'replace' ? current.value : '',
            });
        };
        const setHeaderSecretAction = (index: number, action: CustomWebhookSecretAction) => {
            const header = __panelSetupProps.modelValue.headers[index];
            if (action === 'keep') {
                updateHeader(index, keepSecretDraft(header));
                return;
            }
            if (action === 'clear') {
                updateHeader(index, clearSecretDraft(header));
                return;
            }
            updateHeader(index, replaceSecretDraft(header, ''));
        };
        const insertVariable = (variable: string) => {
            if (__panelSetupProps.modelValue.body.type === 'form') {
                if (__panelSetupProps.modelValue.body.fields.length === 0) {
                    const field = createCustomWebhookFormField();
                    field.value = variable;
                    emitValue({
                        ...__panelSetupProps.modelValue,
                        preset: 'custom',
                        body: { ...__panelSetupProps.modelValue.body, fields: [field] },
                    });
                    return;
                }
                const fallbackIndex = __panelSetupProps.modelValue.body.fields.length - 1;
                const targetIndex = activeFormFieldIndex.value ?? fallbackIndex;
                updateFormField(
                    targetIndex,
                    'value',
                    __panelSetupProps.modelValue.body.fields[targetIndex].value + variable,
                );
                return;
            }
            const textarea = bodyTemplateInputRef.value?.textarea;
            const selection =
                bodyTemplateFocused.value && textarea
                    ? { start: textarea.selectionStart, end: textarea.selectionEnd }
                    : undefined;
            const insertion = insertCustomWebhookVariable(
                __panelSetupProps.modelValue.body.template,
                variable,
                __panelSetupProps.modelValue.body.type,
                selection,
            );
            updateBodyTemplate(insertion.template);
            void nextTick(() => {
                bodyTemplateInputRef.value?.focus();
                bodyTemplateInputRef.value?.textarea?.setSelectionRange(insertion.cursor, insertion.cursor);
                bodyTemplateFocused.value = true;
            });
        };
        const errorFor = (field: string): string => {
            const issue = __panelSetupProps.validationIssues.find(
                (item) => item.field === field || item.field.startsWith(`${field}.`),
            );
            return issue ? i18n.global.t(`xpack.alert.customWebhookValidation.${issue.code}`) : '';
        };
        return () => (
            <div class={'custom-webhook-form'}>
                {__panelSetupProps.modelValue.state ? (
                    <ElAlert
                        closable={false}
                        type="warning"
                        show-icon
                        title={$t('xpack.alert.customWebhookRecoveryRequired')}
                        class={'mb-3'}
                    />
                ) : null}
                <ElFormItem
                    label={$t('xpack.alert.displayName')}
                    prop="customWebhook.displayName"
                    error={errorFor('displayName')}
                >
                    <ElInput
                        model-value={__panelSetupProps.modelValue.displayName}
                        maxlength="64"
                        show-word-limit
                        onUpdate:model-value={($event?: any) => {
                            (updateDisplayName as any)($event);
                        }}
                    />
                </ElFormItem>
                <ElFormItem label={$t('xpack.alert.webhookPreset')}>
                    <ElSelect
                        model-value={__panelSetupProps.modelValue.preset}
                        onChange={($event?: any) => {
                            (changePreset as any)($event);
                        }}
                        class={'w-full'}
                    >
                        <ElOption value="genericJson" label={$t('xpack.alert.genericJsonPreset')} />
                        <ElOption value="slack" label="Slack" />
                        <ElOption value="discord" label="Discord" />
                        <ElOption value="teamsWorkflows" label="Teams Workflows" />
                        <ElOption value="custom" label={$t('xpack.alert.customPreset')} />
                    </ElSelect>
                </ElFormItem>
                <ElFormItem
                    label={$t('xpack.alert.webhookUrl')}
                    error={errorFor('url')}
                    class={'webhook-url-item'}
                    v-slots={{
                        label: () => (
                            <>
                                <div class={'flex w-full flex-wrap items-center justify-between gap-x-3'}>
                                    <span>{$t('xpack.alert.webhookUrl')}</span>
                                    <div class={'flex flex-wrap items-center gap-2'}>
                                        {__panelSetupProps.modelValue.url.configured &&
                                        __panelSetupProps.modelValue.url.action !== 'keep' ? (
                                            <ElButton
                                                link
                                                type="primary"
                                                onClick={($event?: any) => {
                                                    $event.preventDefault();
                                                    (keepUrl as any)($event);
                                                }}
                                            >
                                                {$t('xpack.alert.keepSecret')}
                                            </ElButton>
                                        ) : null}
                                        {__panelSetupProps.allowClearUrl &&
                                        __panelSetupProps.modelValue.url.configured &&
                                        __panelSetupProps.modelValue.url.action !== 'clear' ? (
                                            <ElButton
                                                link
                                                type="danger"
                                                onClick={($event?: any) => {
                                                    $event.preventDefault();
                                                    (clearUrl as any)($event);
                                                }}
                                            >
                                                {$t('xpack.alert.clearSecret')}
                                            </ElButton>
                                        ) : null}
                                    </div>
                                </div>
                            </>
                        ),
                    }}
                >
                    {__panelSetupProps.modelValue.url.action === 'keep' ? (
                        <>
                            <div class={'secret-editor'}>
                                <ElInput
                                    model-value={secretEditorValue(__panelSetupProps.modelValue.url)}
                                    aria-label={$t('xpack.alert.webhookUrl')}
                                    type="password"
                                    show-password
                                    autocomplete="new-password"
                                    maxlength={webhookUrlLimit}
                                    placeholder={secretEditorPlaceholder(
                                        __panelSetupProps.modelValue.url,
                                        'https://example.com/webhook',
                                    )}
                                    onUpdate:model-value={($event?: any) => {
                                        (updateUrlValue as any)($event);
                                    }}
                                />
                            </div>
                        </>
                    ) : __panelSetupProps.modelValue.url.action === 'clear' ? (
                        <>
                            <div class={'secret-editor'}>
                                <ElInput
                                    model-value
                                    aria-label={$t('xpack.alert.webhookUrl')}
                                    type="password"
                                    show-password
                                    autocomplete="new-password"
                                    maxlength={webhookUrlLimit}
                                    placeholder="https://example.com/webhook"
                                    onUpdate:model-value={($event?: any) => {
                                        (updateUrlValue as any)($event);
                                    }}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div class={'secret-editor'}>
                                <ElInput
                                    model-value={__panelSetupProps.modelValue.url.value}
                                    aria-label={$t('xpack.alert.webhookUrl')}
                                    type="password"
                                    show-password
                                    autocomplete="new-password"
                                    maxlength={webhookUrlLimit}
                                    placeholder="https://example.com/webhook"
                                    onUpdate:model-value={($event?: any) => {
                                        (updateUrlValue as any)($event);
                                    }}
                                />
                            </div>
                        </>
                    )}
                    <span class={'input-help'}>{$t('xpack.alert.webhookPublicAddressHelper')}</span>
                </ElFormItem>
                <ElFormItem label={$t('xpack.alert.bodyType')}>
                    <ElRadioGroup
                        model-value={__panelSetupProps.modelValue.body.type}
                        onChange={($event?: any) => {
                            (changeBodyType as any)($event);
                        }}
                        class={'body-type-group'}
                    >
                        <ElRadioButton value="json">{'JSON'}</ElRadioButton>
                        <ElRadioButton value="form">{'Form'}</ElRadioButton>
                        <ElRadioButton value="text">{'Text'}</ElRadioButton>
                    </ElRadioGroup>
                    <span class={'input-help'}>
                        {'POST · '}
                        {unref(derivedContentType)}
                    </span>
                </ElFormItem>
                <ElFormItem
                    label={$t('xpack.alert.bodyTemplate')}
                    error={errorFor('body')}
                    class={'body-template-item'}
                    v-slots={{
                        label: () => (
                            <>
                                <div
                                    class={'flex w-full min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1'}
                                >
                                    <span>{$t('xpack.alert.bodyTemplate')}</span>
                                    {__panelSetupProps.modelValue.body.type === 'json' ? (
                                        <ElButton
                                            link
                                            type="primary"
                                            disabled={!__panelSetupProps.modelValue.body.template.trim()}
                                            onClick={($event?: any) => {
                                                $event.preventDefault();
                                                (formatJsonBody as any)($event);
                                            }}
                                            class={'min-h-11 shrink-0 sm:min-h-6'}
                                        >
                                            {$t('xpack.alert.formatJson')}
                                        </ElButton>
                                    ) : null}
                                </div>
                            </>
                        ),
                    }}
                >
                    {__panelSetupProps.modelValue.body.type === 'form' ? (
                        <>
                            <div class={'key-value-list'}>
                                {(__panelSetupProps.modelValue.body.fields || []).map((field, index) => (
                                    <div class={'key-value-row'} key={field.uid}>
                                        <ElInput
                                            model-value={field.key}
                                            maxlength={webhookHeaderNameLimit}
                                            placeholder={$t('xpack.alert.formFieldName')}
                                            onUpdate:model-value={($event?: any) => {
                                                updateFormField(index, 'key', $event);
                                            }}
                                        />
                                        <ElInput
                                            model-value={field.value}
                                            maxlength={webhookHeaderValueLimit}
                                            placeholder={$t('xpack.alert.formFieldValue')}
                                            onFocus={($event?: any) => {
                                                activeFormFieldIndex.value = index;
                                            }}
                                            onUpdate:model-value={($event?: any) => {
                                                updateFormField(index, 'value', $event);
                                            }}
                                        />
                                        <ElButton
                                            plain
                                            type="danger"
                                            onClick={($event?: any) => {
                                                removeFormField(index);
                                            }}
                                        >
                                            {$t('commons.button.delete')}
                                        </ElButton>
                                    </div>
                                ))}
                                <ElButton
                                    plain
                                    type="primary"
                                    disabled={__panelSetupProps.modelValue.body.fields.length >= webhookFormFieldsLimit}
                                    onClick={($event?: any) => {
                                        (addFormField as any)($event);
                                    }}
                                >
                                    {$t('xpack.alert.addFormField')}
                                </ElButton>
                            </div>
                        </>
                    ) : (
                        <ElInput
                            ref={bodyTemplateInputRef}
                            model-value={__panelSetupProps.modelValue.body.template}
                            aria-label={$t('xpack.alert.bodyTemplate')}
                            type="textarea"
                            rows={__panelSetupProps.modelValue.body.type === 'json' ? 12 : 7}
                            maxlength={webhookBodyLimit}
                            wrap={__panelSetupProps.modelValue.body.type === 'json' ? 'off' : 'soft'}
                            spellcheck={false}
                            autocapitalize="off"
                            autocomplete="off"
                            resize="vertical"
                            onFocus={($event?: any) => {
                                bodyTemplateFocused.value = true;
                            }}
                            onUpdate:model-value={($event?: any) => {
                                (updateBodyTemplate as any)($event);
                            }}
                            class={'body-template-editor'}
                        />
                    )}
                </ElFormItem>
                <ElCollapse
                    modelValue={unref(activeSections)}
                    onUpdate:modelValue={($v) => {
                        activeSections.value = $v as any;
                    }}
                    class={'advanced-collapse'}
                >
                    <ElCollapseItem
                        name="advanced"
                        v-slots={{
                            title: () => (
                                <>
                                    <div class={'advanced-title'}>
                                        <span>{$t('xpack.alert.webhookAdvanced')}</span>
                                        <span class={'advanced-title__summary'}>
                                            {' POST · '}
                                            {unref(derivedContentType)}
                                            {' · '}
                                            {__panelSetupProps.modelValue.headers.length}
                                            {$t('xpack.alert.headers')}
                                        </span>
                                    </div>
                                </>
                            ),
                        }}
                    >
                        <ElFormItem label={$t('xpack.alert.headers')} error={errorFor('headers')}>
                            <div class={'header-list'}>
                                {(__panelSetupProps.modelValue.headers || []).map((header, index) => (
                                    <div class={'header-card'} key={header.uid}>
                                        <ElInput
                                            model-value={header.key}
                                            maxlength={webhookHeaderNameLimit}
                                            placeholder={$t('xpack.alert.headerName')}
                                            onUpdate:model-value={($event?: any) => {
                                                updateHeaderKey(index, $event);
                                            }}
                                        />
                                        {!header.secret ? (
                                            <>
                                                <ElInput
                                                    model-value={header.value}
                                                    maxlength={webhookHeaderValueLimit}
                                                    placeholder={$t('xpack.alert.headerValue')}
                                                    onUpdate:model-value={($event?: any) => {
                                                        updateHeader(index, { value: $event });
                                                    }}
                                                />
                                            </>
                                        ) : header.action === 'keep' ? (
                                            <>
                                                <ElInput
                                                    model-value={secretEditorValue(header)}
                                                    maxlength={webhookHeaderValueLimit}
                                                    type="password"
                                                    show-password
                                                    autocomplete="new-password"
                                                    placeholder={secretEditorPlaceholder(
                                                        header,
                                                        $t('xpack.alert.headerValue'),
                                                    )}
                                                    onUpdate:model-value={($event?: any) => {
                                                        updateSecretHeaderValue(index, $event);
                                                    }}
                                                />
                                            </>
                                        ) : header.action === 'clear' ? (
                                            <>
                                                <div class={'secret-editor'}>
                                                    <ElInput
                                                        model-value
                                                        maxlength={webhookHeaderValueLimit}
                                                        type="password"
                                                        show-password
                                                        autocomplete="new-password"
                                                        placeholder={$t('xpack.alert.headerValue')}
                                                        onUpdate:model-value={($event?: any) => {
                                                            updateSecretHeaderValue(index, $event);
                                                        }}
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <ElInput
                                                    model-value={header.value}
                                                    maxlength={webhookHeaderValueLimit}
                                                    type="password"
                                                    show-password
                                                    autocomplete="new-password"
                                                    placeholder={$t('xpack.alert.headerValue')}
                                                    onUpdate:model-value={($event?: any) => {
                                                        updateHeader(index, { value: $event });
                                                    }}
                                                />
                                            </>
                                        )}
                                        <div class={'header-card__footer'}>
                                            <ElCheckbox
                                                model-value={header.secret}
                                                disabled={isCustomWebhookSecretHeader(header.key)}
                                                onUpdate:model-value={($event?: any) => {
                                                    toggleHeaderSecret(index, Boolean($event));
                                                }}
                                            >
                                                {$t('xpack.alert.secretValue')}
                                            </ElCheckbox>
                                            {header.secret ? (
                                                <div class={'header-card__secret-actions'}>
                                                    {header.configured && header.action !== 'keep' ? (
                                                        <ElButton
                                                            link
                                                            type="primary"
                                                            onClick={($event?: any) => {
                                                                setHeaderSecretAction(index, 'keep');
                                                            }}
                                                        >
                                                            {$t('xpack.alert.keepSecret')}
                                                        </ElButton>
                                                    ) : null}
                                                    {header.configured && header.action !== 'clear' ? (
                                                        <ElButton
                                                            link
                                                            type="danger"
                                                            onClick={($event?: any) => {
                                                                setHeaderSecretAction(index, 'clear');
                                                            }}
                                                        >
                                                            {$t('xpack.alert.clearSecret')}
                                                        </ElButton>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                            <ElButton
                                                link
                                                type="danger"
                                                onClick={($event?: any) => {
                                                    removeHeader(index);
                                                }}
                                            >
                                                {$t('commons.button.delete')}
                                            </ElButton>
                                        </div>
                                    </div>
                                ))}
                                <ElButton
                                    plain
                                    type="primary"
                                    disabled={__panelSetupProps.modelValue.headers.length >= webhookHeadersLimit}
                                    onClick={($event?: any) => {
                                        (addHeader as any)($event);
                                    }}
                                >
                                    {$t('xpack.alert.addHeader')}
                                </ElButton>
                            </div>
                        </ElFormItem>
                        <ElFormItem label={$t('xpack.alert.templateVariables')}>
                            <div class={'variable-list'}>
                                {(templateVariables || []).map((variable) => (
                                    <ElTag
                                        effect="plain"
                                        title={variable.token}
                                        onClick={($event?: any) => {
                                            insertVariable(variable.token);
                                        }}
                                        class={'variable-tag'}
                                        key={variable.token}
                                    >
                                        {$t(variable.labelKey)}
                                    </ElTag>
                                ))}
                            </div>
                            <span class={'input-help'}>{$t('xpack.alert.templateVariablesHelper')}</span>
                        </ElFormItem>
                    </ElCollapseItem>
                </ElCollapse>
            </div>
        );
    },
    options,
);
