import { $t } from '@/utils/i18n-t';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { Rules, checkNumberRange } from '@/global/form-rules';
import i18n from '@/lang';
interface DialogProps {
    expirationDays: number;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'expiration',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref();
        const loading = ref();
        const timeoutFormRef = ref();
        const form = reactive({
            days: 0,
        });
        const acceptParams = (params: DialogProps): void => {
            form.days = params.expirationDays;
            drawerVisible.value = true;
        };
        const submitTimeout = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                await rpc.core.setting
                    .updateSetting({ key: 'ExpirationDays', value: form.days + '' })
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                        ctx.emit('search');
                        drawerVisible.value = false;
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
                header={$t('setting.expirationTime')}
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
                                    submitTimeout(unref(timeoutFormRef));
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
                        ref={timeoutFormRef}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        label-position="top"
                        model={form}
                    >
                        <ElFormItem
                            label={$t('setting.days')}
                            prop="days"
                            rules={[Rules.integerNumberWith0, checkNumberRange(0, 60)]}
                        >
                            <ElInput
                                clearable
                                modelValue={form.days}
                                onUpdate:modelValue={($v) => {
                                    form.days = $v === '' ? $v : Number($v);
                                }}
                            />
                            <span class={'input-help'}>{$t('setting.expirationHelper')}</span>
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
