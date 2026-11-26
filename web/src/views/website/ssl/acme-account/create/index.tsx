import { $t } from '@/utils/i18n-t';
import { FormInstance } from 'element-plus';
import { ref } from 'vue';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { AcmeAccountTypes, KeyTypes } from '@/global/mimetype';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElSwitch } from 'element-plus';
import { ElSelect } from 'element-plus';
import { ElOption } from 'element-plus';
import { ElLink } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    saved: (...args: unknown[]) => true,
};

const options = {
    name: 'create',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { isProductPro } = useGlobalStore();
        const open = ref();
        const loading = ref(false);
        const accountForm = ref<FormInstance>();
        const rules = ref({
            email: [Rules.requiredInput, Rules.email],
            type: [Rules.requiredSelect],
            eabKid: [Rules.requiredInput],
            eabHmacKey: [Rules.requiredInput],
            keyType: [Rules.requiredSelect],
            caDirURL: [Rules.requiredInput],
        });
        const initData = () => ({
            email: '',
            type: 'letsencrypt',
            eabKid: '',
            eabHmacKey: '',
            keyType: 'EC256',
            useProxy: false,
            caDirURL: '',
            useEAB: false,
        });
        const account = ref(initData());
        const handleClose = () => {
            resetForm();
            open.value = false;
        };
        const resetForm = () => {
            accountForm.value?.resetFields();
            account.value = initData();
        };
        const acceptParams = () => {
            open.value = true;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl || loading.value) return;
            loading.value = true;
            try {
                if (!(await formEl.validate().catch(() => false))) return;
                await rpc.ssl.createACME(account.value as any);
                MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                handleClose();
                ctx.emit('saved');
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('commons.button.create')}
                size="large"
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
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit(unref(accountForm));
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        ref={accountForm}
                        label-position="top"
                        model={unref(account)}
                        rules={unref(rules)}
                    >
                        <ElFormItem label={$t('website.email')} prop="email">
                            <ElInput
                                modelValue={unref(account).email}
                                onUpdate:modelValue={($v) => {
                                    unref(account).email = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                            />
                        </ElFormItem>
                        {unref(isProductPro) ? (
                            <ElFormItem label={$t('website.useProxy')} prop="useProxy">
                                <ElSwitch
                                    modelValue={unref(account).useProxy}
                                    onUpdate:modelValue={($v) => {
                                        unref(account).useProxy = $v as any;
                                    }}
                                />
                                <span class={'input-help'}>{$t('website.useProxyHelper')}</span>
                            </ElFormItem>
                        ) : null}
                        <ElFormItem label={$t('website.acmeAccountType')} prop="type">
                            <ElSelect
                                modelValue={unref(account).type}
                                onUpdate:modelValue={($v) => {
                                    unref(account).type = $v as any;
                                }}
                            >
                                {(AcmeAccountTypes || []).map((acme, index) => (
                                    <ElOption label={acme.label} value={acme.value} key={index} />
                                ))}
                            </ElSelect>
                            {unref(account).type === 'buypass' ? (
                                <span class={'input-help'}>{$t('ssl.buypassHelper')}</span>
                            ) : null}
                            {unref(account).type == 'google' ? (
                                <span class={'input-help'}>{$t('ssl.googleCloudHelper')}</span>
                            ) : null}
                        </ElFormItem>
                        <ElFormItem label={$t('website.keyType')} prop="keyType">
                            <ElSelect
                                modelValue={unref(account).keyType}
                                onUpdate:modelValue={($v) => {
                                    unref(account).keyType = $v as any;
                                }}
                            >
                                {(KeyTypes || []).map((keyType, index) => (
                                    <ElOption label={keyType.label} value={keyType.value} key={index} />
                                ))}
                            </ElSelect>
                        </ElFormItem>
                        {unref(account).type == 'custom' ? (
                            <div>
                                <ElFormItem label={$t('ssl.customAcmeURL')} prop="caDirURL">
                                    <ElInput
                                        modelValue={unref(account).caDirURL}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).caDirURL = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label={$t('ssl.useEAB')} prop="useEAB">
                                    <ElSwitch
                                        modelValue={unref(account).useEAB}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).useEAB = $v as any;
                                        }}
                                    />
                                </ElFormItem>
                            </div>
                        ) : null}
                        {unref(account).type == 'google' ||
                        unref(account).type == 'freessl' ||
                        (unref(account).type === 'custom' && unref(account).useEAB) ? (
                            <div>
                                <ElFormItem label="EAB kid" prop="eabKid">
                                    <ElInput
                                        modelValue={unref(account).eabKid}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).eabKid = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem label="EAB HmacKey" prop="eabHmacKey">
                                    <ElInput
                                        type="textarea"
                                        rows={3}
                                        modelValue={unref(account).eabHmacKey}
                                        onUpdate:modelValue={($v) => {
                                            unref(account).eabHmacKey = typeof $v === 'string' ? $v.trim() : $v;
                                        }}
                                    />
                                </ElFormItem>
                                {unref(account).type == 'google' ? (
                                    <ElLink
                                        type="primary"
                                        target="_blank"
                                        href="https://cloud.google.com/certificate-manager/docs/public-ca-tutorial?hl=zh-cn"
                                        class={'ml-1.5'}
                                    >
                                        {$t('ssl.googleHelper')}
                                    </ElLink>
                                ) : null}
                            </div>
                        ) : null}
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
