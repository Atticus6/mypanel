import { $t } from '@/utils/i18n-t';
import { CompressExtension, CompressType } from '@/enums/files';
import { downloadFile } from '@/api/modules/files';
import { File } from '@/types/file';
import { Rules } from '@/global/form-rules';
interface DownloadProps {
    paths: Array<string>;
    name: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'download',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const rules = reactive<FormRules>({
            name: [Rules.requiredInput],
            type: [Rules.requiredInput],
        });
        const fileForm = ref<FormInstance>();
        const options = ref<string[]>([]);
        let loading = ref(false);
        let open = ref(false);
        const handleClose = () => {
            open.value = false;
            if (fileForm.value) {
                fileForm.value.resetFields();
            }
            ctx.emit('close', open.value);
        };
        let addForm = ref({
            paths: [] as string[],
            type: '',
            name: '',
            compress: true,
        });
        const extension = computed(() => {
            return CompressExtension[addForm.value.type];
        });
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                let addItem = {};
                Object.assign(addItem, addForm.value);
                addItem['name'] = addForm.value.name + extension.value;
                loading.value = true;
                downloadFile(addItem as File.FileDownload)
                    .then((res) => {
                        const downloadUrl = window.URL.createObjectURL(new Blob([res]));
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = downloadUrl;
                        a.download = addItem['name'];
                        const event = new MouseEvent('click');
                        a.dispatchEvent(event);
                        handleClose();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const acceptParams = (__panelSetupProps: DownloadProps) => {
            addForm.value.paths = __panelSetupProps.paths;
            addForm.value.name = __panelSetupProps.name;
            addForm.value.type = 'zip';
            addForm.value.compress = true;
            options.value = [];
            for (const t in CompressType) {
                options.value.push(CompressType[t]);
            }
            open.value = true;
        };
        ctx.expose({ acceptParams });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('commons.button.download')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="normal"
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
                                        submit(unref(fileForm));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm ref={fileForm} label-position="top" model={unref(addForm)} rules={rules}>
                        <ElFormItem label={$t('file.compressType')} prop="type">
                            <ElSelect
                                modelValue={unref(addForm).type}
                                onUpdate:modelValue={($v) => {
                                    unref(addForm).type = $v as any;
                                }}
                            >
                                {(unref(options) || []).map((item) => (
                                    <ElOption label={item} value={item} key={item} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.name')} prop="name">
                            <ElInput
                                modelValue={unref(addForm).name}
                                onUpdate:modelValue={($v) => {
                                    unref(addForm).name = $v as any;
                                }}
                                v-slots={{ append: () => <>{unref(extension)}</> }}
                            />
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
