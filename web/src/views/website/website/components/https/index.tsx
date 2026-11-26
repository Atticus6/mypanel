import { $t } from '@/utils/i18n-t';
import { computed, watch, onMounted, ref } from 'vue';
import { getAccountName } from '@/utils/ssl';
import { dateFormatSimple } from '@/utils/date';
import WebsiteSSL from '@/views/website/website/components/website-ssl/index';
import { Website } from '@/types/website';
import { rpc } from '@/lib/rpc';
type SSLItem = Website.SSL & { organization?: string };
interface AcmeAccount {
    id: number;
    email: string;
    type: string;
}
interface Props {
    modelValue: {
        httpsPort: string;
        httpConfig: string;
        hsts: boolean;
        hstsIncludeSubDomains: boolean;
        http3: boolean;
        type: string;
        acmeAccountID: number;
        websiteSSLId?: number;
        importType: string;
        privateKey: string;
        certificate: string;
        privateKeyPath: string;
        certificatePath: string;
        SSLProtocol: string[];
        algorithm: string;
    };
    websiteSSL?: Website.SSL;
    autoLoad?: boolean;
}
interface Emits {
    (e: 'update:modelValue', value: Props['modelValue']): void;
    (e: 'type-change', type: string): void;
    (e: 'ssl-change', ssl: Website.SSL): void;
    (e: 'select-key-file'): void;
    (e: 'select-cert-file'): void;
}
import './index.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElFormItem } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElDivider } from 'element-plus';
import { ElCheckboxGroup } from 'element-plus';
import FileList from '@/components/file-list/index';

interface CodemodProps {
    [key: string]: any;
    modelValue?: {
        httpsPort: string;
        httpConfig: string;
        hsts: boolean;
        hstsIncludeSubDomains: boolean;
        http3: boolean;
        type: string;
        acmeAccountID: number;
        websiteSSLId?: number;
        importType: string;
        privateKey: string;
        certificate: string;
        privateKeyPath: string;
        certificatePath: string;
        SSLProtocol: string[];
        algorithm: string;
    };
    websiteSSL?: Website.SSL;
    autoLoad?: boolean;
}

const emits = {};

type SlotsShape = {
    'ssl-info': (arg?: unknown) => VNode[];
};

