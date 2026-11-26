import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import ConfirmDialog from '@/components/confirm-dialog/index';
import { FormInstance } from 'element-plus';
import { emptyLineFilter } from '@/utils/validate';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    registries: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'registry',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const confirmDialogRef = ref();
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            registries: '',
        });
        const formRef = ref<FormInstance>();
        const rules = reactive({
            registries: [{ validator: checkRegistries, trigger: 'blur' }],
        });
        function checkRegistries(rule: any, value: any, callback: any) {
            if (form.registries !== '') {
                const reg = /^[a-zA-Z0-9]{1}[a-z:A-Z0-9_/.-]{0,150}$/;
                let regis = form.registries.split('\n');
                for (const item of regis) {
                    if (item === '') {
                        continue;
                    }
                    if (!reg.test(item)) {
                        return callback(new Error(i18n.global.t('commons.rule.imageName')));
                    }
                }
            }
            callback();
        }
        const acceptParams = (params: DialogProps): void => {
            form.registries = params.registries || params.registries.replaceAll(',', '\n');
            drawerVisible.value = true;
        };
        const onSave = async () => {
            let params = {
                header: i18n.global.t('database.confChange'),
                operationInfo: i18n.global.t('container.restartHelper'),
                submitInputInfo: i18n.global.t('database.restartNow'),
            };
            confirmDialogRef.value!.acceptParams(params);
        };
        const onSubmit = async () => {
            loading.value = true;
            await rpc.container
                .updateDaemonJson({
                    key: 'Registries',
                    value: emptyLineFilter(form.registries, '\n').replaceAll('\n', ','),
                })
                .then(() => {
                    loading.value = false;
                    handleClose();
                    ctx.emit('search');
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
                    modelValue={unref(drawerVisible)}
                    onUpdate:modelValue={($v) => {
                        drawerVisible.value = $v as any;
                    }}
                    header={$t('container.registries')}
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
                                        (onSave as any)($event);
                                    }}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            </>
                        ),
                    }}
                >
                    {withDirectives(
                        <ElForm
                            ref={formRef}
                            label-position="top"
                            model={form}
                            rules={rules}
                            onSubmit={($event?: any) => {
                                $event.preventDefault();
                            }}
                        >
                            <ElFormItem label={$t('container.registries')} prop="registries">
                                <ElInput
                                    type="textarea"
                                    placeholder={$t('container.registrieHelper')}
                                    rows={5}
                                    modelValue={form.registries}
                                    onUpdate:modelValue={($v) => {
                                        form.registries = $v as any;
                                    }}
                                />
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
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
