import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { checkDomain, checkIpV4V6 } from '@/utils/validate';
interface DialogProps {
    systemIP: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'systemip',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            systemIP: '',
        });
        const formRef = ref<FormInstance>();
        const rules = reactive({
            systemIP: [{ validator: checkSystemIP, trigger: 'blur' }],
        });
        function checkSystemIP(rule: any, value: any, callback: any) {
            if (form.systemIP !== '') {
                if (checkIpV4V6(form.systemIP) && checkDomain(form.systemIP)) {
                    return callback(new Error(i18n.global.t('commons.rule.host')));
                }
            }
            callback();
        }
        const acceptParams = (params: DialogProps): void => {
            form.systemIP = params.systemIP;
            drawerVisible.value = true;
        };
        const onSaveSystemIP = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                await rpc.agentSetting
                    .updateSetting({ key: 'SystemIP', value: form.systemIP })
                    .then(async () => {
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        loading.value = false;
                        drawerVisible.value = false;
                        ctx.emit('search');
                        return;
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('setting.systemIP')}
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
                                    onSaveSystemIP(unref(formRef));
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
                        <ElFormItem label={$t('setting.systemIP')} prop="systemIP">
                            <ElInput
                                clearable
                                modelValue={form.systemIP}
                                onUpdate:modelValue={($v) => {
                                    form.systemIP = $v as any;
                                }}
                            />
                            <span class={'input-help'}>{$t('commons.rule.hostHelper')}</span>
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
