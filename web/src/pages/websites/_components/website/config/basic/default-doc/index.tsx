import { $t } from '@/utils/i18n-t';
interface NginxConfigReq {
    operate: string;
    websiteId: number;
    scope: string;
    params?: any;
}
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'default-doc',
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
        const websiteId = computed(() => {
            return Number(__panelSetupProps.id);
        });
        const defaultForm = ref<FormInstance>();
        let rules = ref({
            index: [Rules.requiredInput, Rules.nginxDoc],
        });
        let defaultModel = ref({
            index: '',
        });
        let req = ref({
            operate: 'update',
            scope: 'index',
            websiteId: websiteId.value,
            params: {},
        });
        let loading = ref(false);
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                req.value.params = defaultModel.value;
                loading.value = true;
                rpc.website
                    .updateNginxScopeConfig({
                        websiteId: req.value.websiteId,
                        scope: req.value.scope,
                        operate: req.value.operate,
                        paramsJson: JSON.stringify(req.value.params ?? []),
                    })
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        search(req.value);
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const search = (req: NginxConfigReq) => {
            loading.value = true;
            rpc.website
                .getNginxScopeConfig({ websiteId: req.websiteId, scope: req.scope })
                .then((res) => {
                    if (res.params.length > 0) {
                        const params = res.params[0].params;
                        let values = '';
                        for (const param of params) {
                            values = values + param + '\n';
                        }
                        defaultModel.value.index = values;
                    }
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        onMounted(() => {
            search(req.value);
        });
        return () => (
            <ElRow gutter={20} v-loading={unref(loading)}>
                <ElCol xs={24} sm={18} md={8} lg={8} xl={8}>
                    <ElForm
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                        ref={defaultForm}
                        label-position="top"
                        model={unref(defaultModel)}
                        rules={unref(rules)}
                    >
                        <ElFormItem label={$t('website.defaultDoc')} prop="index">
                            <ElInput v-model={unref(defaultModel).index} type="textarea" rows={8} />
                        </ElFormItem>
                    </ElForm>
                    {
                        <ElButton
                            type="primary"
                            onClick={($event?: any) => {
                                submit(unref(defaultForm));
                            }}
                            disabled={unref(loading)}
                            v-permission={true}
                        >
                            {$t('commons.button.save')}
                        </ElButton>
                    }
                </ElCol>
            </ElRow>
        );
    },
    options,
);
