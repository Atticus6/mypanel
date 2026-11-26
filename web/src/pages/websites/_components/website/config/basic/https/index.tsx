import { $t } from '@/utils/i18n-t';
import HttpsConfig from '@/pages/websites/_components/website/components/https/index';
import { Website } from '@/types/website';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { Rules } from '@/global/form-rules';
import { MsgSuccess } from '@/utils/message';
import './index.styles.css';
import permissionDirective from '@/directives/modules/permission';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'https',
    props: {
        id: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-a1ec750d',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const id = computed(() => {
            return __panelSetupProps.id;
        });
        const httpsForm = ref<FormInstance>();
        let form = reactive({
            acmeAccountID: 0,
            enable: false,
            websiteId: id.value,
            websiteSSLId: undefined,
            type: 'existed',
            importType: 'paste',
            privateKey: '',
            certificate: '',
            privateKeyPath: '',
            certificatePath: '',
            httpConfig: 'HTTPToHTTPS',
            hsts: true,
            hstsIncludeSubDomains: false,
            algorithm:
                'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA256:!aNULL:!eNULL:!EXPORT:!DSS:!DES:!RC4:!3DES:!MD5:!PSK:!KRB5:!SRP:!CAMELLIA:!SEED',
            SSLProtocol: ['TLSv1.3', 'TLSv1.2'],
            httpsPort: '443',
            http3: false,
        });
        const loading = ref(false);
        const websiteSSL = ref();
        const rules = ref({
            type: [Rules.requiredSelect],
            privateKey: [Rules.requiredInput],
            certificate: [Rules.requiredInput],
            privateKeyPath: [Rules.requiredInput],
            certificatePath: [Rules.requiredInput],
            websiteSSLId: [Rules.requiredSelect],
            httpConfig: [Rules.requiredSelect],
            SSLProtocol: [Rules.requiredSelect],
            algorithm: [Rules.requiredInput],
            acmeAccountID: [Rules.requiredInput],
        });
        const resData = ref();
        const handleSSLChange = (ssl: Website.SSL) => {
            websiteSSL.value = ssl;
        };
        const saveHttps = () => {
            return rpc.website.updateHTTPS({
                websiteId: id.value,
                enable: form.enable,
                websiteSslId: form.websiteSSLId,
                type: form.type,
                privateKey: form.privateKey,
                certificate: form.certificate,
                httpConfig: form.httpConfig,
                sslProtocol: form.SSLProtocol,
                algorithm: form.algorithm,
                hsts: form.hsts,
                hstsIncludeSubDomains: form.hstsIncludeSubDomains,
                http3: form.http3,
            });
        };
        const get = () => {
            rpc.website.getHTTPS({ id: id.value }).then((res) => {
                if (res) {
                    form.type = 'existed';
                    const ssl = {
                        id: res.ssl?.id ?? 0,
                        primaryDomain: res.ssl?.primaryDomain ?? '',
                        domains: res.ssl?.domains ?? '',
                        organization: res.ssl?.organization ?? '',
                        provider: res.ssl?.provider ?? '',
                        expireDate: res.ssl?.expireDate ?? '',
                        description: res.ssl?.description ?? '',
                        acmeAccountId: res.ssl?.acmeAccountId ?? 0,
                        acmeAccount: { email: res.ssl?.acmeAccountEmail ?? '' },
                    };
                    const data = {
                        enable: res.enable,
                        httpConfig: res.httpConfig,
                        SSL: ssl,
                        SSLProtocol: res.sslProtocol,
                        algorithm: res.algorithm,
                        hsts: res.hsts,
                        hstsIncludeSubDomains: res.hstsIncludeSubDomains,
                        httpsPort: res.httpsPort,
                        http3: res.http3,
                    };
                    resData.value = data;
                    form.enable = data.enable;
                    if (data.httpConfig != '') {
                        form.httpConfig = data.httpConfig;
                    }
                    if (data.SSLProtocol && data.SSLProtocol.length > 0) {
                        form.SSLProtocol = data.SSLProtocol;
                    }
                    if (data.algorithm != '') {
                        form.algorithm = data.algorithm;
                    }
                    if (data.SSL && data.SSL.id > 0) {
                        form.websiteSSLId = data.SSL.id;
                        websiteSSL.value = data.SSL;
                        form.acmeAccountID = data.SSL.acmeAccountId;
                    }
                    form.hsts = data.hsts;
                    form.hstsIncludeSubDomains = data.hstsIncludeSubDomains || false;
                    form.http3 = data.http3;
                    form.httpsPort = data.httpsPort;
                }
            });
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;
                form.websiteId = id.value;
                saveHttps()
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        get();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const changeEnable = (enable: boolean) => {
            if (enable) {
                form.hsts = true;
            } else {
                form.hstsIncludeSubDomains = false;
            }
            if (resData.value.enable && !enable) {
                ElMessageBox.confirm(
                    i18n.global.t('website.disableHTTPSHelper'),
                    i18n.global.t('website.disableHTTPS'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        type: 'error',
                        closeOnClickModal: false,
                        beforeClose: async (action, instance, done) => {
                            if (action !== 'confirm') {
                                form.enable = true;
                                done();
                            } else {
                                instance.confirmButtonLoading = true;
                                form.enable = false;
                                form.websiteId = id.value;
                                saveHttps().then(() => {
                                    done();
                                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                                    get();
                                });
                            }
                        },
                    },
                ).then(() => {});
            }
        };
        onMounted(() => {
            get();
        });
        return () =>
            withDirectives(
                <ElRow gutter={20}>
                    <ElCol xs={24} sm={18} md={18} lg={14} xl={14}>
                        <ElAlert
                            closable={false}
                            v-slots={{
                                default: () => (
                                    <>
                                        <span class={'whitespace-pre-line'}>{$t('website.SSLHelper')}</span>
                                    </>
                                ),
                            }}
                        />
                        <ElForm
                            ref={httpsForm}
                            label-position="right"
                            label-width="150px"
                            model={form}
                            rules={unref(rules)}
                            class={'moblie-form'}
                        >
                            <ElFormItem prop="enable" label={$t('website.enableHTTPS')}>
                                {withDirectives(
                                    <ElSwitch
                                        modelValue={form.enable}
                                        onUpdate:modelValue={($v) => {
                                            form.enable = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            (changeEnable as any)($event);
                                        }}
                                    />,
                                    [[permissionDirective, true]],
                                )}
                            </ElFormItem>
                            <ElCollapseTransition>
                                {form.enable ? (
                                    <div>
                                        <ElFormItem label={'HTTPS ' + $t('commons.table.port')} prop="httpsPort">
                                            <ElText>{form.httpsPort}</ElText>
                                        </ElFormItem>
                                        <ElText type="warning" class={'!ml-2'}>
                                            {$t('website.ipWebsiteWarn')}
                                        </ElText>
                                        <ElDivider content-position="left">{$t('website.SSLConfig')}</ElDivider>
                                        <HttpsConfig
                                            modelValue={form}
                                            onUpdate:modelValue={($v) => {
                                                form = $v as any;
                                            }}
                                            website-ssl={unref(websiteSSL)}
                                            onSslChange={($event?: any) => {
                                                (handleSSLChange as any)($event);
                                            }}
                                        />
                                        <ElFormItem>
                                            {withDirectives(
                                                <ElButton
                                                    type="primary"
                                                    onClick={($event?: any) => {
                                                        submit(unref(httpsForm));
                                                    }}
                                                >
                                                    {$t('commons.button.save')}
                                                </ElButton>,
                                                [[permissionDirective, true]],
                                            )}
                                        </ElFormItem>
                                    </div>
                                ) : null}
                            </ElCollapseTransition>
                        </ElForm>
                    </ElCol>
                </ElRow>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
