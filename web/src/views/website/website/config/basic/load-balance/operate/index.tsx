import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { Website } from '@/types/website';
import LoadBalanceForm from '@/views/website/website/config/basic/load-balance/form/index';
interface LoadBalanceOperate {
    websiteID: number;
    operate: string;
    upstream?: Website.NginxUpstream;
}
import permissionDirective from '@/directives/modules/permission';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'operate',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const lbFormRef = ref();
        const open = ref(false);
        const loading = ref(false);
        const operate = ref('create');
        const websiteID = ref(0);
        const disableName = ref(false);
        const formData = ref({
            name: '',
            algorithm: 'default',
            servers: [
                {
                    server: '',
                    weight: undefined,
                    maxFails: undefined,
                    maxConns: undefined,
                    failTimeout: undefined,
                    failTimeoutUnit: 's',
                    flag: '',
                },
            ],
        });
        const handleClose = () => {
            lbFormRef.value?.resetFields();
            open.value = false;
            ctx.emit('close', false);
        };
        const acceptParams = async (req: LoadBalanceOperate) => {
            websiteID.value = req.websiteID;
            operate.value = req.operate;

            if (req.operate == 'edit') {
                disableName.value = true;
                formData.value.name = req.upstream?.name || '';
                formData.value.algorithm = req.upstream?.algorithm || 'default';

                let servers = [];
                req.upstream?.servers?.forEach((server) => {
                    const weight = server.weight == 0 ? undefined : server.weight;
                    const maxFails = server.maxFails == 0 ? undefined : server.maxFails;
                    const maxConns = server.maxConns == 0 ? undefined : server.maxConns;
                    const failTimeout = server.failTimeout == 0 ? undefined : server.failTimeout;
                    const failTimeoutUnit = server.failTimeoutUnit || 's';
                    servers.push({
                        server: server.server,
                        weight: weight,
                        maxFails: maxFails,
                        maxConns: maxConns,
                        failTimeout: failTimeout,
                        failTimeoutUnit: failTimeoutUnit,
                        flag: server.flag,
                    });
                });
                formData.value.servers = servers;
            } else {
                disableName.value = false;
                formData.value.name = '';
                formData.value.algorithm = 'default';
                formData.value.servers = [
                    {
                        server: '',
                        weight: undefined,
                        maxFails: undefined,
                        maxConns: undefined,
                        failTimeout: undefined,
                        failTimeoutUnit: 's',
                        flag: '',
                    },
                ];
            }
            open.value = true;
        };
        const handleServers = () => {
            for (const server of formData.value.servers) {
                if (!server.weight || server.weight == '') {
                    server.weight = 0;
                }
                if (!server.maxFails || server.maxFails == '') {
                    server.maxFails = 0;
                }
                if (!server.maxConns || server.maxConns == '') {
                    server.maxConns = 0;
                }
                if (!server.failTimeout || server.failTimeout == '') {
                    server.failTimeout = 0;
                }
            }
        };
        const rollBackServers = () => {
            for (const server of formData.value.servers) {
                if (server.weight == 0) {
                    server.weight = undefined;
                }
                if (server.maxFails == 0) {
                    server.maxFails = undefined;
                }
                if (server.maxConns == 0) {
                    server.maxConns = undefined;
                }
                if (server.failTimeout == 0) {
                    server.failTimeout = undefined;
                }
            }
        };
        const submit = async () => {
            try {
                const valid = await lbFormRef.value?.validate();
                if (!valid) return;

                if (formData.value.algorithm == 'ip_hash') {
                    for (const server of formData.value.servers) {
                        if (server.flag == 'backup') {
                            MsgError(i18n.global.t('website.ipHashBackupErr'));
                            return;
                        }
                    }
                }

                handleServers();
                loading.value = true;

                const submitData = {
                    websiteId: websiteID.value,
                    name: formData.value.name,
                    algorithm: formData.value.algorithm,
                    servers: (formData.value.servers ?? []).map((item: any) => ({
                        server: item.server ?? '',
                        weight: Number(item.weight) || 0,
                        failTimeout: Number(item.failTimeout) || 0,
                        failTimeoutUnit: item.failTimeoutUnit ?? 's',
                        maxFails: Number(item.maxFails) || 0,
                        maxConns: Number(item.maxConns) || 0,
                        flag: item.flag ?? '',
                    })),
                };

                if (operate.value === 'edit') {
                    await rpc.website.updateLoadBalance(submitData);
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                } else {
                    await rpc.website.createLoadBalance(submitData);
                    MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                }
                handleClose();
            } catch (error) {
                rollBackServers();
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
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="large"
                header={$t('commons.button.' + unref(operate)) + $t('website.loadBalance')}
                resource={unref(operate) == 'create' ? '' : unref(formData).name}
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
                                            (submit as any)($event);
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
                <LoadBalanceForm
                    ref={lbFormRef}
                    modelValue={unref(formData)}
                    onUpdate:modelValue={($v) => {
                        formData.value = $v as any;
                    }}
                    disabled={unref(operate) === 'edit' && unref(disableName)}
                />
            </DrawerPro>
        );
    },
    options,
);
