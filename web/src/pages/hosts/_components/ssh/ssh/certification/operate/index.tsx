import { $t } from '@/utils/i18n-t';
interface RootCertInfo {
    id: number;
    createAt: Date;
    name: string;
    mode: string;
    encryptionMode: string;
    passPhrase: string;
    description: string;
    publicKey: string;
    privateKey: string;
}
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { Rules } from '@/global/form-rules';
import { getRandomStr } from '@/utils/id';
import { Base64 } from 'js-base64';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    title: string;
    rowData?: RootCertInfo;
}
type FormInstance = InstanceType<typeof ElForm>;
type KeyField = 'privateKey' | 'publicKey';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'operate',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const title = ref<string>('');
        const drawerVisible = ref(false);
        const dialogData = ref<DialogProps>({
            title: '',
        });
        const loading = ref();
        const formRef = ref();
        const uploadPrivateRef = ref();
        const uploadPublicRef = ref();
        const isGenerate = computed(
            () => dialogData.value.title === 'create' && dialogData.value.rowData?.mode === 'generate',
        );
        const keyReaders: Partial<Record<KeyField, FileReader>> = {};
        const cancelKeyRead = (field?: KeyField) => {
            const fields: KeyField[] = field ? [field] : ['privateKey', 'publicKey'];
            for (const key of fields) {
                const reader = keyReaders[key];
                delete keyReaders[key];
                reader?.abort();
            }
        };
        onBeforeUnmount(() => cancelKeyRead());
        const acceptParams = (params: DialogProps): void => {
            cancelKeyRead();
            dialogData.value = params;
            params.rowData.passPhrase ||= '';
            params.rowData.privateKey ||= '';
            params.rowData.publicKey ||= '';
            if (params.title === 'edit') {
                params.rowData.mode = 'input';
                dialogData.value.rowData.publicKey = Base64.decode(params.rowData.publicKey);
                dialogData.value.rowData.privateKey = Base64.decode(params.rowData.privateKey);
                if (params.rowData.passPhrase) {
                    dialogData.value.rowData.passPhrase = Base64.decode(params.rowData.passPhrase);
                    if (dialogData.value.rowData.passPhrase === '<UN-SET>') {
                        dialogData.value.rowData.passPhrase = '';
                    }
                }
            }
            if (!isGenerate.value) {
                dialogData.value.rowData.encryptionMode = '';
            }
            title.value = i18n.global.t('commons.button.' + dialogData.value.title);
            drawerVisible.value = true;
        };
        function checkPassword(rule: any, value: any, callback: any) {
            if (isGenerate.value && value) {
                const reg = /^[A-Za-z0-9]{6,15}$/;
                if (!reg.test(value)) {
                    return callback(new Error(i18n.global.t('ssh.passwordHelper')));
                }
            }
            callback();
        }
        const checkKey = (rule: { field: string }, value: string, callback: (error?: Error) => void) => {
            if (isGenerate.value) {
                return callback();
            }
            const content = value?.trim();
            if (!content) {
                return callback(new Error(i18n.global.t('commons.rule.requiredInput')));
            }
            const pattern =
                rule.field === 'publicKey'
                    ? /^(?:ssh-(?:rsa|ed25519|dss)|ecdsa-sha2-nistp(?:256|384|521))[ \t]+[A-Za-z0-9+/]+={0,2}(?:[ \t]+[^\r\n]*)?$/
                    : /^-----BEGIN ((?:OPENSSH |RSA |EC |DSA |ENCRYPTED )?PRIVATE KEY)-----\r?\n(?:Proc-Type: 4,ENCRYPTED\r?\nDEK-Info: [^\r\n]+\r?\n\r?\n)?[A-Za-z0-9+/][A-Za-z0-9+/=\r\n]*\r?\n-----END \1-----$/;
            if (!pattern.test(content)) {
                return callback(new Error(i18n.global.t('commons.rule.formatErr')));
            }
            callback();
        };
        const onModeChange = () => {
            cancelKeyRead();
            dialogData.value.rowData.encryptionMode = isGenerate.value ? 'ed25519' : '';
            dialogData.value.rowData.passPhrase = '';
            dialogData.value.rowData.privateKey = '';
            dialogData.value.rowData.publicKey = '';
            uploadPrivateRef.value?.clearFiles();
            uploadPublicRef.value?.clearFiles();
            formRef.value?.clearValidate();
        };
        const rules = reactive({
            name: Rules.simpleName,
            encryptionMode: Rules.requiredSelect,
            passPhrase: [{ validator: checkPassword, trigger: 'blur' }],
            privateKey: [{ required: true, validator: checkKey, trigger: ['blur', 'change'] }],
            publicKey: [{ required: true, validator: checkKey, trigger: ['blur', 'change'] }],
        });
        const onConfirm = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                const request = {
                    ...dialogData.value.rowData,
                    encryptionMode: isGenerate.value ? dialogData.value.rowData.encryptionMode : '',
                };
                if (dialogData.value.title === 'create') {
                    await rpc.ssh
                        .createCert(request)
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            handleClose();
                            ctx.emit('search');
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                } else {
                    await rpc.ssh
                        .updateCert(request)
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            handleClose();
                            ctx.emit('search');
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                }
            });
        };
        const onKeyRemove = (field: KeyField) => {
            cancelKeyRead(field);
            dialogData.value.rowData[field] = '';
            formRef.value?.validateField(field).catch(() => {});
        };
        const onKeyChange = (field: KeyField, uploadFile: UploadFile) => {
            const rowData = dialogData.value.rowData;
            if (!drawerVisible.value || rowData.mode !== 'import') return;
            cancelKeyRead(field);
            rowData[field] = '';
            const reader = new FileReader();
            keyReaders[field] = reader;
            reader.onload = (e) => {
                if (keyReaders[field] !== reader || dialogData.value.rowData !== rowData) return;
                delete keyReaders[field];
                rowData[field] = e.target.result as string;
                formRef.value?.validateField(field).catch(() => {});
            };
            reader.onerror = () => {
                if (keyReaders[field] !== reader || dialogData.value.rowData !== rowData) return;
                delete keyReaders[field];
                MsgError(i18n.global.t('commons.msg.errImport'));
            };
            reader.readAsText(uploadFile.raw);
        };
        const privateExceed: UploadProps['onExceed'] = (files) => {
            onKeyRemove('privateKey');
            uploadPrivateRef.value!.clearFiles();
            const file = files[0] as UploadRawFile;
            file.uid = genFileId();
            uploadPrivateRef.value!.handleStart(file);
        };
        const publicExceed: UploadProps['onExceed'] = (files) => {
            onKeyRemove('publicKey');
            uploadPublicRef.value!.clearFiles();
            const file = files[0] as UploadRawFile;
            file.uid = genFileId();
            uploadPublicRef.value!.handleStart(file);
        };
        const random = async () => {
            dialogData.value.rowData.passPhrase = getRandomStr(10);
        };
        const handleClose = () => {
            cancelKeyRead();
            drawerVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DialogPro
                v-model={drawerVisible.value}
                header={unref(title)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                resource={unref(dialogData).title !== 'edit' ? '' : unref(dialogData).rowData?.name}
                size="large"
                autoClose={false}
                fullScreen={true}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        onConfirm(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        rules={rules}
                        model={unref(dialogData).rowData}
                        v-loading={unref(loading)}
                    >
                        <ElRow gutter={20}>
                            <ElCol span={12}>
                                <ElFormItem label={$t('commons.table.name')} prop="name">
                                    <ElInput v-model={unref(dialogData).rowData.name} />
                                </ElFormItem>
                            </ElCol>
                        </ElRow>
                        {unref(dialogData).title === 'create' ? (
                            <ElFormItem label={$t('ssh.createMode')} prop="mode">
                                <ElRadioGroup
                                    v-model={unref(dialogData).rowData.mode}
                                    onChange={($event?: any) => {
                                        (onModeChange as any)($event);
                                    }}
                                >
                                    <ElRadio value="generate">{$t('ssh.generate')}</ElRadio>
                                    <ElRadio value="input">{$t('ssh.input')}</ElRadio>
                                    <ElRadio value="import">{$t('ssh.import')}</ElRadio>
                                </ElRadioGroup>
                            </ElFormItem>
                        ) : null}
                        <ElRow gutter={20}>
                            {unref(isGenerate) ? (
                                <ElCol span={12}>
                                    <ElFormItem label={$t('ssh.encryptionMode')} prop="encryptionMode">
                                        <ElSelect v-model={unref(dialogData).rowData.encryptionMode}>
                                            <ElOption label="ED25519" value="ed25519" />
                                            <ElOption label="ECDSA" value="ecdsa" />
                                            <ElOption label="RSA" value="rsa" />
                                            <ElOption label="DSA" value="dsa" />
                                        </ElSelect>
                                    </ElFormItem>
                                </ElCol>
                            ) : null}
                            <ElCol span={12}>
                                <ElFormItem
                                    label={$t(unref(isGenerate) ? 'ssh.password' : 'ssh.existingPassPhrase')}
                                    prop="passPhrase"
                                >
                                    <ElInput
                                        v-model={unref(dialogData).rowData.passPhrase}
                                        type="password"
                                        show-password
                                        v-slots={{
                                            append: () => (
                                                <>
                                                    <ElButton
                                                        onClick={($event?: any) => {
                                                            (random as any)($event);
                                                        }}
                                                    >
                                                        {$t('commons.button.random')}
                                                    </ElButton>
                                                </>
                                            ),
                                        }}
                                    />
                                    {!unref(isGenerate) ? (
                                        <span class={'input-help'}>{$t('ssh.existingPassPhraseHelper')}</span>
                                    ) : null}
                                </ElFormItem>
                            </ElCol>
                        </ElRow>
                        {!unref(isGenerate) ? (
                            <div>
                                <ElRow gutter={20}>
                                    <ElCol span={12}>
                                        <ElFormItem label={$t('ssh.privateKey')} prop="privateKey">
                                            {unref(dialogData).rowData.mode === 'input' ? (
                                                <ElInput
                                                    type="textarea"
                                                    rows={4}
                                                    v-model={unref(dialogData).rowData.privateKey}
                                                />
                                            ) : (
                                                <ElUpload
                                                    action="#"
                                                    auto-upload={false}
                                                    ref={uploadPrivateRef}
                                                    limit={1}
                                                    on-change={(file) => onKeyChange('privateKey', file)}
                                                    on-exceed={privateExceed}
                                                    on-remove={() => onKeyRemove('privateKey')}
                                                    class={'upload mt-2 w-full'}
                                                >
                                                    <ElButton size="small" icon="Upload">
                                                        {$t('commons.button.upload')}
                                                    </ElButton>
                                                </ElUpload>
                                            )}
                                        </ElFormItem>
                                    </ElCol>
                                    <ElCol span={12}>
                                        <ElFormItem label={$t('ssh.publicKey')} prop="publicKey">
                                            {unref(dialogData).rowData.mode === 'input' ? (
                                                <ElInput
                                                    type="textarea"
                                                    rows={4}
                                                    v-model={unref(dialogData).rowData.publicKey}
                                                />
                                            ) : (
                                                <ElUpload
                                                    action="#"
                                                    auto-upload={false}
                                                    ref={uploadPublicRef}
                                                    limit={1}
                                                    on-change={(file) => onKeyChange('publicKey', file)}
                                                    on-exceed={publicExceed}
                                                    on-remove={() => onKeyRemove('publicKey')}
                                                    class={'upload mt-2 w-full'}
                                                >
                                                    <ElButton size="small" icon="Upload">
                                                        {$t('commons.button.upload')}
                                                    </ElButton>
                                                </ElUpload>
                                            )}
                                        </ElFormItem>
                                    </ElCol>
                                </ElRow>
                            </div>
                        ) : null}
                        <ElFormItem label={$t('commons.table.description')} prop="description">
                            <ElInput v-model={unref(dialogData).rowData.description} />
                        </ElFormItem>
                    </ElForm>
                }
            </DialogPro>
        );
    },
    options,
);
