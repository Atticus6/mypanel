import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import {
    formatHostAddressList,
    isValidIPOrCIDR,
    isValidPortRange,
    splitTagValues,
} from '@/pages/views/host/firewall/utils/validation';
import { normalizeWhiteListRule, WhiteListProtocol, WhiteListRule, WhiteListType, whiteListRuleKey } from './model';
import { rpc } from '@/lib/rpc';
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
    rules?: WhiteListRule[];
    panelPort?: string;
    sshPort?: string;
    loading?: boolean;
    ipv6Enabled?: boolean;
}

const emits = {
    saved: () => true,
};

const options = {
    name: 'white-list',
    props: {
        rules: Array,
        panelPort: String,
        sshPort: String,
        loading: Boolean,
        ipv6Enabled: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-d0bb3096',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref(false);
        const dialogVisible = ref(false);
        const saving = ref(false);
        const busy = computed(() => __panelSetupProps.loading || saving.value);
        const disabled = computed(() => busy.value || !__panelSetupProps.rules);
        const data = computed(() => __panelSetupProps.rules || []);
        const defaultSources = computed(() =>
            __panelSetupProps.ipv6Enabled === false ? ['0.0.0.0/0'] : ['0.0.0.0/0', '::/0'],
        );
        const editingRule = ref<WhiteListRule>();
        const formRef = ref<FormInstance>();
        const form = ref({
            type: 'custom' as WhiteListType | 'custom',
            protocol: 'tcp' as WhiteListProtocol,
            port: '',
            sourceInput: '',
        });
        const rules: FormRules = {
            port: [
                {
                    required: true,
                    validator: (_rule, value: string, callback) => {
                        if (!value) {
                            callback(new Error(i18n.global.t('commons.rule.requiredInput')));
                            return;
                        }
                        if (!isValidPortRange(value) || (form.value.type !== 'custom' && !/^\d+$/.test(value))) {
                            const message =
                                form.value.type === 'custom' ? 'firewall.portFormatError' : 'commons.rule.port';
                            callback(new Error(i18n.global.t(message)));
                            return;
                        }
                        callback();
                    },
                    trigger: ['blur', 'change'],
                },
            ],
            sourceInput: [
                {
                    validator: (_rule, value: string, callback) => {
                        if (
                            __panelSetupProps.ipv6Enabled === false &&
                            splitTagValues([value]).some((source) => source.includes(':'))
                        ) {
                            callback(new Error(i18n.global.t('firewall.ipv6Disabled')));
                            return;
                        }
                        if (splitTagValues([value]).some((source) => !isValidIPOrCIDR(source))) {
                            callback(new Error(i18n.global.t('commons.rule.ip')));
                            return;
                        }
                        callback();
                    },
                    trigger: ['blur', 'change'],
                },
            ],
        };
        const serviceTypes: WhiteListType[] = ['ssh', 'panel'];
        const serviceLabel = (type: WhiteListType) => (type === 'panel' ? '1Panel' : 'SSH');
        const servicePortLabel = (type: WhiteListType) =>
            (type === 'panel' ? __panelSetupProps.panelPort : __panelSetupProps.sshPort) ||
            i18n.global.t('commons.status.unknown');
        const changeType = () => {
            if (form.value.type === 'custom') return;
            form.value.port =
                (form.value.type === 'panel' ? __panelSetupProps.panelPort : __panelSetupProps.sshPort) || '';
            formRef.value?.clearValidate('port');
        };
        const acceptParams = () => {
            drawerVisible.value = true;
            dialogVisible.value = false;
        };
        const openEditor = (rule?: WhiteListRule) => {
            if (disabled.value) return;
            editingRule.value = rule;
            form.value = {
                type: rule?.type || 'custom',
                protocol: rule?.protocol || 'tcp',
                port: rule?.port || '',
                sourceInput: formatHostAddressList(rule ? rule.sources || [] : defaultSources.value),
            };
            formRef.value?.clearValidate();
            dialogVisible.value = true;
        };
        const saveRule = async () => {
            if (disabled.value || !formRef.value) return;
            const valid = await formRef.value.validate().catch(() => false);
            if (!valid) return;
            const sources = splitTagValues([form.value.sourceInput]);
            if (!sources.length) {
                sources.push(...defaultSources.value);
            }
            let rule: WhiteListRule;
            try {
                rule = normalizeWhiteListRule({
                    ...form.value,
                    type: form.value.type === 'custom' ? undefined : form.value.type,
                    port: form.value.port,
                    sources,
                });
            } catch {
                MsgError(i18n.global.t('firewall.portFormatError'));
                return;
            }
            const key = whiteListRuleKey(rule);
            if (data.value.some((item) => item !== editingRule.value && whiteListRuleKey(item) === key)) {
                MsgError(i18n.global.t('commons.rule.duplicate'));
                return;
            }
            const oldRule = editingRule.value;
            await submit(() =>
                oldRule
                    ? rpc.firewall.updateWhitelist({ oldRule, rule } as any)
                    : rpc.firewall.createWhitelist({ rule } as any),
            );
        };
        const removeRule = async (rule: WhiteListRule) => {
            if (disabled.value) return;
            const confirmed = await ElMessageBox.confirm(
                i18n.global.t('firewall.whitelistDeleteConfirm'),
                i18n.global.t('commons.button.delete'),
                {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'warning',
                },
            )
                .then(() => true)
                .catch(() => false);
            if (confirmed) await submit(() => rpc.firewall.deleteWhitelist({ rule } as any));
        };
        const submit = async (request: () => Promise<unknown>) => {
            if (disabled.value) return;
            saving.value = true;
            try {
                await request();
                dialogVisible.value = false;
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                ctx.emit('saved');
            } catch {
            } finally {
                saving.value = false;
            }
        };
        ctx.expose({ acceptParams });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(drawerVisible)}
                    onUpdate:modelValue={($v) => {
                        drawerVisible.value = $v as any;
                    }}
                    header={$t('firewall.portWhiteList')}
                    size="large"
                    v-slots={{
                        content: () => (
                            <>
                                <p class={'input-help mb-3'}>{$t('firewall.whitelistConfigHelper')}</p>
                                <div class={'mb-3'}>
                                    <ElButton
                                        type="primary"
                                        disabled={unref(disabled)}
                                        onClick={($event?: any) => {
                                            openEditor();
                                        }}
                                    >
                                        {$t('commons.button.create')}
                                    </ElButton>
                                </div>
                                {withDirectives(
                                    <ComplexTable data={unref(data)}>
                                        <ElTableColumn
                                            label={$t('commons.table.protocol')}
                                            width="100"
                                            v-slots={{
                                                default: ({ row }) => <>{(row.protocol || 'tcp').toUpperCase()}</>,
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('firewall.portOrRange')}
                                            width="150"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        {row.type ? (
                                                            <div class={'flex items-center gap-1 whitespace-nowrap'}>
                                                                <span title={row.port} class={'truncate'}>
                                                                    {row.port || $t('commons.status.unknown')}
                                                                </span>
                                                                <span
                                                                    class={
                                                                        'shrink-0 text-xs text-[var(--el-text-color-secondary)]'
                                                                    }
                                                                >
                                                                    {serviceLabel(row.type)}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span>{row.port}</span>
                                                        )}
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('firewall.allowedSources')}
                                            min-width="260"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <span class={'whitelist-sources'}>
                                                            {formatHostAddressList(row.sources || [])}
                                                        </span>
                                                    </>
                                                ),
                                            }}
                                        />
                                        <ElTableColumn
                                            label={$t('commons.table.operate')}
                                            width="140"
                                            fixed="right"
                                            v-slots={{
                                                default: ({ row }) => (
                                                    <>
                                                        <ElButton
                                                            link
                                                            type="primary"
                                                            disabled={unref(disabled)}
                                                            onClick={($event?: any) => {
                                                                openEditor(row);
                                                            }}
                                                        >
                                                            {$t('commons.button.edit')}
                                                        </ElButton>
                                                        <ElButton
                                                            link
                                                            type="primary"
                                                            disabled={unref(disabled)}
                                                            onClick={($event?: any) => {
                                                                removeRule(row);
                                                            }}
                                                        >
                                                            {$t('commons.button.delete')}
                                                        </ElButton>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </ComplexTable>,
                                    [[vLoading, unref(busy)]],
                                )}
                            </>
                        ),
                    }}
                />
                <DialogPro
                    modelValue={unref(dialogVisible)}
                    onUpdate:modelValue={($v) => {
                        dialogVisible.value = $v as any;
                    }}
                    title={$t(unref(editingRule) ? 'commons.button.edit' : 'commons.button.create')}
                    show-close={!unref(saving)}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    disabled={unref(saving)}
                                    onClick={($event?: any) => {
                                        dialogVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    loading={unref(saving)}
                                    disabled={unref(disabled)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        (saveRule as any)($event);
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    <ElForm
                        ref={formRef}
                        model={unref(form)}
                        rules={__panelSetupProps.rules}
                        label-position="top"
                        disabled={unref(saving)}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                            (saveRule as any)($event);
                        }}
                    >
                        <ElFormItem label={$t('commons.table.type')}>
                            <ElSelect
                                modelValue={unref(form).type}
                                onUpdate:modelValue={($v) => {
                                    unref(form).type = $v as any;
                                }}
                                disabled={!!unref(editingRule)}
                                onChange={($event?: any) => {
                                    (changeType as any)($event);
                                }}
                            >
                                <ElOption value="custom" label={$t('website.other')} />
                                {(serviceTypes || []).map((type) => (
                                    <ElOption
                                        value={type}
                                        label={`${serviceLabel(type)} (${servicePortLabel(type)})`}
                                        key={type}
                                    />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.protocol')} required>
                            <ElSelect
                                modelValue={unref(form).protocol}
                                onUpdate:modelValue={($v) => {
                                    unref(form).protocol = $v as any;
                                }}
                            >
                                <ElOption value="tcp" label="TCP" />
                                <ElOption value="udp" label="UDP" />
                            </ElSelect>
                        </ElFormItem>
                        {unref(form).type === 'custom' ? (
                            <>
                                <ElFormItem label={$t('firewall.portOrRange')} prop="port">
                                    <ElInput
                                        modelValue={unref(form).port}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).port = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        placeholder="80 / 8000-8100"
                                        clearable
                                    />
                                    <span class={'input-help'}>{$t('firewall.portWhiteListHelper')}</span>
                                </ElFormItem>
                            </>
                        ) : (
                            <ElFormItem label={$t('commons.table.port')} prop="port">
                                <ElInput
                                    modelValue={unref(form).port}
                                    onUpdate:modelValue={($v) => {
                                        unref(form).port = typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                    placeholder={unref(form).type === 'ssh' ? '2222' : '18443'}
                                    clearable
                                />
                                <span class={'input-help'}>{$t('firewall.whitelistServicePortsHelper')}</span>
                            </ElFormItem>
                        )}
                        <ElFormItem label={$t('firewall.allowedSources')} prop="sourceInput">
                            <ElInput
                                modelValue={unref(form).sourceInput}
                                onUpdate:modelValue={($v) => {
                                    unref(form).sourceInput = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                                type="textarea"
                                autosize={{ minRows: 3, maxRows: 8 }}
                                placeholder={$t('firewall.sourceAddressPlaceholder')}
                            />
                            <span class={'input-help'}>
                                {$t('firewall.whitelistSourcesHelper', [unref(defaultSources).join(', ')])}
                            </span>
                        </ElFormItem>
                    </ElForm>
                </DialogPro>
            </>
        );
    },
    options,
);
