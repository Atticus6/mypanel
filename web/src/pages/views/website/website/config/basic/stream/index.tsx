import { $t } from '@/utils/i18n-t';
import LoadBalanceForm from '@/pages/views/website/website/config/basic/load-balance/form/index';
import { Rules } from '@/global/form-rules';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'stream',
    props: {
        id: {
            type: Number,
            default: 0,
        },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const form = ref({
            streamPorts: '',
            servers: [],
            name: '',
            algorithm: '',
            websiteID: __panelSetupProps.id,
            udp: false,
        });
        const streamFormRef = ref();
        const lbFormRef = ref();
        const loading = ref(false);
        const submit = async () => {
            try {
                loading.value = true;
                const formValid = await streamFormRef.value?.validate();
                if (!formValid) return;
                const lbValid = await lbFormRef.value?.validate();
                if (!lbValid) return;
                await rpc.website.updateStream(form.value as any);
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            } finally {
                loading.value = false;
            }
        };
        onMounted(async () => {
            const res = await (rpc.website.getWebsite({ id: __panelSetupProps.id }) as Promise<any>);
            form.value.streamPorts = res.data.streamPorts;
            form.value.name = res.data.primaryDomain;
            form.value.algorithm = res.data.algorithm == '' ? 'default' : res.data.algorithm;
            form.value.streamPorts = res.data.streamPorts;
            form.value.udp = res.data.udp;

            let servers = [];
            res.data?.servers?.forEach((server) => {
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
            form.value.servers = servers;
        });
        return () => (
            <div>
                <ElForm ref={streamFormRef} model={unref(form)} label-width="120px" label-position="top">
                    {withDirectives(
                        <ElRow>
                            <ElCol span={12} offset={1}>
                                <ElFormItem label={$t('website.streamPorts')} rules={Rules.requiredInput}>
                                    <ElInput
                                        modelValue={unref(form).streamPorts}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).streamPorts = $v as any;
                                        }}
                                    />
                                </ElFormItem>
                                <ElFormItem prop="udp">
                                    <ElCheckbox
                                        modelValue={unref(form).udp}
                                        onUpdate:modelValue={($v) => {
                                            unref(form).udp = $v as any;
                                        }}
                                        label={$t('website.udp')}
                                        size="large"
                                    />
                                </ElFormItem>
                                <LoadBalanceForm
                                    ref={lbFormRef}
                                    modelValue={unref(form)}
                                    onUpdate:modelValue={($v) => {
                                        form.value = $v as any;
                                    }}
                                    disabled={true}
                                />
                                <ElFormItem>
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                submit();
                                            }}
                                            class={'mt-2'}
                                        >
                                            {$t('commons.button.save')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                </ElFormItem>
                            </ElCol>
                        </ElRow>,
                        [[vLoading, unref(loading)]],
                    )}
                </ElForm>
            </div>
        );
    },
    options,
);
