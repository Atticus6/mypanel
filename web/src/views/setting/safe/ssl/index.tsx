import { $t } from '@/utils/i18n-t';
import { Website } from '@/types/website';
import { dateFormatSimple } from '@/utils/date';
import { getProvider } from '@/utils/ssl';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import { Setting } from '@/types/setting';
import { useGlobalStore } from '@/composables/useGlobalStore';
interface DialogProps {
    ssl: string;
    sslType: string;
    sslInfo?: Setting.SSLInfo;
}
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';
import FileList from '@/components/file-list/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'ssl',
    props: {},
    emits: emits,
    __scopeId: 'data-v-65c66b0c',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { entrance, isLogin } = useGlobalStore();
        const loading = ref();
        const drawerVisible = ref();
        const keyFileRef = ref();
        const certFileRef = ref();
        const form = reactive({
            ssl: 'Enable',
            domain: '',
            sslType: 'self',
            itemSSLType: 'paste',
            sslID: null as number,
            cert: '',
            key: '',
            rootPath: '',
            timeout: '',
        });
        const rules = reactive({
            cert: [Rules.requiredInput],
            key: [Rules.requiredInput],
            sslID: [Rules.requiredSelect],
        });
        const formRef = ref<FormInstance>();
        const sslList = ref();
        const itemSSL = ref();
        const acceptParams = async (params: DialogProps): Promise<void> => {
            form.ssl = params.ssl === 'Disable' ? 'Enable' : params.ssl;
            if (params.sslType.indexOf('-') !== -1) {
                form.sslType = 'import';
                form.itemSSLType = params.sslType.split('-')[1];
            } else {
                form.sslType = params.sslType;
            }
            form.cert = params.sslInfo?.cert || '';
            form.key = params.sslInfo?.key || '';
            form.rootPath = params.sslInfo?.rootPath || '';
            form.domain = params.sslInfo?.domain || '';
            form.timeout = params.sslInfo?.timeout || '';

            if (params.sslInfo?.sslID) {
                form.sslID = params.sslInfo.sslID;
                const ssls = await rpc.ssl.list({});
                sslList.value = ssls.items || [];
                changeSSl(params.sslInfo?.sslID);
            } else {
                loadSSLs();
            }
            drawerVisible.value = true;
        };
        const loadSSLs = async () => {
            const res = await rpc.ssl.list({});
            sslList.value = res.items || [];
        };
        const changeSSl = (sslid: number) => {
            const res = sslList.value.filter((element: Website.SSL) => {
                return element.id == sslid;
            });
            itemSSL.value = res[0];
        };
        const getKeyPath = (path: string) => {
            form.key = path;
        };
        const getCertPath = (path: string) => {
            form.cert = path;
        };
        const onDownload = async () => {
            await rpc.core.setting.downloadSSL({}).then(async (file) => {
                const bytes = Uint8Array.from(atob(file.contentBase64), (ch) => ch.charCodeAt(0));
                const downloadUrl = window.URL.createObjectURL(new Blob([bytes]));
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = downloadUrl;
                a.download = 'server.crt';
                const event = new MouseEvent('click');
                a.dispatchEvent(event);
            });
        };
        const onSaveSSL = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                ElMessageBox.confirm(i18n.global.t('setting.sslChangeHelper'), 'https', {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                }).then(async () => {
                    let itemType = form.sslType;
                    if (form.sslType === 'import') {
                        itemType = form.itemSSLType === 'paste' ? 'import-paste' : 'import-local';
                    }
                    let param = {
                        ssl: form.ssl,
                        sslType: itemType,
                        domain: '',
                        sslID: form.sslID,
                        cert: form.cert,
                        key: form.key,
                    };
                    // window.location.hostname yields the bare host name and strips
                    // surrounding brackets from IPv6 addresses (e.g. '[::1]' -> '::1'),
                    // unlike `href.split('//')[1].split(':')[0]` which incorrectly
                    // returns '[' for IPv6 URLs. See 1Panel-dev/1Panel#12646.
                    param.domain = window.location.hostname;
                    await rpc.core.setting.updateSSL(param).then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        let href = window.location.href;
                        isLogin.value = false;
                        let address = href.split('://')[1];
                        if (entrance.value) {
                            address = address.replaceAll('settings/safe', entrance.value);
                        } else {
                            address = address.replaceAll('settings/safe', '');
                        }
                        setTimeout(() => {
                            window.open(`https://${address}`, '_self');
                        }, 1000);
                    });
                });
            });
        };
        const handleClose = () => {
            ctx.emit('search');
            drawerVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(drawerVisible)}
                    onUpdate:modelValue={($v) => {
                        drawerVisible.value = $v as any;
                    }}
                    header={$t('setting.panelSSL')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        drawerVisible.value = false;
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        onSaveSSL(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm ref={formRef} label-position="top" model={form} rules={rules}>
                            <ElFormItem label={$t('setting.mode')} prop="ssl">
                                <ElRadioGroup
                                    modelValue={form.ssl}
                                    onUpdate:modelValue={($v) => {
                                        form.ssl = $v as any;
                                    }}
                                >
                                    <ElRadioButton value="Enable">{'Strict'}</ElRadioButton>
                                    <ElRadioButton value="Mux">{'Mux'}</ElRadioButton>
                                </ElRadioGroup>
                                {form.ssl === 'Enable' ? (
                                    <span class={'input-help'}>{$t('setting.strictHelper')}</span>
                                ) : null}
                                {form.ssl === 'Mux' ? (
                                    <span class={'input-help'}>{$t('setting.muxHelper')}</span>
                                ) : null}
                            </ElFormItem>
                            <ElFormItem label={$t('setting.certType')}>
                                <ElRadioGroup
                                    modelValue={form.sslType}
                                    onUpdate:modelValue={($v) => {
                                        form.sslType = $v as any;
                                    }}
                                >
                                    <ElRadio value="self">{$t('setting.selfSigned')}</ElRadio>
                                    <ElRadio value="select">{$t('setting.select')}</ElRadio>
                                    <ElRadio value="import">{$t('commons.button.import')}</ElRadio>
                                </ElRadioGroup>
                                {form.sslType === 'self' ? (
                                    <span class={'input-help'}>{$t('setting.selfSignedHelper')}</span>
                                ) : null}
                            </ElFormItem>
                            {form.sslType === 'import' ? (
                                <ElFormItem label={$t('commons.button.import')} prop="type">
                                    <ElSelect
                                        modelValue={form.itemSSLType}
                                        onUpdate:modelValue={($v) => {
                                            form.itemSSLType = $v as any;
                                        }}
                                    >
                                        <ElOption label={$t('website.pasteSSL')} value="paste" />
                                        <ElOption label={$t('website.localSSL')} value="local" />
                                    </ElSelect>
                                </ElFormItem>
                            ) : null}
                            {form.timeout ? (
                                <ElFormItem>
                                    <ElTag>
                                        {$t('setting.domainOrIP')}
                                        {form.domain}
                                    </ElTag>
                                    <ElTag class={'p-ml-5'}>
                                        {$t('setting.timeOut')}
                                        {form.timeout}
                                    </ElTag>
                                    {form.sslType === 'self' ? (
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (onDownload as any)($event);
                                            }}
                                            type="primary"
                                            link
                                            icon="Download"
                                            class={'p-ml-5'}
                                        >
                                            {$t('setting.rootCrtDownload')}
                                        </ElButton>
                                    ) : null}
                                </ElFormItem>
                            ) : null}
                            {form.sslType === 'import' && form.itemSSLType === 'paste' ? (
                                <div>
                                    <ElFormItem label={$t('website.privateKey')} prop="key">
                                        <ElInput
                                            modelValue={form.key}
                                            onUpdate:modelValue={($v) => {
                                                form.key = $v as any;
                                            }}
                                            rows={5}
                                            type="textarea"
                                        />
                                    </ElFormItem>
                                    <ElFormItem label={$t('website.certificate')} prop="cert" class={'marginTop'}>
                                        <ElInput
                                            modelValue={form.cert}
                                            onUpdate:modelValue={($v) => {
                                                form.cert = $v as any;
                                            }}
                                            rows={5}
                                            type="textarea"
                                        />
                                    </ElFormItem>
                                </div>
                            ) : null}
                            {form.sslType === 'import' && form.itemSSLType === 'local' ? (
                                <div>
                                    <ElFormItem label={$t('website.privateKey')} prop="key">
                                        <ElInput
                                            modelValue={form.key}
                                            onUpdate:modelValue={($v) => {
                                                form.key = $v as any;
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
                                    <ElFormItem label={$t('website.certificate')} prop="cert" class={'marginTop'}>
                                        <ElInput
                                            modelValue={form.cert}
                                            onUpdate:modelValue={($v) => {
                                                form.cert = $v as any;
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
                            {form.sslType === 'select' ? (
                                <div>
                                    <ElFormItem label={$t('setting.certificate')} prop="sslID">
                                        <ElSelect
                                            modelValue={form.sslID}
                                            onUpdate:modelValue={($v) => {
                                                form.sslID = $v as any;
                                            }}
                                            onChange={($event?: any) => {
                                                changeSSl(form.sslID);
                                            }}
                                        >
                                            {(unref(sslList) || []).map((item, index) => (
                                                <ElOption label={item.primaryDomain} value={item.id} key={index} />
                                            ))}
                                        </ElSelect>
                                    </ElFormItem>
                                    {form.sslID > 0 && unref(itemSSL) ? (
                                        <ElDescriptions column={5} border direction="vertical" class={'marginTop'}>
                                            <ElDescriptionsItem label={$t('website.primaryDomain')}>
                                                {unref(itemSSL).primaryDomain}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('website.otherDomains')}>
                                                {unref(itemSSL).domains}
                                            </ElDescriptionsItem>
                                            <ElDescriptionsItem label={$t('ssl.provider')}>
                                                {getProvider(unref(itemSSL).provider)}
                                            </ElDescriptionsItem>
                                            {unref(itemSSL).acmeAccount?.email &&
                                            unref(itemSSL).provider !== 'manual' ? (
                                                <ElDescriptionsItem label={$t('ssl.acmeAccount')}>
                                                    {unref(itemSSL).acmeAccount.email}
                                                </ElDescriptionsItem>
                                            ) : null}
                                            <ElDescriptionsItem label={$t('website.expireDate')}>
                                                {dateFormatSimple(unref(itemSSL).expireDate)}
                                            </ElDescriptionsItem>
                                        </ElDescriptions>
                                    ) : null}
                                </div>
                            ) : null}
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </DrawerPro>
                <FileList
                    ref={keyFileRef}
                    onChoose={($event?: any) => {
                        (getKeyPath as any)($event);
                    }}
                />
                <FileList
                    ref={certFileRef}
                    onChoose={($event?: any) => {
                        (getCertPath as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
