import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { checkIp, checkIpV6 } from '@/utils/validate';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    port: number;
    address: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'address',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            port: 22,
            ipv4All: false,
            ipv6All: false,
            listenAddressV4: '',
            listenAddressV6: '',
        });
        const rules = reactive({
            listenAddressV4: [{ validator: checkIPv4, trigger: 'blur' }],
            listenAddressV6: [{ validator: checkIPv6, trigger: 'blur' }],
        });
        function checkIPv4(rule: any, value: any, callback: any) {
            if (value === '') {
                callback();
            }
            if (checkIp(value)) {
                return callback(new Error(i18n.global.t('commons.rule.ip')));
            }
            callback();
        }
        function checkIPv6(rule: any, value: any, callback: any) {
            if (value === '') {
                callback();
            }
            if (checkIpV6(value)) {
                return callback(new Error(i18n.global.t('commons.rule.ip')));
            }
            callback();
        }
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            let items = params.address.split(',');
            for (const item of items) {
                if (item.indexOf(':') !== -1) {
                    form.listenAddressV6 = item;
                    form.ipv6All = item === '::';
                    continue;
                }
                form.listenAddressV4 = item;
                form.ipv4All = item === '0.0.0.0';
            }
            form.port = params.port;
            drawerVisible.value = true;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                let itemAddr = [];
                if (form.listenAddressV4 !== '') {
                    itemAddr.push(form.listenAddressV4);
                }
                if (form.listenAddressV6 !== '') {
                    itemAddr.push(form.listenAddressV6);
                }
                let addr =
                    itemAddr.join(',') === '' || itemAddr.join(',') === '0.0.0.0,::'
                        ? i18n.global.t('ssh.allV4V6', [form.port])
                        : itemAddr.join(',');
                ElMessageBox.confirm(
                    i18n.global.t('ssh.sshChangeHelper', [i18n.global.t('ssh.listenAddress'), addr]),
                    i18n.global.t('ssh.sshChange'),
                    {
                        confirmButtonText: i18n.global.t('commons.button.confirm'),
                        cancelButtonText: i18n.global.t('commons.button.cancel'),
                        type: 'info',
                    },
                )
                    .then(async () => {
                        let params = {
                            key: 'ListenAddress',
                            newValue: itemAddr.join(','),
                        };
                        loading.value = true;
                        await rpc.ssh
                            .update(params)
                            .then(() => {
                                loading.value = false;
                                handleClose();
                                ctx.emit('search');
                                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            })
                            .catch(() => {
                                loading.value = false;
                            });
                    })
                    .catch(() => {
                        ctx.emit('search');
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
                header={$t('ssh.listenAddress')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
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
                            </span>
                        </>
                    ),
                }}
            >
                {
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        rules={rules}
                        model={form}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        v-loading={unref(loading)}
                    >
                        <ElAlert
                            closable={false}
                            type="warning"
                            class={'common-prompt'}
                            v-slots={{
                                default: () => (
                                    <>
                                        <span>{$t('ssh.listenHelper', [form.port])}</span>
                                    </>
                                ),
                            }}
                        />
                        <ElFormItem label="IPv4" prop="listenAddressV4">
                            <ElCheckbox
                                v-model={form.ipv4All}
                                onChange={($event?: any) => {
                                    form.listenAddressV4 = form.ipv4All ? '0.0.0.0' : form.listenAddressV4;
                                }}
                            >
                                {$t('setting.bindAll')}
                            </ElCheckbox>
                            <ElInput disabled={form.ipv4All} clearable v-model={form.listenAddressV4} />
                        </ElFormItem>
                        <ElFormItem label="IPv6" prop="listenAddressV6">
                            <ElCheckbox
                                v-model={form.ipv6All}
                                onChange={($event?: any) => {
                                    form.listenAddressV6 = form.ipv6All ? '::' : form.listenAddressV6;
                                }}
                            >
                                {$t('setting.bindAll')}
                            </ElCheckbox>
                            <ElInput disabled={form.ipv6All} clearable v-model={form.listenAddressV6} />
                        </ElFormItem>
                    </ElForm>
                }
            </DrawerPro>
        );
    },
    options,
);
