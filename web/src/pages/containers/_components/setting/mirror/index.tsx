import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import ConfirmDialog from '@/components/confirm-dialog/index';
import { emptyLineFilter } from '@/utils/validate';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    mirrors: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'mirror',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const confirmDialogRef = ref();
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            mirrors: '',
        });
        const formRef = ref<FormInstance>();
        const rules = reactive({
            mirrors: [{ validator: checkMirrors, trigger: 'blur' }],
        });
        function checkMirrors(rule: any, value: any, callback: any) {
            if (form.mirrors !== '') {
                const reg = /^https?:\/\/[a-zA-Z0-9.-]+(:[0-9]{1,5})?(\/[a-zA-Z0-9./-]*)?$/;
                let mirrors = form.mirrors.split('\n');
                for (const item of mirrors) {
                    if (item === '') {
                        continue;
                    }
                    if (!reg.test(item)) {
                        return callback(new Error(i18n.global.t('commons.rule.mirror')));
                    }
                }
            }
            callback();
        }
        const acceptParams = (params: DialogProps): void => {
            form.mirrors = params.mirrors || params.mirrors.replaceAll(',', '\n');
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
        const onSubmit = async () => {
            loading.value = true;
            await rpc.container
                .updateDaemonJson({
                    key: 'Mirrors',
                    value: emptyLineFilter(form.mirrors, '\n').replaceAll('\n', ','),
                })
                .then(() => {
                    loading.value = false;
                    ctx.emit('search');
                    handleClose();
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(() => {
                    loading.value = false;
                });
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <div>
                <DrawerPro
                    v-model={drawerVisible.value}
                    header={$t('container.mirrors')}
                    onClose={($event?: any) => {
                        (handleClose as any)($event);
                    }}
                    size="small"
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
                                        onSave(unref(formRef));
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {
                        <ElForm
                            ref={formRef}
                            label-position="top"
                            model={form}
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                            rules={rules}
                            v-loading={unref(loading)}
                        >
                            <ElFormItem label={$t('container.mirrors')} prop="mirrors">
                                <ElInput
                                    type="textarea"
                                    placeholder={$t('container.mirrorHelper')}
                                    rows={5}
                                    v-model={form.mirrors}
                                />
                            </ElFormItem>
                        </ElForm>
                    }
                </DrawerPro>
                <ConfirmDialog
                    ref={confirmDialogRef}
                    onConfirm={($event?: any) => {
                        (onSubmit as any)($event);
                    }}
                />
            </div>
        );
    },
    options,
);
