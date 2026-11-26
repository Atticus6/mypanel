import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import permissionDirective from '@/directives/modules/permission';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'real-ip',
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
        const loading = ref(false);
        const realIPForm = ref<FormInstance>();
        const req = reactive({
            websiteID: 0,
            open: false,
            ipFrom: '127.0.0.1',
            ipHeader: 'X-Real-IP',
            ipOther: '',
        });
        const rules = {
            ipFrom: [Rules.requiredInput],
            ipHeader: [Rules.requiredSelect],
            ipOther: [Rules.requiredInput],
        };
        const get = () => {
            rpc.website.getRealIP({ id: __panelSetupProps.id }).then((res) => {
                req.open = res.open;
                if (res.open) {
                    req.ipFrom = res.ipFrom;
                    req.ipHeader = res.ipHeader;
                    req.ipOther = res.ipOther;
                }
            });
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate(async (valid) => {
                if (!valid) {
                    return;
                }
                req.websiteID = __panelSetupProps.id;
                try {
                    await rpc.website.updateRealIP({
                        websiteId: __panelSetupProps.id,
                        open: req.open,
                        ipFrom: req.ipFrom,
                        ipHeader: req.ipHeader,
                        ipOther: req.ipOther,
                    });
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                } catch (error) {}
            });
        };
        onMounted(() => {
            get();
        });
        return () =>
            withDirectives(
                <ElRow gutter={20}>
                    <ElCol xs={24} sm={14} md={14} lg={10} xl={8}>
                        <ElAlert closable={false}>
                            {$t('website.ipFromHelper')}
                            <div>{$t('website.ipFromExample1')}</div>
                            <div>{$t('website.ipFromExample2')}</div>
                            <div>{$t('website.ipFromExample3')}</div>
                        </ElAlert>
                        {withDirectives(
                            <ElForm
                                onSubmit={($event?: any) => {
                                    $event.preventDefault();
                                }}
                                ref={realIPForm}
                                label-position="right"
                                label-width="100px"
                                model={req}
                                rules={rules}
                                validate-on-rule-change={false}
                            >
                                <ElFormItem label={$t('commons.button.start')} prop="open">
                                    <ElSwitch
                                        modelValue={req.open}
                                        onUpdate:modelValue={($v) => {
                                            req.open = $v as any;
                                        }}
                                    />
                                </ElFormItem>
                                {req.open ? (
                                    <div>
                                        <ElFormItem label={$t('website.ipFrom')} prop="ipFrom">
                                            <ElInput
                                                type="textarea"
                                                rows={10}
                                                clearable
                                                modelValue={req.ipFrom}
                                                onUpdate:modelValue={($v) => {
                                                    req.ipFrom = $v as any;
                                                }}
                                                placeholder={$t('website.wafInputHelper')}
                                            />
                                            <span class={'input-help'}>{$t('website.wafInputHelper')}</span>
                                        </ElFormItem>
                                        <ElFormItem label="IP Header" prop="ipHeader">
                                            <ElSelect
                                                modelValue={req.ipHeader}
                                                onUpdate:modelValue={($v) => {
                                                    req.ipHeader = $v as any;
                                                }}
                                            >
                                                <ElOption label={$t('website.other')} value="other" />
                                                {['X-Forwarded-For', 'X-Real-IP', 'CF-Connecting-IP'].map((item) => (
                                                    <ElOption label={item} value={item} key={item} />
                                                ))}
                                            </ElSelect>
                                        </ElFormItem>
                                        {req.ipHeader === 'other' ? (
                                            <ElFormItem prop="ipOther">
                                                <ElInput
                                                    modelValue={req.ipOther}
                                                    onUpdate:modelValue={($v) => {
                                                        req.ipOther = typeof $v === 'string' ? $v.trim() : $v;
                                                    }}
                                                />
                                            </ElFormItem>
                                        ) : null}
                                    </div>
                                ) : null}
                                <ElFormItem>
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                submit(unref(realIPForm));
                                            }}
                                            loading={unref(loading)}
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
                </ElRow>,
                [[vLoading, unref(loading)]],
            );
    },
    options,
);
