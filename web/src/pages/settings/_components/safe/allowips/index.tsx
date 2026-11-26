import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { checkCidr, checkCidrV6, checkIpV4V6 } from '@/utils/validate';
interface DialogProps {
    allowIPs: string;
    allowIPTrustedProxies: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'allowips',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const form = reactive({
            allowIPs: '',
            allowIPTrustedProxies: '',
        });
        const rules = reactive({
            allowIPs: [{ validator: checkIPs, trigger: 'blur' }],
            allowIPTrustedProxies: [{ validator: checkIPs, trigger: 'blur' }],
        });
        function checkIPs(rule: any, value: any, callback: any) {
            if (typeof value === 'string' && value.trim() !== '') {
                let addr = value.split('\n');
                for (const item of addr) {
                    if (item === '') {
                        continue;
                    }
                    if (item === '0.0.0.0' || item === '0.0.0.0/0' || item === '::' || item === '::/0') {
                        return callback(new Error(i18n.global.t('firewall.addressFormatError')));
                    }
                    if (item.indexOf('/') !== -1) {
                        if (item.indexOf(':') !== -1) {
                            if (checkCidrV6(item)) {
                                return callback(new Error(i18n.global.t('firewall.addressFormatError')));
                            }
                        } else if (checkCidr(item)) {
                            return callback(new Error(i18n.global.t('firewall.addressFormatError')));
                        }
                    } else if (checkIpV4V6(item)) {
                        return callback(new Error(i18n.global.t('firewall.addressFormatError')));
                    }
                }
            }
            callback();
        }
        const formRef = ref<FormInstance>();
        const drawerVisible = ref();
        const loading = ref();
        const acceptParams = (params: DialogProps): void => {
            form.allowIPs = params.allowIPs;
            form.allowIPTrustedProxies = params.allowIPTrustedProxies;
            drawerVisible.value = true;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                let title = form.allowIPs ? i18n.global.t('setting.allowIPs') : i18n.global.t('setting.unAllowIPs');
                let allow = form.allowIPs
                    ? `${i18n.global.t('setting.allowIPsWarning')} ${i18n.global.t('setting.allowIPsPrivateHelper')}`
                    : i18n.global.t('setting.unAllowIPsWarning');
                ElMessageBox.confirm(allow, title, {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                }).then(async () => {
                    loading.value = true;
                    let ipItems = form.allowIPs.split('\n');
                    let ips = [];
                    for (const item of ipItems) {
                        if (item !== '') {
                            ips.push(item);
                        }
                    }
                    await Promise.all([
                        rpc.core.setting.updateSetting({ key: 'AllowIPs', value: ips.join(',') }),
                        rpc.core.setting.updateSetting({
                            key: 'AllowIPTrustedProxies',
                            value: form.allowIPTrustedProxies,
                        }),
                    ])
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            ctx.emit('search');
                            handleClose();
                        })
                        .catch(() => {
                            loading.value = false;
                        });
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
                v-model={drawerVisible.value}
                header={$t('setting.allowIPs')}
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
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        model={form}
                        rules={rules}
                        v-loading={unref(loading)}
                    >
                        <ElFormItem label={$t('setting.allowIPs')} prop="allowIPs">
                            <ElInput
                                type="textarea"
                                placeholder={$t('setting.allowIPEgs')}
                                rows={3}
                                v-model={form.allowIPs}
                            />
                            <span class={'input-help'}>{$t('setting.allowIPsHelper1')}</span>
                            <span class={'input-help'}>{$t('setting.allowIPsPrivateHelper')}</span>
                        </ElFormItem>
                        <ElFormItem label={$t('setting.passkeyTrustedProxies')} prop="allowIPTrustedProxies">
                            <ElInput
                                type="textarea"
                                placeholder={$t('setting.apiTrustedProxiesEgs')}
                                rows={3}
                                v-model={form.allowIPTrustedProxies}
                            />
                            <span class={'input-help'}>{$t('setting.apiTrustedProxiesHelper')}</span>
                        </ElFormItem>
                    </ElForm>
                }
            </DrawerPro>
        );
    },
    options,
);
