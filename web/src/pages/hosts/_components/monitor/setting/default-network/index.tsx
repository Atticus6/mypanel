import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { Rules } from '@/global/form-rules';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
interface DialogProps {
    defaultNetwork: string;
}
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'default-network',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const { defaultNetwork } = useGlobalStore();
        const drawerVisible = ref();
        const loading = ref();
        const netOptions = ref();
        const form = reactive({
            defaultNetwork: '',
        });
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            form.defaultNetwork = params.defaultNetwork;
            loadNetworkOptions();
            drawerVisible.value = true;
        };
        const loadNetworkOptions = async () => {
            const res = await rpc.monitor.listNetworkOptions({});
            netOptions.value = res.items;
        };
        const onSave = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                await rpc.monitor
                    .updateSetting({ key: 'DefaultNetwork', value: form.defaultNetwork })
                    .then(async () => {
                        defaultNetwork.value = form.defaultNetwork;
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
                v-model={drawerVisible.value}
                header={$t('monitor.defaultNetwork')}
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
                        model={form}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        v-loading={unref(loading)}
                    >
                        <ElFormItem
                            label={$t('monitor.defaultNetwork')}
                            prop="defaultNetwork"
                            rules={Rules.requiredSelect}
                        >
                            <ElSelect v-model={form.defaultNetwork} filterable>
                                {(unref(netOptions) || []).map((item) => (
                                    <ElOption
                                        label={item == 'all' ? $t('commons.table.all') : item}
                                        value={item}
                                        key={item}
                                    />
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
