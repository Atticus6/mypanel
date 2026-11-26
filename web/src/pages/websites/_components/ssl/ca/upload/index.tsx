import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import FileList from '@/components/file-list/index';
import { uploadCA } from '@/api/modules/website';
import { rpc } from '@/lib/rpc';
import { MsgError, MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import permissionDirective from '@/directives/modules/permission';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    uploaded: (...args: unknown[]) => true,
};

const options = {
    name: 'upload',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const loading = ref(false);
        const formRef = ref<FormInstance>();
        const uploadRef = ref<UploadInstance>();
        const certFileRef = ref();
        const keyFileRef = ref();
        const initialForm = () => ({
            name: '',
            type: 'upload',
            certificate: '',
            privateKey: '',
            certificatePath: '',
            privateKeyPath: '',
            file: undefined as UploadRawFile | undefined,
        });
        const form = reactive(initialForm());
        const rules = {
            name: [Rules.requiredInput, Rules.name],
            type: [Rules.requiredSelect],
            file: [Rules.requiredSelect],
            certificate: [Rules.requiredInput],
            privateKey: [Rules.requiredInput],
            certificatePath: [Rules.requiredInput],
            privateKeyPath: [Rules.requiredInput],
        };
        const changeType = async () => {
            form.file = undefined;
            uploadRef.value?.clearFiles();
            await nextTick();
            formRef.value?.clearValidate();
        };
        const onRemove = () => {
            form.file = undefined;
        };
        const onChange = (file: UploadFile) => {
            if (!file.raw || !file.name.toLowerCase().endsWith('.zip') || file.raw.size > 10 * 1024 * 1024) {
                uploadRef.value?.clearFiles();
                form.file = undefined;
                MsgError(i18n.global.t('ssl.caUploadHelp'));
                return;
            }
            form.file = file.raw;
            formRef.value?.clearValidate('file');
        };
        const handleClose = () => {
            open.value = false;
        };
        const acceptParams = async () => {
            Object.assign(form, initialForm());
            open.value = true;
            await nextTick();
            uploadRef.value?.clearFiles();
            formRef.value?.clearValidate();
        };
        const submit = async () => {
            if (loading.value) return;
            loading.value = true;
            try {
                if (!(await formRef.value?.validate().catch(() => false))) return;
                if (form.type === 'upload') {
                    if (!form.file) return;
                    const data = new FormData();
                    data.append('file', form.file);
                    await uploadCA(data);
                } else {
                    await rpc.ssl.importCA(
                        form.type === 'paste'
                            ? {
                                  type: 'paste',
                                  name: form.name,
                                  certificate: form.certificate,
                                  privateKey: form.privateKey,
                              }
                            : {
                                  type: 'local',
                                  name: form.name,
                                  certificatePath: form.certificatePath,
                                  privateKeyPath: form.privateKeyPath,
                              },
                    );
                }
                MsgSuccess(i18n.global.t('commons.msg.uploadSuccess'));
                handleClose();
                ctx.emit('uploaded');
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({ acceptParams });
        return () => (
            <>
                <DrawerPro
                    modelValue={unref(open)}
                    onUpdate:modelValue={($v) => {
                        open.value = $v as any;
                    }}
                    size="large"
                    header={$t('commons.button.upload')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    disabled={unref(loading)}
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        loading={unref(loading)}
                                        onClick={($event?: any) => {
                                            (submit as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </>
                        ),
                    }}
                >
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        model={form}
                        rules={rules}
                        disabled={unref(loading)}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElFormItem label={$t('website.importType')} prop="type">
                            <ElSelect
                                modelValue={form.type}
                                onUpdate:modelValue={($v) => {
                                    form.type = $v as any;
                                }}
                                disabled={unref(loading)}
                                onChange={($event?: any) => {
                                    (changeType as any)($event);
                                }}
                            >
                                <ElOption label={$t('website.pasteSSL')} value={'paste'} />
                                <ElOption label={$t('website.localSSL')} value={'local'} />
                                <ElOption label={$t('commons.button.upload') + ' ZIP'} value={'upload'} />
                            </ElSelect>
                        </ElFormItem>
                        {form.type !== 'upload' ? (
                            <ElFormItem label={$t('commons.table.name')} prop="name">
                                <ElInput
                                    modelValue={form.name}
                                    onUpdate:modelValue={($v) => {
                                        form.name = typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                    maxlength={128}
                                />
                            </ElFormItem>
                        ) : null}
                        {form.type === 'paste' ? (
                            <div>
                                <ElFormItem label={$t('website.certificate')} prop="certificate">
                                    <ElInput
                                        modelValue={form.certificate}
                                        onUpdate:modelValue={($v) => {
                                            form.certificate = $v as any;
                                        }}
                                        rows={6}
                                        type="textarea"
                                    />
                                </ElFormItem>
                                <ElFormItem label={$t('website.privateKey')} prop="privateKey">
                                    <ElInput
                                        modelValue={form.privateKey}
                                        onUpdate:modelValue={($v) => {
                                            form.privateKey = $v as any;
                                        }}
                                        rows={6}
                                        type="textarea"
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {form.type === 'local' ? (
                            <div>
                                <ElFormItem label={$t('website.certificatePath')} prop="certificatePath">
                                    <ElInput
                                        modelValue={form.certificatePath}
                                        onUpdate:modelValue={($v) => {
                                            form.certificatePath = $v as any;
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
                                <ElFormItem label={$t('website.privateKeyPath')} prop="privateKeyPath">
                                    <ElInput
                                        modelValue={form.privateKeyPath}
                                        onUpdate:modelValue={($v) => {
                                            form.privateKeyPath = $v as any;
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
                            </div>
                        ) : null}
                        {form.type === 'upload' ? (
                            <ElFormItem label={$t('file.file')} prop="file">
                                <ElUpload
                                    ref={uploadRef}
                                    accept=".zip"
                                    auto-upload={false}
                                    limit={1}
                                    disabled={unref(loading)}
                                    on-change={onChange}
                                    on-remove={onRemove}
                                    v-slots={{
                                        tip: () => (
                                            <>
                                                <div class={'el-upload__tip'}>{$t('ssl.caUploadHelp')}</div>
                                            </>
                                        ),
                                    }}
                                >
                                    <ElButton type="primary" icon="Upload" disabled={unref(loading)}>
                                        {$t('file.selectFile')}
                                    </ElButton>
                                </ElUpload>
                            </ElFormItem>
                        ) : null}
                    </ElForm>
                </DrawerPro>
                <FileList
                    ref={certFileRef}
                    onChoose={($event?: any) => {
                        form.certificatePath = $event;
                    }}
                />
                <FileList
                    ref={keyFileRef}
                    onChoose={($event?: any) => {
                        form.privateKeyPath = $event;
                    }}
                />
            </>
        );
    },
    options,
);
