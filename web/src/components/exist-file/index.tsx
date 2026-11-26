import { $t } from '@/utils/i18n-t';
import { computeSize } from '@/utils/size';
interface DialogProps {
    name: string;
    path: string;
    size: number;
    uploadSize: number;
    modTime: string;
}
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'exist-file',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const dialogVisible = ref();
        const existFiles = ref<DialogProps[]>([]);
        let onConfirmCallback = null;
        const getFileSize = (size: number) => {
            return computeSize(size);
        };
        const handleSkip = () => {
            dialogVisible.value = false;
            if (onConfirmCallback) {
                onConfirmCallback(
                    'skip',
                    existFiles.value.map((file) => file.path),
                );
            }
        };
        const handleOverwrite = () => {
            dialogVisible.value = false;
            if (onConfirmCallback) {
                onConfirmCallback('overwrite');
            }
        };
        const acceptParams = async ({ paths, onConfirm }): Promise<void> => {
            existFiles.value = paths;
            onConfirmCallback = onConfirm;
            dialogVisible.value = true;
        };
        ctx.expose({ acceptParams });
        return () => (
            <div>
                <DialogPro
                    modelValue={unref(dialogVisible)}
                    onUpdate:modelValue={($v) => {
                        dialogVisible.value = $v as any;
                    }}
                    title={$t('file.existFileTitle')}
                    size="normal"
                    v-slots={{
                        footer: () => (
                            <>
                                <span class={'dialog-footer'}>
                                    <ElButton
                                        onClick={($event?: any) => {
                                            (handleSkip as any)($event);
                                        }}
                                    >
                                        {$t('commons.button.skip')}
                                    </ElButton>
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            handleOverwrite();
                                        }}
                                    >
                                        {$t('commons.button.cover')}
                                    </ElButton>
                                </span>
                            </>
                        ),
                    }}
                >
                    <ElAlert show-icon={true} type="warning" closable={false}>
                        <div class={'whitespace-break-spaces'}>
                            <span>{$t('file.existFileHelper')}</span>
                        </div>
                    </ElAlert>
                    <div>
                        <ElTable data={unref(existFiles)} max-height="350">
                            <ElTableColumn type="index" label={$t('commons.table.serialNumber')} width="55" />
                            <ElTableColumn prop="path" label={$t('commons.table.name')} min-width={200} />
                            <ElTableColumn
                                label={$t('file.existFileSize')}
                                width="230"
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            {getFileSize(row.uploadSize)}
                                            {' -> '}
                                            {getFileSize(row.size)}
                                        </>
                                    ),
                                }}
                            />
                        </ElTable>
                    </div>
                </DialogPro>
            </div>
        );
    },
    options,
);
