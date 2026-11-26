import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import CorsSetting from '@/pages/views/website/website/cors/index';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'cors',
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
        const rules = ref({
            allowOrigins: [Rules.requiredInput],
        });
        const corsForm = ref<FormInstance>();
        const loading = ref(false);
        const corsSetting = ref({
            cors: false,
            allowOrigins: '*',
            allowMethods: 'GET,POST,OPTIONS,PUT,DELETE',
            allowHeaders: '',
            allowCredentials: false,
            preflight: true,
            websiteID: __panelSetupProps.id,
        });
        const updateonfig = (config: any) => {
            corsSetting.value.allowOrigins = config.allowOrigins;
            corsSetting.value.allowMethods = config.allowMethods;
            corsSetting.value.allowHeaders = config.allowHeaders;
            corsSetting.value.allowCredentials = config.allowCredentials;
            corsSetting.value.preflight = config.preflight;
        };
        const submit = async () => {
            const isValid = await corsForm.value?.validate();
            if (!isValid) return;

            corsSetting.value.websiteID = __panelSetupProps.id;
            try {
                loading.value = true;
                await rpc.website.updateCors({ ...(corsSetting.value as any), websiteId: __panelSetupProps.id });
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            } catch (error) {
                return;
            } finally {
                loading.value = false;
            }
        };
        const getCors = () => {
            rpc.website.getCors({ id: __panelSetupProps.id }).then((res) => {
                corsSetting.value = res as any;
            });
        };
        onMounted(() => {
            getCors();
        });
        return () => (
            <ElRow>
                <ElCol xs={24} sm={18} md={18} lg={14} xl={14}>
                    {withDirectives(
                        <ElForm
                            ref={corsForm}
                            label-position="right"
                            label-width="150px"
                            model={unref(corsSetting)}
                            rules={unref(rules)}
                        >
                            <CorsSetting
                                modelValue={unref(corsSetting).cors}
                                onUpdate:modelValue={($v) => {
                                    unref(corsSetting).cors = $v as any;
                                }}
                                config={{
                                    allowOrigins: unref(corsSetting).allowOrigins,
                                    allowMethods: unref(corsSetting).allowMethods,
                                    allowHeaders: unref(corsSetting).allowHeaders,
                                    allowCredentials: unref(corsSetting).allowCredentials,
                                    preflight: unref(corsSetting).preflight,
                                }}
                                enable-size="small"
                                onUpdate:config={($event?: any) => {
                                    (updateonfig as any)($event);
                                }}
                            />
                            <ElFormItem>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit();
                                        }}
                                    >
                                        {$t('commons.button.save')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </ElFormItem>
                        </ElForm>,
                        [[vLoading, unref(loading)]],
                    )}
                </ElCol>
            </ElRow>
        );
    },
    options,
);
