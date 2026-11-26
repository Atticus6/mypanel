import { $t } from '@/utils/i18n-t';
import { Rules, checkNumberRange } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    logMaxSize: string;
    logMaxFile: number;
}
import DrawerPro from '@/components/drawer-pro/index';
import ConfirmDialog from '@/components/confirm-dialog/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'log',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const drawerVisible = ref();
        const confirmDialogRef = ref();
        const formRef = ref();
        const form = reactive({
            logMaxSize: 10,
            logMaxFile: 3,
            sizeUnit: 'm',
        });
        const rules = reactive({
            logMaxSize: [checkNumberRange(1, 1024000), Rules.number],
            logMaxFile: [checkNumberRange(1, 100), Rules.number],
        });
        const acceptParams = (params: DialogProps): void => {
            form.logMaxFile = params.logMaxFile || 3;
            if (params.logMaxSize) {
                form.logMaxSize = loadSize(params.logMaxSize);
            } else {
                form.logMaxSize = 10;
                form.sizeUnit = 'm';
            }
            drawerVisible.value = true;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                let params = {
                    header: i18n.global.t('database.confChange'),
                    operationInfo: i18n.global.t('container.restartHelper'),
                    submitInputInfo: i18n.global.t('database.restartNow'),
                };
                confirmDialogRef.value!.acceptParams(params);
            });
        };
        const onSubmitSave = async () => {
            loading.value = true;
            await rpc.container
                .updateLogOption({
                    logMaxSize: form.logMaxSize + form.sizeUnit,
                    logMaxFile: form.logMaxFile + '',
                })
                .then(() => {
                    loading.value = false;
                    drawerVisible.value = false;
                    ctx.emit('search');
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const loadSize = (value: string) => {
            if (value.indexOf('k') !== -1 || value.indexOf('KB') !== -1) {
                form.sizeUnit = 'k';
                return Number(value.replaceAll('k', '').replaceAll('KB', ''));
            }
            if (value.indexOf('m') !== -1 || value.indexOf('MB') !== -1) {
                form.sizeUnit = 'm';
                return Number(value.replaceAll('m', '').replaceAll('MB', ''));
            }
            if (value.indexOf('g') !== -1 || value.indexOf('GB') !== -1) {
                form.sizeUnit = 'g';
                return Number(value.replaceAll('g', '').replaceAll('GB', ''));
            }
            if (value.indexOf('b') !== -1 || value.indexOf('B') !== -1) {
                form.sizeUnit = 'b';
                return Number(value.replaceAll('b', '').replaceAll('B', ''));
            }
        };
        const handleClose = () => {
            ctx.emit('search');
            drawerVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div>
                <DrawerPro
                    v-model={drawerVisible.value}
                    header={$t('container.cutLog')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="small"
                    v-slots={{
                        footer: () => (
                            <>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                <ElButton
                                    disabled={unref(loading)}
                                    type="primary"
                                    onClick={($event?: any) => {
                                        onSave(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    <ElAlert
                        closable={false}
                        type="warning"
                        class={'common-prompt'}
                        v-slots={{
                            default: () => (
                                <>
                                    <ul style={'margin-left: -20px'}>
                                        <li>{$t('container.cutLogHelper1')}</li>
                                        <li>{$t('container.cutLogHelper2')}</li>
                                        <li>{$t('container.cutLogHelper3')}</li>
                                    </ul>
                                </>
                            ),
                        }}
                    />
                    {
                        <ElForm
                            model={form}
                            ref={formRef}
                            rules={rules}
                            label-position="top"
                            v-loading={unref(loading)}
                        >
                            <ElFormItem prop="logMaxSize" label={$t('container.maxSize')}>
                                <ElInput
                                    modelValue={form.logMaxSize}
                                    onUpdate:modelValue={($v) => {
                                        form.logMaxSize = $v === '' ? $v : Number($v);
                                    }}
                                    v-slots={{
                                        append: () => (
                                            <>
                                                <ElSelect v-model={form.sizeUnit} style={'width: 70px'}>
                                                    <ElOption label="Byte" value="b" />
                                                    <ElOption label="KB" value="k" />
                                                    <ElOption label="MB" value="m" />
                                                    <ElOption label="GB" value="g" />
                                                </ElSelect>
                                            </>
                                        ),
                                    }}
                                />
                            </ElFormItem>
                            <ElFormItem prop="logMaxFile" label={$t('container.maxFile')}>
                                <ElInput
                                    modelValue={form.logMaxFile}
                                    onUpdate:modelValue={($v) => {
                                        form.logMaxFile = $v === '' ? $v : Number($v);
                                    }}
                                />
                            </ElFormItem>
                        </ElForm>
                    }
                </DrawerPro>
                <ConfirmDialog
                    ref={confirmDialogRef}
                    onConfirm={($event?: any) => {
                        (onSubmitSave as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
