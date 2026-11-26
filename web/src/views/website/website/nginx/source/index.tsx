import { $t } from '@/utils/i18n-t';
import { onMounted, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { rpc } from '@/lib/rpc';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElButton } from 'element-plus';
import { ElRow } from 'element-plus';
import { ElCol } from 'element-plus';
import { ElAlert } from 'element-plus';

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
        return () =>
            withDirectives(
                <div>
                    <CodemirrorPro
                        modelValue={unref(content)}
                        onUpdate:modelValue={($v) => {
                            content.value = $v as any;
                        }}
                        mode="nginx"
                        heightDiff={350}
                    />
                    <div class={'mt-2.5'}>
                        {withDirectives(
                            <ElButton
                                onClick={($event?: any) => {
                                    getDefaultConfig();
                                }}
                                disabled={unref(loading)}
                            >
                                {$t('app.defaultConfig')}
                            </ElButton>,
                            [[permissionDirective, true]],
                        )}
                        {withDirectives(
                            <ElButton
                                type="primary"
                                onClick={($event?: any) => {
                                    submit();
                                }}
                                disabled={unref(loading)}
                            >
                                {$t('commons.button.save')}
                            </ElButton>,
                            [[permissionDirective, true]],
                        )}
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
                </div>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
