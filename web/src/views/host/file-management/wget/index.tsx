import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { FormInstance, FormRules } from 'element-plus';
import { reactive, ref } from 'vue';
import FileList from '@/components/file-list/index';
import { MsgSuccess } from '@/utils/message';
import { getFilenameFromUrl } from '@/utils/file';
interface WgetProps {
    path: string;
    isAppendOnly?: boolean;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElCheckbox } from 'element-plus';
import { ElAlert } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'wget',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const fileForm = ref<FormInstance>();
        const loading = ref(false);
        const preferenceLoading = ref(false);
        const preferenceSaving = ref(false);
        const preferenceReady = ref(false);
        let preferenceToken = 0;
        let savedServerFilename = false;
        const isAppendOnly = ref(false);
        let open = ref(false);
        let submitData = ref(false);
        const fileRef = ref();
        const validateWgetUrl = (_rule: unknown, value: string, callback: (e?: Error) => void) => {
            const v = (value || '').trim();
            if (!v) {
                callback();
                return;
            }
            try {
                const u = new URL(v);
                if (u.protocol !== 'http:' && u.protocol !== 'https:') {
                    callback(new Error(i18n.global.t('file.wgetUrlInvalid')));
                    return;
                }
                callback();
            } catch {
                callback(new Error(i18n.global.t('file.wgetUrlInvalid')));
            }
        };
        const rules = reactive<FormRules>({
            name: [Rules.requiredInput],
            path: [Rules.requiredInput],
            url: [Rules.requiredInput, { validator: validateWgetUrl, trigger: 'blur' }],
        });
        const addForm = reactive({
            url: '',
            path: '',
            name: '',
            ignoreCertificate: false,
            useProxy: false,
            useServerFilename: false,
        });
        const handleClose = () => {
            preferenceToken++;
            if (fileForm.value) {
                fileForm.value.resetFields();
            }
            open.value = false;
            ctx.emit('close', submitData.value);
        };
        const getPath = (path: string) => {
            addForm.path = path;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl || preferenceLoading.value || preferenceSaving.value || loading.value) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;
                rpc.file
                    .wget({ ...addForm })
                    .then(() => {
                        MsgSuccess(i18n.global.t('file.downloadStart'));
                        submitData.value = true;
                        handleClose();
                    })
                    .catch(() => {
                        submitData.value = false;
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const getFileName = (url: string) => {
            addForm.name = getFilenameFromUrl(url);
        };
        const saveServerFilenamePreference = async () => {
            if (!preferenceReady.value || preferenceSaving.value) return;
            const token = preferenceToken;
            const value = addForm.useServerFilename;
            preferenceSaving.value = true;
            try {
                await rpc.core.setting.updateFileDownloadPreference({ useServerFilename: value });
                if (token === preferenceToken) savedServerFilename = value;
            } catch {
                if (token === preferenceToken) addForm.useServerFilename = savedServerFilename;
            } finally {
                if (token === preferenceToken) preferenceSaving.value = false;
            }
        };
        const acceptParams = async (__panelSetupProps: WgetProps) => {
            const token = ++preferenceToken;
            addForm.path = __panelSetupProps.path;
            isAppendOnly.value = Boolean(__panelSetupProps.isAppendOnly);
            open.value = true;
            submitData.value = false;
            addForm.ignoreCertificate = false;
            addForm.useProxy = false;
            addForm.useServerFilename = false;
            savedServerFilename = false;
            preferenceReady.value = false;
            preferenceSaving.value = false;
            preferenceLoading.value = true;
            try {
                const result = await rpc.core.setting.getFileDownloadPreference({});
                if (token !== preferenceToken || !open.value) return;
                savedServerFilename = result.useServerFilename === true;
                addForm.useServerFilename = savedServerFilename;
                preferenceReady.value = true;
            } catch {
                // Older Core versions can still use the existing manual-name download flow.
            } finally {
                if (token === preferenceToken) preferenceLoading.value = false;
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
                    header={$t('commons.button.download')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="large"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            handleClose();
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.cancel')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit(unref(fileForm));
                                        }}
                                        disabled={unref(loading) || unref(preferenceLoading) || unref(preferenceSaving)}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm ref={fileForm} label-position="top" model={addForm} label-width="100px" rules={rules}>
                            <ElFormItem label={$t('file.downloadUrl')} prop="url">
                                <ElInput
                                    modelValue={addForm.url}
                                    onUpdate:modelValue={($v) => {
                                        addForm.url = $v as any;
                                    }}
                                    onInput={($event?: any) => {
                                        (getFileName as any)($event);
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('file.path')} prop="path">
                                <ElInput
                                    modelValue={addForm.path}
                                    onUpdate:modelValue={($v) => {
                                        addForm.path = $v as any;
                                    }}
                                    v-slots={{
                                        prepend: () => (
                                            <>
                                                <ElButton
                                                    icon="Folder"
                                                    onClick={($event?: any) => {
                                                        unref(fileRef).acceptParams({ path: addForm.path });
                                                    }}
                                                />
                                            </>
                                        ),
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem label={$t('commons.table.name')} prop="name">
                                <ElInput
                                    modelValue={addForm.name}
                                    onUpdate:modelValue={($v) => {
                                        addForm.name = $v as any;
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem>
                                <ElCheckbox
                                    modelValue={addForm.useServerFilename}
                                    onUpdate:modelValue={($v) => {
                                        addForm.useServerFilename = $v as any;
                                    }}
                                    disabled={
                                        !unref(preferenceReady) ||
                                        unref(preferenceLoading) ||
                                        unref(preferenceSaving) ||
                                        unref(loading)
                                    }
                                    onChange={($event?: any) => {
                                        (saveServerFilenamePreference as any)($event);
                                    }}
                                    class={'!h-auto [&_.el-checkbox__label]:whitespace-normal'}
                                >
                                    {$t('file.useServerFilename')}
                                </ElCheckbox>
                            </ElFormItem>
                            <ElFormItem>
                                <ElCheckbox
                                    modelValue={addForm.useProxy}
                                    onUpdate:modelValue={($v) => {
                                        addForm.useProxy = $v as any;
                                    }}
                                >
                                    {$t('file.useProxy')}
                                </ElCheckbox>
                                <span class={'input-help'}>{$t('file.useProxyHelper')}</span>
                            </ElFormItem>
                            <ElFormItem>
                                <ElCheckbox
                                    modelValue={addForm.ignoreCertificate}
                                    onUpdate:modelValue={($v) => {
                                        addForm.ignoreCertificate = $v as any;
                                    }}
                                >
                                    {$t('file.ignoreCertificate')}
                                </ElCheckbox>
                                <span class={'input-help'}>{$t('file.ignoreCertificateHelper')}</span>
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                    {unref(isAppendOnly) ? (
                        <ElAlert
                            type="warning"
                            title={$t('xpack.tamper.tamperCreateHint')}
                            closable={false}
                            class={'mt-4'}
                        />
                    ) : null}
                </DrawerPro>
                <FileList
                    ref={fileRef}
                    onChoose={($event?: any) => {
                        (getPath as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
