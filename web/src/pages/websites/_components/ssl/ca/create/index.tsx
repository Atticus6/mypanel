import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import { KeyTypes } from '@/global/mimetype';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'create',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const loading = ref(false);
        const caForm = ref<FormInstance>();
        const rules = ref({
            keyType: [Rules.requiredSelect],
            name: [Rules.requiredInput, Rules.name],
            country: [Rules.requiredSelect],
            organization: [Rules.requiredInput, Rules.name],
            commonName: [Rules.requiredInput, Rules.name],
        });
        const initData = () => ({
            name: '',
            keyType: 'EC256',
            commonName: '',
            country: 'CN',
            organization: '',
            organizationUint: '',
            province: '',
            city: '',
        });
        const ca = ref(initData());
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
            resetForm();
        };
        const resetForm = () => {
            caForm.value?.resetFields();
            ca.value = initData();
        };
        const acceptParams = () => {
            open.value = true;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;

                rpc.ssl
                    .createCA(ca.value as any)
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                        handleClose();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                size="large"
                header={$t('commons.button.create')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
                                <ElButton
                                    onClick={($event?: any) => {
                                        (handleClose as any)($event);
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.cancel')}
                                </ElButton>
                                {
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit(unref(caForm));
                                        }}
                                        disabled={unref(loading)}
                                        v-permission={true}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                }
                            </span>
                        </>
                    ),
                }}
            >
                {
                    <ElForm
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        ref={caForm}
                        label-position="top"
                        model={unref(ca)}
                        rules={unref(rules)}
                        v-loading={unref(loading)}
                    >
                        <ElFormItem label={$t('ssl.caName')} prop="name">
                            <ElInput
                                modelValue={unref(ca).name}
                                onUpdate:modelValue={($v) => {
                                    unref(ca).name = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('ssl.commonName')} prop="commonName">
                            <ElInput
                                modelValue={unref(ca).commonName}
                                onUpdate:modelValue={($v) => {
                                    unref(ca).commonName = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('ssl.company')} prop="organization">
                            <ElInput
                                modelValue={unref(ca).organization}
                                onUpdate:modelValue={($v) => {
                                    unref(ca).organization = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('ssl.department')} prop="organizationUint">
                            <ElInput
                                modelValue={unref(ca).organizationUint}
                                onUpdate:modelValue={($v) => {
                                    unref(ca).organizationUint = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('ssl.country')} prop="country">
                            <ElInput
                                modelValue={unref(ca).country}
                                onUpdate:modelValue={($v) => {
                                    unref(ca).country = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('ssl.province')} prop="province">
                            <ElInput
                                modelValue={unref(ca).province}
                                onUpdate:modelValue={($v) => {
                                    unref(ca).province = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('ssl.city')} prop="city">
                            <ElInput
                                modelValue={unref(ca).city}
                                onUpdate:modelValue={($v) => {
                                    unref(ca).city = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('website.keyType')} prop="keyType">
                            <ElSelect v-model={unref(ca).keyType}>
                                {(KeyTypes || []).map((keyType, index) => (
                                    <ElOption label={keyType.label} value={keyType.value} key={index} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                    </ElForm>
                }
            </DrawerPro>
        );
    },
    options,
);
