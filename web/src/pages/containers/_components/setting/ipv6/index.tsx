import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { checkIpV6 } from '@/utils/validate';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    fixedCidrV6: string;
    ip6Tables: boolean;
    experimental: boolean;
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
    name: 'ipv6',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { docsUrl } = useGlobalStore();
        const loading = ref();
        const drawerVisible = ref();
        const confirmDialogRef = ref();
        const formRef = ref();
        const showMore = ref(true);
        const form = reactive({
            fixedCidrV6: '',
            ip6Tables: false,
            experimental: false,
        });
        const rules = reactive({
            fixedCidrV6: [{ validator: checkFixedCidrV6, trigger: 'blur', required: true }],
        });
        function checkFixedCidrV6(rule: any, value: any, callback: any) {
            if (!form.fixedCidrV6 || form.fixedCidrV6.indexOf('/') === -1) {
                return callback(new Error(i18n.global.t('commons.rule.formatErr')));
            }
            if (checkIpV6(form.fixedCidrV6.split('/')[0])) {
                return callback(new Error(i18n.global.t('commons.rule.formatErr')));
            }
            const reg = /^(?:[1-9]|[1-9][0-9]|1[0-1][0-9]|12[0-8])$/;
            if (!reg.test(form.fixedCidrV6.split('/')[1])) {
                return callback(new Error(i18n.global.t('commons.rule.formatErr')));
            }
            callback();
        }
        const toDoc = () => {
            window.open(docsUrl.value + '/user_manual/containers/setting/', '_blank', 'noopener,noreferrer');
        };
        const acceptParams = (params: DialogProps): void => {
            form.fixedCidrV6 = params.fixedCidrV6;
            form.ip6Tables = params.ip6Tables;
            form.experimental = params.experimental;
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
                .updateIpv6Option({
                    fixedCidrV6: form.fixedCidrV6,
                    ip6Tables: form.ip6Tables,
                    experimental: form.experimental,
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
                    header="IPv6"
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
                                    <span class={'input-help'}>
                                        {$t('container.ipv6Helper')}
                                        <ElLink
                                            icon="Position"
                                            onClick={($event?: any) => {
                                                toDoc();
                                            }}
                                            type="primary"
                                            style={'font-size: 12px; margin-left: 5px'}
                                        >
                                            {$t('firewall.quickJump')}
                                        </ElLink>
                                    </span>
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
                            <ElFormItem prop="fixedCidrV6" label={$t('container.subnet')}>
                                <ElInput v-model={form.fixedCidrV6} />
                                <span class={'input-help'}>{$t('container.ipv6CidrHelper')}</span>
                            </ElFormItem>
                            <ElFormItem>
                                <ElCheckbox v-model={showMore.value} label={$t('app.advanced')} />
                            </ElFormItem>
                            {unref(showMore) ? (
                                <div>
                                    <ElFormItem prop="ip6Tables" label="ip6tables">
                                        <ElSwitch v-model={form.ip6Tables} />
                                        <span class={'input-help'}>{$t('container.ipv6TablesHelper')}</span>
                                    </ElFormItem>
                                    <ElFormItem prop="experimental" label="experimental">
                                        <ElSwitch v-model={form.experimental} />
                                        <span class={'input-help'}>{$t('container.experimentalHelper')}</span>
                                    </ElFormItem>
                                </div>
                            ) : null}
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
