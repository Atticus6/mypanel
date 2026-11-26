import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { rpc } from '@/lib/rpc';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'source',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        let content = ref('');
        let loading = ref(false);
        let useOld = ref(false);
        const submit = () => {
            loading.value = true;
            rpc.openresty
                .updateConfigFile({
                    content: content.value,
                    backup: useOld.value,
                })
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    getNginxConfig();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const getNginxConfig = async () => {
            try {
                const res = await rpc.openresty.getConfig({});
                content.value = res.content;
                useOld.value = false;
            } catch (error) {}
        };
        const getDefaultConfig = async () => {
            loading.value = true;
            try {
                const res = await rpc.app.getDefaultConfig({ type: 'openresty', name: '' });
                content.value = res.content;
                useOld.value = true;
            } catch (error) {}
            loading.value = false;
        };
        onMounted(() => {
            getNginxConfig();
        });
        return () => (
            <div v-loading={unref(loading)}>
                <CodemirrorPro v-model={content.value} mode="nginx" heightDiff={350} />
                <div class={'mt-2.5'}>
                    {
                        <ElButton
                            onClick={($event?: any) => {
                                getDefaultConfig();
                            }}
                            disabled={unref(loading)}
                            v-permission={true}
                        >
                            {$t('app.defaultConfig')}
                        </ElButton>
                    }
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
                </div>
                <ElRow>
                    <ElCol span={4}>
                        {unref(useOld) ? (
                            <ElAlert
                                title={$t('app.defaultConfigHelper')}
                                type="info"
                                closable={false}
                                class={'mt-2.5'}
                            />
                        ) : null}
                    </ElCol>
                </ElRow>
            </div>
        );
    },
    options,
);
