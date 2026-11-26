import { $t } from '@/utils/i18n-t';
import { checkNumberRange, Rules } from '@/global/form-rules';
import { Website } from '@/types/website';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import permissionDirective from '@/directives/modules/permission';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'limit-conn',
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
        let rules = reactive({
            perserver: [Rules.requiredInput, checkNumberRange(1, 65535)],
            perip: [Rules.requiredInput, checkNumberRange(1, 65535)],
            rate: [Rules.requiredInput, checkNumberRange(1, 99999999)],
        });
        const limitForm = ref<FormInstance>();
        let form = reactive({
            perserver: 300,
            perip: 25,
            rate: 512,
        });
        let req = reactive({
            operate: 'update',
            scope: 'limit-conn',
            websiteId: websiteId.value,
            params: [{}],
        });
        let scopeReq = reactive({
            scope: 'limit-conn',
            websiteId: websiteId.value,
        });
        let enable = ref(false);
        let loading = ref(false);
        const limitRules = [
            { key: i18n.global.t('website.blog'), values: [300, 25, 512] },
            { key: i18n.global.t('website.imageSite'), values: [200, 10, 1024] },
            { key: i18n.global.t('website.downloadSite'), values: [50, 3, 2048] },
            { key: i18n.global.t('website.shopSite'), values: [500, 10, 2048] },
            { key: i18n.global.t('website.doorSite'), values: [400, 15, 1024] },
            { key: i18n.global.t('website.qiteSite'), values: [60, 10, 512] },
            { key: i18n.global.t('website.videoSite'), values: [150, 4, 1024] },
        ];
        let ruleKey = ref('');
        const search = (scopeReq: Website.NginxScopeReq) => {
            loading.value = true;
            rpc.website
                .getNginxScopeConfig({ websiteId: scopeReq.websiteId, scope: scopeReq.scope })
                .then((res) => {
                    ruleKey.value = 'current';
                    if (res) {
                        enable.value = res.enable;
                        if (res.enable == false) {
                            req.operate = 'add';
                        }
                        for (const param of res.params) {
                            if (param.name === 'limit_conn') {
                                if (param.params[0] === 'perserver' && param.params[1]) {
                                    form.perserver = Number(param.params[1].match(/\d+/g));
                                }
                                if (param.params[0] === 'perip' && param.params[1]) {
                                    form.perip = Number(param.params[1].match(/\d+/g));
                                }
                            }
                            if (param.name === 'limit_rate' && param.params[0]) {
                                form.rate = Number(param.params[0].match(/\d+/g));
                            }
                        }
                    }
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;
                let params = [
                    {
                        limit_conn: 'perserver ' + String(form.perserver),
                    },
                    {
                        limit_conn: 'perip ' + String(form.perip),
                    },
                    {
                        limit_rate: String(form.rate) + 'k',
                    },
                ];
                req.params = params;
                if (req.operate === 'add') {
                    enable.value = true;
                }
                rpc.website
                    .updateNginxScopeConfig({
                        websiteId: req.websiteId,
                        scope: req.scope,
                        operate: req.operate,
                        paramsJson: JSON.stringify(req.params ?? []),
                    })
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        search(req);
                    })
                    .finally(() => {
                        if (req.operate === 'add') {
                            enable.value = false;
                        }
                        loading.value = false;
                    });
            });
        };
        const changeEnable = () => {
            if (!enable.value) {
                req.operate = 'delete';
            } else {
                req.operate = 'add';
            }
            submit(limitForm.value);
        };
        const changeRule = (key: string) => {
            limitRules.forEach((limit) => {
                if (limit.key === key) {
                    form.perserver = limit.values[0];
                    form.perip = limit.values[1];
                    form.rate = limit.values[2];
                }
            });
        };
        onMounted(() => {
            search(scopeReq);
        });
        return () =>
            withDirectives(
                <ElRow gutter={20}>
                    <ElCol xs={24} sm={18} md={8} lg={8} xl={8}>
                        <ElForm ref={limitForm} label-position="right" model={form} rules={rules} label-width="100px">
                            <ElFormItem prop="enable" label={$t('website.enableOrNot')}>
                                {withDirectives(
                                    <ElSwitch
                                        modelValue={unref(enable)}
                                        onUpdate:modelValue={($v) => {
                                            enable.value = $v as any;
                                        }}
                                        onChange={($event?: any) => {
                                            (changeEnable as any)($event);
                                        }}
                                    />,
                                    [[permissionDirective, true]],
                                )}
                            </ElFormItem>
                            <ElFormItem label={$t('website.limit')}>
                                <ElSelect
                                    modelValue={unref(ruleKey)}
                                    onUpdate:modelValue={($v) => {
                                        ruleKey.value = $v as any;
                                    }}
                                    onChange={($event?: any) => {
                                        changeRule(unref(ruleKey));
                                    }}
                                >
                                    <ElOption label={$t('website.current')} value={'current'} />
                                    {(limitRules || []).map((limit, index) => (
                                        <ElOption label={limit.key} value={limit.key} key={index} />
                                    ))}
                                </ElSelect>
                            </ElFormItem>
                            <ElFormItem label={$t('website.perserver')} prop="perserver">
                                <ElInput
                                    modelValue={form.perserver}
                                    onUpdate:modelValue={($v) => {
                                        form.perserver = $v === '' ? $v : Number($v);
                                    }}
                                    maxlength="15"
                                />
                                <span class={'input-help'}>{$t('website.perserverHelper')}</span>
                            </ElFormItem>
                            <ElFormItem label={$t('website.perip')} prop="perip">
                                <ElInput
                                    modelValue={form.perip}
                                    onUpdate:modelValue={($v) => {
                                        form.perip = $v === '' ? $v : Number($v);
                                    }}
                                    maxlength="15"
                                />
                                <span class={'input-help'}>{$t('website.peripHelper')}</span>
                            </ElFormItem>
                            <ElFormItem label={$t('website.rateLimit')} prop="rate">
                                <ElInput
                                    modelValue={form.rate}
                                    onUpdate:modelValue={($v) => {
                                        form.rate = $v === '' ? $v : Number($v);
                                    }}
                                    maxlength="15"
                                />
                                <span class={'input-help'}>{$t('website.rateLimitHelper')}</span>
                            </ElFormItem>
                            <ElFormItem>
                                {withDirectives(
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit(unref(limitForm));
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {unref(enable) ? (
                                            <span>{$t('commons.button.save')}</span>
                                        ) : (
                                            <span>{$t('commons.button.saveAndEnable')}</span>
                                        )}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </ElFormItem>
                        </ElForm>
                    </ElCol>
                </ElRow>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
