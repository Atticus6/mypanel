import { $t } from '@/utils/i18n-t';
import HttpsConfig from '@/views/website/website/components/https/index';
import { Website } from '@/types/website';
import { rpc } from '@/lib/rpc';
import { FormInstance } from 'element-plus';
import { Rules } from '@/global/form-rules';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElForm } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    openTask: (...args: unknown[]) => true,
};

const options = {
    name: 'https',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const loading = ref(false);
        const websiteForm = ref<FormInstance>();
        const websiteSSL = ref();
        const form = ref({
            ids: [] as number[],
            acmeAccountID: 0,
            enable: false,
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
            taskID: '',
        });
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
        const handleClose = () => {
            open.value = false;
        };
        const acceptParams = async (ids: [], taskID: string) => {
            form.value.ids = ids;
            form.value.taskID = taskID;
            open.value = true;
        };
        const handleSSLChange = (ssl: Website.SSL) => {
            websiteSSL.value = ssl;
        };
        const submit = async () => {
            loading.value = true;
            const valid = await websiteForm.value.validate();
            if (!valid) {
                loading.value = false;
                return;
            }
            rpc.website
                .batchSetHttps({
                    ids: form.value.ids as number[],
                    taskId: form.value.taskID,
                    websiteSslId: form.value.websiteSSLId ?? 0,
                    type: form.value.type,
                    privateKey: form.value.privateKey,
                    certificate: form.value.certificate,
                    privateKeyPath: form.value.privateKeyPath,
                    certificatePath: form.value.certificatePath,
                    importType: form.value.importType,
                    httpConfig: form.value.httpConfig,
                    sslProtocol: form.value.SSLProtocol ?? [],
                    algorithm: form.value.algorithm,
                    hsts: form.value.hsts,
                    hstsIncludeSubDomains: form.value.hstsIncludeSubDomains,
                    httpsPorts: [Number(form.value.httpsPort) || 443],
                    http3: form.value.http3,
                })
                .then(() => {
                    open.value = false;
                    ctx.emit('openTask', form.value.taskID);
                })
                .finally(() => {
                    loading.value = false;
                });
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
                header={$t('commons.button.set') + $t('website.ssl')}
                size="50%"
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
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
                            {withDirectives(
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit();
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>,
                                [[permissionDirective, true]],
                            )}
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm ref={websiteForm} label-position="top" model={unref(form)} rules={unref(rules)}>
                        <HttpsConfig
                            modelValue={unref(form)}
                            onUpdate:modelValue={($v) => {
                                form.value = $v as any;
                            }}
                            website-ssl={unref(websiteSSL)}
                            onSslChange={($event?: any) => {
                                (handleSSLChange as any)($event);
                            }}
                        />
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