const options = {
    name: 'https',
    props: {
        modelValue: Object,
        websiteSSL: { type: null },
        autoLoad: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    slots: {} as SlotsType<SlotsShape>,
    __scopeId: 'data-v-a076f622',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, SlotsType<SlotsShape>>(
    (__panelSetupProps, ctx) => {
        const acmeAccounts = ref<AcmeAccount[]>([]);
        const ssls = ref<SSLItem[]>([]);
        const keyFileRef = ref();
        const certFileRef = ref();
        const formData = computed({
            get: () => __panelSetupProps.modelValue,
            set: (value) => ctx.emit('update:modelValue', value),
        });
        const listAcmeAccount = async () => {
            try {
                const res = await rpc.ssl.searchACMEAccounts({ page: 1, pageSize: 100 });
                acmeAccounts.value = (res.items || []) as any;
            } catch (error) {
                console.error('Failed to load ACME accounts:', error);
            }
        };
        const listSSLs = async () => {
            try {
                const res = await rpc.ssl.list({
                    acmeAccountId: String(formData.value.acmeAccountID),
                });
                ssls.value = (res.items || []) as any;

                if (ssls.value.length > 0) {
                    let exist = false;
                    for (const ssl of ssls.value) {
                        if (ssl.id === formData.value.websiteSSLId) {
                            exist = true;
                            break;
                        }
                    }

                    if (!exist) {
                        for (const ssl of ssls.value) {
                            if (ssl.pem !== '') {
                                formData.value.websiteSSLId = ssl.id;
                                handleSSLChange(ssl.id);
                                break;
                            }
                        }
                    } else {
                        handleSSLChange(formData.value.websiteSSLId);
                    }
                } else {
                    formData.value.websiteSSLId = undefined;
                }
            } catch (error) {
                console.error('Failed to load SSL certificates:', error);
            }
        };
        const handleTypeChange = (type: string) => {
            if (type !== 'existed') {
                formData.value.websiteSSLId = undefined;
            }
            ctx.emit('type-change', type);
        };
        const handleAcmeAccountChange = () => {
            listSSLs();
        };
        const handleSSLChange = (sslId: number) => {
            const selectedSSL = ssls.value.find((ssl: Website.SSL) => ssl.id === sslId);
            if (selectedSSL && selectedSSL.pem !== '') {
                ctx.emit('ssl-change', selectedSSL);
            }
        };
        watch(
            () => formData.value.acmeAccountID,
            () => {
                listSSLs();
            },
        );
        const refresh = () => {
            listAcmeAccount();
            listSSLs();
        };
        const getPrivateKeyPath = (path: string) => {
            formData.value.privateKeyPath = path;
        };
        const getCertificatePath = (path: string) => {
            formData.value.certificatePath = path;
        };
        onMounted(() => {
            if (__panelSetupProps.autoLoad) {
                listAcmeAccount();
                listSSLs();
            }
        });
        ctx.expose({
            refresh,
            listSSLs,
            listAcmeAccount,
        });
        return () => (
            <div>
                <ElFormItem label={$t('website.HTTPConfig')} prop="httpConfig">
                    <ElSelect
                        modelValue={unref(formData).httpConfig}
                        onUpdate:modelValue={($v) => {
                            unref(formData).httpConfig = $v as any;
                        }}
                        class={'p-w-400'}
                    >
                        <ElOption label={$t('website.HTTPToHTTPS')} value="HTTPToHTTPS" />
                        <ElOption label={$t('website.HTTPAlso')} value="HTTPAlso" />
                        <ElOption label={$t('website.HTTPSOnly')} value="HTTPSOnly" />
                    </ElSelect>
                </ElFormItem>
                <ElFormItem label="HSTS" prop="hsts">
                    <ElCheckbox
                        modelValue={unref(formData).hsts}
                        onUpdate:modelValue={($v) => {
                            unref(formData).hsts = $v as any;
                        }}
                    >
                        {$t('commons.button.enable')}
                    </ElCheckbox>
                    <span class={'input-help'}>{$t('website.hstsHelper')}</span>
                </ElFormItem>
                {unref(formData).hsts ? (
                    <ElFormItem label={'HSTS ' + $t('website.includeSubDomains')} prop="hstsIncludeSubDomains">
                        <ElCheckbox
                            modelValue={unref(formData).hstsIncludeSubDomains}
                            onUpdate:modelValue={($v) => {
                                unref(formData).hstsIncludeSubDomains = $v as any;
                            }}
                        >
                            {$t('commons.button.enable')}
                        </ElCheckbox>
                        <span class={'input-help'}>{$t('website.hstsIncludeSubDomainsHelper')}</span>
                    </ElFormItem>
                ) : null}
                <ElFormItem label="HTTP3" prop="http3">
                    <ElCheckbox
                        modelValue={unref(formData).http3}
                        onUpdate:modelValue={($v) => {
                            unref(formData).http3 = $v as any;
                        }}
                    >
                        {$t('commons.button.enable')}
                    </ElCheckbox>
                    <span class={'input-help'}>{$t('website.http3Helper')}</span>
                </ElFormItem>
                <ElFormItem label={$t('website.sslConfig')} prop="type">
                    <ElSelect
                        modelValue={unref(formData).type}
                        onUpdate:modelValue={($v) => {
                            unref(formData).type = $v as any;
                        }}
                        onChange={($event?: any) => {
                            (handleTypeChange as any)($event);
                        }}
                        class={'p-w-400'}
                    >
                        <ElOption label={$t('website.oldSSL')} value="existed" />
                        <ElOption label={$t('website.manualSSL')} value="manual" />
                    </ElSelect>
                </ElFormItem>
                {unref(formData).type === 'existed' ? (
                    <div>
                        <ElFormItem label={$t('website.acmeAccountManage')} prop="acmeAccountID">
                            <ElSelect
                                modelValue={unref(formData).acmeAccountID}
                                onUpdate:modelValue={($v) => {
                                    unref(formData).acmeAccountID = $v as any;
                                }}
                                placeholder={$t('website.selectAcme')}
                                onChange={($event?: any) => {
                                    (handleAcmeAccountChange as any)($event);
                                }}
                                class={'p-w-400'}
                            >
                                <ElOption label={$t('website.imported')} value={0} key={0} />
                                {(unref(acmeAccounts) || []).map((acme, index) => (
                                    <ElOption label={acme.email} value={acme.id} key={index}>
                                        <span>
                                            {acme.email}
                                            <ElTag class={'ml-5'}>{getAccountName(acme.type)}</ElTag>
                                        </span>
                                    </ElOption>
                                ))}
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('website.ssl')} prop="websiteSSLId" hide-required-asterisk={true}>
                            <ElSelect
                                modelValue={unref(formData).websiteSSLId}
                                onUpdate:modelValue={($v) => {
                                    unref(formData).websiteSSLId = $v as any;
                                }}
                                placeholder={$t('website.selectSSL')}
                                onChange={($event?: any) => {
                                    (handleSSLChange as any)($event);
                                }}
                                class={'p-w-400'}
                            >
                                {(unref(ssls) || []).map((ssl, index) => (
                                    <ElOption
                                        label={ssl.primaryDomain}
                                        value={ssl.id}
                                        disabled={ssl.pem === ''}
                                        key={index}
                                    >
                                        <span>{ssl.primaryDomain}</span>
                                        {ssl.expireDate ? (
                                            <ElTag class={'tagClass'}>{dateFormatSimple(ssl.expireDate)}</ElTag>
                                        ) : null}
                                        {ssl.organization ? <ElTag class={'tagClass'}>{ssl.organization}</ElTag> : null}
                                    </ElOption>
                                ))}
                            </ElSelect>
                        </ElFormItem>
                    </div>
                ) : null}
                {unref(formData).type === 'manual' ? (
                    <div>
                        <ElFormItem label={$t('website.importType')} prop="importType">
                            <ElSelect
                                modelValue={unref(formData).importType}
                                onUpdate:modelValue={($v) => {
                                    unref(formData).importType = $v as any;
                                }}
                            >
                                <ElOption label={$t('website.pasteSSL')} value="paste" />
                                <ElOption label={$t('website.localSSL')} value="local" />
                            </ElSelect>
                        </ElFormItem>
                        {unref(formData).importType === 'paste' ? (
                            <div>
                                <ElFormItem label={$t('website.privateKey')} prop="privateKey">
                                    <ElInput
                                        modelValue={unref(formData).privateKey}
                                        onUpdate:modelValue={($v) => {
                                            unref(formData).privateKey = $v as any;
                                        }}
                                        rows={6}
                                        type="textarea"
                                    />
                                </ElFormItem>
                                <ElFormItem label={$t('website.certificate')} prop="certificate">
                                    <ElInput
                                        modelValue={unref(formData).certificate}
                                        onUpdate:modelValue={($v) => {
                                            unref(formData).certificate = $v as any;
                                        }}
                                        rows={6}
                                        type="textarea"
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(formData).importType === 'local' ? (
                            <div>
                                <ElFormItem label={$t('website.privateKeyPath')} prop="privateKeyPath">
                                    <ElInput
                                        modelValue={unref(formData).privateKeyPath}
                                        onUpdate:modelValue={($v) => {
                                            unref(formData).privateKeyPath = $v as any;
                                        }}
                                        v-slots={{
                                            prepend: () => (
                                                <>
                                                    <ElButton
                                                        icon="Folder"
                                                        onClick={($event?: any) => {
                                                            unref(keyFileRef).acceptParams({ dir: false });
                                                        }}
                                                    />
                                                </>
                                            ),
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label={$t('website.certificatePath')} prop="certificatePath">
                                    <ElInput
                                        modelValue={unref(formData).certificatePath}
                                        onUpdate:modelValue={($v) => {
                                            unref(formData).certificatePath = $v as any;
                                        }}
                                        v-slots={{
                                            prepend: () => (
                                                <>
                                                    <ElButton
                                                        icon="Folder"
                                                        onClick={($event?: any) => {
                                                            unref(certFileRef).acceptParams({ dir: false });
                                                        }}
                                                    />
                                                </>
                                            ),
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                    </div>
                ) : null}
                {__panelSetupProps.websiteSSL && __panelSetupProps.websiteSSL.id > 0 ? (
                    <ElFormItem label={' '}>
                        {ctx.slots['ssl-info']?.({ websiteSSL: __panelSetupProps.websiteSSL }) ?? (
                            <>
                                <WebsiteSSL websiteSSL={__panelSetupProps.websiteSSL} />
                            </>
                        )}
                    </ElFormItem>
                ) : null}
                <ElDivider content-position="left">{$t('website.SSLProConfig')}</ElDivider>
                <ElFormItem label={$t('website.supportProtocol')} prop="SSLProtocol">
                    <ElCheckboxGroup
                        modelValue={unref(formData).SSLProtocol}
                        onUpdate:modelValue={($v) => {
                            unref(formData).SSLProtocol = $v as any;
                        }}
                    >
                        <ElCheckbox value="TLSv1.3">{'TLS 1.3'}</ElCheckbox>
                        <ElCheckbox value="TLSv1.2">{'TLS 1.2'}</ElCheckbox>
                        <ElCheckbox value="TLSv1.1">{'TLS 1.1' + $t('website.notSecurity')}</ElCheckbox>
                        <ElCheckbox value="TLSv1">{'TLS 1.0' + $t('website.notSecurity')}</ElCheckbox>
                    </ElCheckboxGroup>
                </ElFormItem>
                <ElFormItem prop="algorithm" label={$t('website.encryptionAlgorithm')}>
                    <ElInput
                        type="textarea"
                        rows={3}
                        modelValue={unref(formData).algorithm}
                        onUpdate:modelValue={($v) => {
                            unref(formData).algorithm = typeof $v === 'string' ? $v.trim() : $v;
                        }}
                    />
                </ElFormItem>
                <FileList
                    ref={keyFileRef}
                    onChoose={($event?: any) => {
                        (getPrivateKeyPath as any)($event);
                    }}
                />
                <FileList
                    ref={certFileRef}
                    onChoose={($event?: any) => {
                        (getCertificatePath as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
