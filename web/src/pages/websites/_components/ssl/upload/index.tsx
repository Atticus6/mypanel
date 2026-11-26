import { $t } from '@/utils/i18n-t';
import { uploadSSL, uploadSSLFile } from '@/api/modules/website';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import FileList from '@/components/file-list/index';
import { MsgSuccess } from '@/utils/message';
import { Website } from '@/types/website';
import { useGlobalStore } from '@/composables/useGlobalStore';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'upload',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isMaster, isXpackOrEE } = useGlobalStore();
        const PushToNode = defineAsyncComponent(async () => {
            const modules = import.meta.glob('@/xpack/views/ssl/index.vue');
            const loader = modules['/src/xpack/views/ssl/index.vue'];
            if (loader) {
                return ((await loader()) as any).default;
            }
            return { template: '<div></div>' };
        });
        const open = ref(false);
        const keyFileRef = ref();
        const certFileRef = ref();
        const loading = ref(false);
        const sslForm = ref<FormInstance>();
        const privateKeyFileList = ref([]);
        const certificateFileList = ref([]);
        const privateKeyUpload = ref();
        const certificateUpload = ref();
        const rules = ref({
            privateKey: [Rules.requiredInput],
            certificate: [Rules.requiredInput],
            privateKeyPath: [Rules.requiredInput],
            certificatePath: [Rules.requiredInput],
            type: [Rules.requiredSelect],
            certificateFile: [Rules.requiredInput],
            privateKeyFile: [Rules.requiredInput],
            pushNodes: [Rules.requiredSelect],
        });
        const initData = () => ({
            privateKey: '',
            certificate: '',
            privateKeyPath: '',
            certificatePath: '',
            type: 'paste',
            sslID: 0,
            description: '',
            pushNode: false,
            pushNodes: [] as string[],
            nodes: '',
            privateKeyFile: null as File | null,
            certificateFile: null as File | null,
        });
        const ssl = ref(initData());
        const handleClose = () => {
            resetForm();
            open.value = false;
            ctx.emit('close', false);
        };
        const resetForm = () => {
            sslForm.value?.resetFields();
            ssl.value = initData();
            privateKeyFileList.value = [];
            certificateFileList.value = [];
        };
        const handlePrivateKeyChange = (file: any) => {
            ssl.value.privateKeyFile = file.raw;
            privateKeyFileList.value = [file];
        };
        const handleCertificateChange = (file: any) => {
            ssl.value.certificateFile = file.raw;
            certificateFileList.value = [file];
        };
        const acceptParams = (websiteSSL?: Website.SSLDTO) => {
            resetForm();
            if (websiteSSL && websiteSSL.id > 0) {
                ssl.value.sslID = websiteSSL.id;
                ssl.value.description = websiteSSL.description;
                ssl.value.privateKeyPath = websiteSSL.privateKeyPath;
                ssl.value.certificatePath = websiteSSL.certPath;
                ssl.value.pushNode = websiteSSL.pushNode;
                ssl.value.pushNodes = websiteSSL.nodes
                    ? websiteSSL.nodes
                          .split(',')
                          .map((item) => item.trim())
                          .filter((item) => item !== '')
                    : [];
                if (ssl.value.certificatePath != '' && ssl.value.privateKeyPath != '') {
                    ssl.value.type = 'local';
                }
            }
            open.value = true;
        };
        const getPrivateKeyPath = (path: string) => {
            ssl.value.privateKeyPath = path;
        };
        const getCertificatePath = (path: string) => {
            ssl.value.certificatePath = path;
        };
        const submit = async () => {
            try {
                await sslForm.value?.validate();
                loading.value = true;
                ssl.value.nodes = ssl.value.pushNode ? ssl.value.pushNodes.join(',') : '';
                if (ssl.value.type === 'upload') {
                    const formData = new FormData();
                    formData.append('type', ssl.value.type);
                    formData.append('description', ssl.value.description);
                    formData.append('sslID', ssl.value.sslID.toString());
                    formData.append('pushNode', String(ssl.value.pushNode));
                    formData.append('nodes', ssl.value.nodes);

                    if (ssl.value.privateKeyFile) {
                        formData.append('privateKeyFile', ssl.value.privateKeyFile);
                    }
                    if (ssl.value.certificateFile) {
                        formData.append('certificateFile', ssl.value.certificateFile);
                    }
                    await uploadSSLFile(formData);
                } else {
                    await uploadSSL(ssl.value);
                }
                handleClose();
                MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
            } catch (err) {
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <>
                <DrawerPro
                    v-model={open.value}
                    header={$t('ssl.upload')}
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
                                    {
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                submit();
                                            }}
                                            disabled={unref(loading)}
                                            v-permission={'website_cert_manage'}
                                        >
                                            {$t('commons.button.confirm')}
                                        </ElButton>
                                    }
                                </span>
                            </>
                        ),
                    }}
                >
                    {
                        <ElForm
                            ref={sslForm}
                            label-position="top"
                            model={unref(ssl)}
                            label-width="100px"
                            rules={unref(rules)}
                            v-loading={unref(loading)}
                        >
                            <ElFormItem label={$t('website.importType')} prop="type">
                                <ElSelect v-model={unref(ssl).type}>
                                    <ElOption label={$t('website.pasteSSL')} value={'paste'} />
                                    <ElOption label={$t('website.localSSL')} value={'local'} />
                                    <ElOption label={$t('commons.button.upload') + $t('menu.files')} value={'upload'} />
                                </ElSelect>
                            </ElFormItem>
                            {unref(ssl).type === 'paste' ? (
                                <div>
                                    <ElFormItem label={$t('website.certificate')} prop="certificate">
                                        <ElInput v-model={unref(ssl).certificate} rows={6} type="textarea" />
                                    </ElFormItem>
                                    <ElFormItem label={$t('website.privateKey')} prop="privateKey">
                                        <ElInput v-model={unref(ssl).privateKey} rows={6} type="textarea" />
                                    </ElFormItem>
                                </div>
                            ) : null}
                            {unref(ssl).type === 'local' ? (
                                <div>
                                    <ElFormItem label={$t('website.certificatePath')} prop="certificatePath">
                                        <ElInput
                                            v-model={unref(ssl).certificatePath}
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
                                    <ElFormItem label={$t('website.privateKeyPath')} prop="privateKeyPath">
                                        <ElInput
                                            v-model={unref(ssl).privateKeyPath}
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
                                </div>
                            ) : null}
                            {unref(ssl).type === 'upload' ? (
                                <div>
                                    <ElFormItem label={$t('website.certificate')} prop="certificateFile">
                                        <ElUpload
                                            ref={certificateUpload}
                                            auto-upload={false}
                                            limit={1}
                                            on-change={handleCertificateChange}
                                            file-list={unref(certificateFileList)}
                                            class={'p-w-200'}
                                            v-slots={{
                                                trigger: () => (
                                                    <>
                                                        <ElButton type="primary" icon="Upload">
                                                            {$t('file.selectFile')}
                                                        </ElButton>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </ElFormItem>
                                    <ElFormItem label={$t('website.privateKey')} prop="privateKeyFile">
                                        <ElUpload
                                            ref={privateKeyUpload}
                                            auto-upload={false}
                                            limit={1}
                                            on-change={handlePrivateKeyChange}
                                            file-list={unref(privateKeyFileList)}
                                            class={'p-w-200'}
                                            v-slots={{
                                                trigger: () => (
                                                    <>
                                                        <ElButton type="primary" icon="Upload">
                                                            {$t('file.selectFile')}
                                                        </ElButton>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </ElFormItem>
                                </div>
                            ) : null}
                            <ElFormItem label={$t('website.remark')} prop="description">
                                <ElInput v-model={unref(ssl).description} />
                            </ElFormItem>
                            {unref(isMaster) && unref(isXpackOrEE) ? (
                                <PushToNode
                                    push-node={unref(ssl).pushNode}
                                    nodes={unref(ssl).pushNodes}
                                    type="ssl"
                                    onUpdate:push-node={($event?: any) => {
                                        unref(unref(ssl)).pushNode = $event;
                                    }}
                                    onUpdate:nodes={($event?: any) => {
                                        unref(unref(ssl)).pushNodes = $event;
                                    }}
                                />
                            ) : null}
                        </ElForm>
                    }
                </DrawerPro>
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
            </>
        );
    },
    options,
);
