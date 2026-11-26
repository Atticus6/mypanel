import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import { rpc } from '@/lib/rpc';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
interface DialogProps {
    noAuthSetting: string;
    noAuthOptions: [{ value: string; label: string }];
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'response',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref();
        const loading = ref();
        const formRef = ref<FormInstance>();
        const form = reactive({
            noAuthSetting: '',
        });
        const options = [
            {
                value: '200',
                label: '200 - ' + i18n.global.t('setting.help200'),
            },
            {
                value: '400',
                label: '400 - ' + i18n.global.t('setting.error400'),
            },
            {
                value: '401',
                label: '401 - ' + i18n.global.t('setting.error401'),
            },
            {
                value: '403',
                label: '403 - ' + i18n.global.t('setting.error403'),
            },
            {
                value: '404',
                label: '404 - ' + i18n.global.t('setting.error404'),
            },
            {
                value: '408',
                label: '408 - ' + i18n.global.t('setting.error408'),
            },
            {
                value: '416',
                label: '416 - ' + i18n.global.t('setting.error416'),
            },
            {
                value: '444',
                label: '444 - ' + i18n.global.t('setting.error444'),
            },
            {
                value: '500',
                label: '500 - ' + i18n.global.t('setting.error500'),
            },
        ];
        const acceptParams = (params: DialogProps): void => {
            form.noAuthSetting = params.noAuthSetting;
            drawerVisible.value = true;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate(async (valid) => {
                if (!valid) return;
                loading.value = true;
                await rpc.core.setting
                    .updateSetting({ key: 'NoAuthSetting', value: form.noAuthSetting })
                    .then(() => {
                        loading.value = false;
                        handleClose();
                        ctx.emit('search');
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
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
                header={$t('setting.noAuthSetting')}
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
                {withDirectives(
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        model={form}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElFormItem
                            label={$t('setting.responseSetting')}
                            prop="noAuthSetting"
                            rules={Rules.requiredSelect}
                        >
                            <ElSelect
                                modelValue={form.noAuthSetting}
                                onUpdate:modelValue={($v) => {
                                    form.noAuthSetting = $v as any;
                                }}
                            >
                                {(options || []).map((item) => (
                                    <ElOption label={item.label} value={item.value} key={item.value} />
                                ))}
                            </ElSelect>
                            <span class={'input-help'}>{$t('setting.noAuthSettingHelper')}</span>
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
