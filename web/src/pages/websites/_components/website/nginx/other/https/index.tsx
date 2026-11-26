import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'https',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const showPage = ref(false);
        const enable = ref(false);
        const loading = ref(false);
        const form = reactive({
            operate: 'enable',
            sslRejectHandshake: false,
        });
        const getStatus = async () => {
            try {
                const res = await rpc.openresty.getDefaultHTTPSStatus({});
                enable.value = res.https;
                form.sslRejectHandshake = res.sslRejectHandshake;
                showPage.value = true;
            } catch {}
        };
        const submit = async () => {
            loading.value = true;
            try {
                form.operate = enable.value ? 'enable' : 'disable';
                await rpc.openresty.operateDefaultHTTPS({
                    operate: form.operate,
                    sslRejectHandshake: form.sslRejectHandshake ?? false,
                });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            } catch (error) {
                getStatus();
            } finally {
                loading.value = false;
            }
        };
        onMounted(() => {
            getStatus();
        });
        return () => (
            <ElRow gutter={20} v-loading={unref(loading)}>
                <ElCol xs={24} sm={20} md={16} lg={14} xl={14}>
                    <ElForm ref="nginxForm" label-position="right" label-width="140px" model={form}>
                        <ElFormItem label={$t('commons.table.status')} prop="enable">
                            <ElSwitch v-model={enable.value} />
                            <span class={'input-help'}>{$t('nginx.defaultHttpsHelper1')}</span>
                        </ElFormItem>
                        <ElFormItem label={$t('nginx.sslRejectHandshake')} prop="sslRejectHandshake">
                            <ElSwitch v-model={form.sslRejectHandshake} />
                            <span class={'input-help'}>{$t('nginx.sslRejectHandshakeHelper')}</span>
                        </ElFormItem>
                        <ElFormItem>
                            {
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit();
                                    }}
                                    disabled={unref(loading)}
                                    v-permission={true}
                                >
                                    {$t('commons.button.save')}
                                </ElButton>
                            }
                        </ElFormItem>
                    </ElForm>
                </ElCol>
            </ElRow>
        );
    },
    options,
);
