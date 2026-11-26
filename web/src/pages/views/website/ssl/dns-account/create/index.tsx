import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { DNSTypes } from '@/global/mimetype';
import { rpc } from '@/lib/rpc';
interface AccountProps {
    mode: string;
    form: any;
}
import permissionDirective from '@/directives/modules/permission';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    saved: (...args: unknown[]) => true,
};

const options = {
    name: 'create',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const accountData = ref<AccountProps>({
            mode: 'create',
            form: {},
        });
        const open = ref();
        const loading = ref(false);
        const accountForm = ref<FormInstance>();
        const rules = ref<any>({
            name: [Rules.requiredInput, Rules.linuxName],
            type: [Rules.requiredSelect],
            authorization: {
                accessKey: [Rules.requiredInput],
                secretKey: [Rules.requiredInput],
                id: [Rules.requiredInput],
                token: [Rules.requiredInput],
                apiKey: [Rules.requiredInput],
                apiUser: [Rules.requiredInput],
                secretID: [Rules.requiredInput],
                apiSecret: [Rules.requiredInput],
                apiPrefix: [Rules.requiredInput],
                username: [Rules.requiredInput],
                password: [Rules.requiredInput],
                customerNumber: [Rules.requiredInput],
            },
        });
        const account = ref({
            id: 0,
            name: '',
            type: 'AliYun',
            authorization: {},
        });
        const handleClose = () => {
            resetForm();
            open.value = false;
        };
        const resetForm = () => {
            accountForm.value?.resetFields();
            account.value = { id: 0, name: '', type: 'AliYun', authorization: {} };
        };
        const acceptParams = (__panelSetupProps: AccountProps) => {
            resetForm();
            accountData.value.mode = __panelSetupProps.mode;
            if (__panelSetupProps.mode === 'edit') {
                account.value = {
                    ...__panelSetupProps.form,
                    authorization: { ...__panelSetupProps.form.authorization },
                };
            }
            open.value = true;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl || loading.value) return;
            loading.value = true;
            try {
                if (!(await formEl.validate().catch(() => false))) return;
                const save =
                    accountData.value.mode === 'edit'
                        ? (data: any) => rpc.website.updateDNSAccount(data)
                        : (data: any) => rpc.website.createDNSAccount(data);
                await save(account.value);
                MsgSuccess(
                    i18n.global.t(
                        accountData.value.mode === 'edit' ? 'commons.msg.updateSuccess' : 'commons.msg.createSuccess',
                    ),
                );
                handleClose();
                ctx.emit('saved');
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('commons.button.' + unref(accountData).mode)}
                size="large"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit(unref(accountForm));
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm ref={accountForm} label-position="top" model={unref(account)} rules={unref(rules)}>
                        <ElFormItem label={$t('commons.table.name')} prop="name">
                            <ElInput
                                modelValue={unref(account).name}
                                onUpdate:modelValue={($v) => {
                                    unref(account).name = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.type')} prop="type">
                            <ElSelect
                                modelValue={unref(account).type}
                                onUpdate:modelValue={($v) => {
                                    unref(account).type = $v as any;
                                }}
                                disabled={unref(accountData).mode === 'edit'}
                            >
                                {(DNSTypes || []).map((type, index) => (
                                    <ElOption
                                        label={
                                            type.deprecated ? `${type.label} (${$t('ssl.dnsPodRemoved')})` : type.label
                                        }
                                        value={type.value}
                                        disabled={type.deprecated && unref(accountData).mode === 'create'}
                                        key={index}
                                    />
                                ))}
                            </ElSelect>
                            {unref(account).type === 'DnsPod' ? (
                                <span class={'input-help text-red-500'}>{$t('ssl.dnsPodRemovedTip')}</span>
                            ) : null}
                        </ElFormItem>
                        {unref(account).type === 'AliYun' ||
                        unref(account).type === 'AliESA' ||
                        unref(account).type === 'HuaweiCloud' ||
                        unref(account).type === 'BaiduCloud' ||
                        unref(account).type === 'AWSRoute53' ? (
                            <div>
                                <ElFormItem label="Access key" prop="authorization.accessKey">
                                    <ElInput
                                        modelValue={unref(account).authorization['accessKey']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['accessKey'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Secret key" prop="authorization.secretKey">
                                    <ElInput
                                        modelValue={unref(account).authorization['secretKey']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['secretKey'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'HuaweiCloud' ? (
                            <ElFormItem label="Region" prop="authorization.region">
                                <ElInput
                                    modelValue={unref(account).authorization['region']}
                                    onUpdate:modelValue={($v) => {
                                        unref(account).authorization['region'] =
                                            typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                    placeholder={'cn-north-1'}
                                />
                            </ElFormItem>
                        ) : null}
                        {unref(account).type === 'TencentCloud' ? (
                            <div>
                                <ElFormItem label="Secret ID" prop="authorization.secretID">
                                    <ElInput
                                        modelValue={unref(account).authorization['secretID']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['secretID'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Secret Key" prop="authorization.secretKey">
                                    <ElInput
                                        modelValue={unref(account).authorization['secretKey']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['secretKey'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'Volcengine' ? (
                            <div>
                                <ElFormItem label="Access key" prop="authorization.accessKey">
                                    <ElInput
                                        modelValue={unref(account).authorization['accessKey']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['accessKey'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Secret key" prop="authorization.secretKey">
                                    <ElInput
                                        modelValue={unref(account).authorization['secretKey']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['secretKey'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'CloudDns' ? (
                            <div>
                                <ElFormItem label="Client ID" prop="authorization.clientID">
                                    <ElInput
                                        modelValue={unref(account).authorization['clientID']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['clientID'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Email" prop="authorization.email">
                                    <ElInput
                                        modelValue={unref(account).authorization['email']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['email'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Password" prop="authorization.password">
                                    <ElInput
                                        modelValue={unref(account).authorization['password']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['password'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'CloudFlare' ? (
                            <div>
                                <ElFormItem label="EMAIL" prop="authorization.email">
                                    <ElInput
                                        modelValue={unref(account).authorization['email']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['email'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="API Token" prop="authorization.apiKey">
                                    <ElInput
                                        modelValue={unref(account).authorization['apiKey']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['apiKey'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                    <span class={'input-help text-red-500'}>{$t('ssl.cfHelper')}</span>
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'NameCheap' ||
                        unref(account).type === 'NameSilo' ||
                        unref(account).type === 'Godaddy' ||
                        unref(account).type === 'RainYun' ||
                        unref(account).type === 'Spaceship' ||
                        unref(account).type === 'Dynadot' ||
                        unref(account).type === 'Dynu' ? (
                            <ElFormItem label="API Key" prop="authorization.apiKey">
                                <ElInput
                                    modelValue={unref(account).authorization['apiKey']}
                                    onUpdate:modelValue={($v) => {
                                        unref(account).authorization['apiKey'] =
                                            typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                />
                            </ElFormItem>
                        ) : null}
                        {unref(account).type === 'NameCheap' ? (
                            <ElFormItem label="API User" prop="authorization.apiUser">
                                <ElInput
                                    modelValue={unref(account).authorization['apiUser']}
                                    onUpdate:modelValue={($v) => {
                                        unref(account).authorization['apiUser'] =
                                            typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                />
                            </ElFormItem>
                        ) : null}
                        {unref(account).type === 'Godaddy' ||
                        unref(account).type === 'Spaceship' ||
                        unref(account).type === 'Dynadot' ? (
                            <ElFormItem label="API Secret" prop="authorization.apiSecret">
                                <ElInput
                                    modelValue={unref(account).authorization['apiSecret']}
                                    onUpdate:modelValue={($v) => {
                                        unref(account).authorization['apiSecret'] =
                                            typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                />
                            </ElFormItem>
                        ) : null}
                        {unref(account).type === 'NameCom' ? (
                            <div>
                                <ElFormItem label="Username" prop="authorization.apiUser">
                                    <ElInput
                                        modelValue={unref(account).authorization['apiUser']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['apiUser'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Token" prop="authorization.token">
                                    <ElInput
                                        modelValue={unref(account).authorization['token']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['token'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'Netcup' ? (
                            <div>
                                <ElFormItem label="Customer Number" prop="authorization.customerNumber">
                                    <ElInput
                                        modelValue={unref(account).authorization['customerNumber']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['customerNumber'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="API Key" prop="authorization.apiKey">
                                    <ElInput
                                        modelValue={unref(account).authorization['apiKey']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['apiKey'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="API Password" prop="authorization.password">
                                    <ElInput
                                        modelValue={unref(account).authorization['password']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['password'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        type="password"
                                        show-password
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'FreeMyIP' ||
                        unref(account).type === 'Vercel' ||
                        unref(account).type === 'IonosCloud' ? (
                            <div>
                                <ElFormItem label="Token" prop="authorization.token">
                                    <ElInput
                                        modelValue={unref(account).authorization['token']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['token'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'Ionos' ? (
                            <div>
                                <ElFormItem label="API Prefix" prop="authorization.apiPrefix">
                                    <ElInput
                                        modelValue={unref(account).authorization['apiPrefix']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['apiPrefix'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="API Secret" prop="authorization.apiSecret">
                                    <ElInput
                                        modelValue={unref(account).authorization['apiSecret']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['apiSecret'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'ClouDNS' ? (
                            <div>
                                <ElFormItem label="Auth ID" prop="authorization.authID">
                                    <ElInput
                                        modelValue={unref(account).authorization['authID']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['authID'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Sub Auth ID" prop="authorization.subAuthID">
                                    <ElInput
                                        modelValue={unref(account).authorization['subAuthID']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['subAuthID'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Auth Password" prop="authorization.authPassword">
                                    <ElInput
                                        modelValue={unref(account).authorization['authPassword']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['authPassword'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'WestCN' || unref(account).type === 'RegRu' ? (
                            <div>
                                <ElFormItem label="Username" prop="authorization.username">
                                    <ElInput
                                        modelValue={unref(account).authorization['username']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['username'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Password" prop="authorization.password">
                                    <ElInput
                                        modelValue={unref(account).authorization['password']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['password'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'Ovh' ? (
                            <div>
                                <ElFormItem
                                    label="Endpoint"
                                    prop="authorization.endpoint"
                                    rules={[Rules.requiredInput]}
                                >
                                    <ElInput
                                        modelValue={unref(account).authorization['endpoint']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['endpoint'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem
                                    label="AccessToken"
                                    prop="authorization.accessToken"
                                    rules={[Rules.requiredInput]}
                                >
                                    <ElInput
                                        modelValue={unref(account).authorization['accessToken']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['accessToken'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'AcmeDNS' ? (
                            <div>
                                <ElFormItem
                                    label="API BASE"
                                    prop="authorization.endpoint"
                                    rules={[Rules.requiredInput]}
                                >
                                    <ElInput
                                        modelValue={unref(account).authorization['endpoint']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['endpoint'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="BASE URL" prop="authorization.baseURL" rules={[Rules.requiredInput]}>
                                    <ElInput
                                        modelValue={unref(account).authorization['baseURL']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['baseURL'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'AWSRoute53' ? (
                            <div>
                                <ElFormItem label="Region" prop="authorization.region">
                                    <ElInput
                                        modelValue={unref(account).authorization['region']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['region'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                        placeholder={'us-east-1'}
                                    />
                                </ElFormItem>
                                <ElFormItem
                                    label={$t('ssl.hostedZoneID')}
                                    prop="authorization.endpoint"
                                    rules={[Rules.requiredInput]}
                                >
                                    <ElInput
                                        modelValue={unref(account).authorization['endpoint']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['endpoint'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'PorkBun' ? (
                            <div>
                                <ElFormItem label="API Key" prop="authorization.apiKey">
                                    <ElInput
                                        modelValue={unref(account).authorization['apiKey']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['apiKey'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Secret Key" prop="authorization.secretKey">
                                    <ElInput
                                        modelValue={unref(account).authorization['secretKey']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['secretKey'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type === 'Technitium' ? (
                            <div>
                                <ElFormItem label="BASE URL" prop="authorization.baseURL" rules={[Rules.requiredInput]}>
                                    <ElInput
                                        modelValue={unref(account).authorization['baseURL']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['baseURL'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="Token" prop="authorization.token">
                                    <ElInput
                                        modelValue={unref(account).authorization['token']}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).authorization['token'] =
                                                typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
