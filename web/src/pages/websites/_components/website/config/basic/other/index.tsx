import { $t } from '@/utils/i18n-t';
import GroupSelect from '@/pages/websites/_components/website/components/group/index';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'other',
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
        const websiteForm = ref<FormInstance>();
        const websiteId = computed(() => {
            return Number(__panelSetupProps.id);
        });
        const loading = ref(false);
        const form = reactive({
            id: websiteId.value,
            primaryDomain: '',
            remark: '',
            webSiteGroupId: 0,
            IPV6: false,
            alias: '',
            favorite: false,
        });
        const rules = ref({
            primaryDomain: [Rules.requiredInput, Rules.linuxName],
            webSiteGroupId: [Rules.requiredSelect],
        });
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                if (form.remark && form.remark.length > 128) {
                    MsgError(i18n.global.t('commons.rule.length128Err'));
                    return;
                }
                loading.value = true;
                rpc.website
                    .updateWebsite({
                        id: form.id,
                        primaryDomain: form.primaryDomain,
                        remark: form.remark,
                        websiteGroupId: form.webSiteGroupId,
                        expireDate: '',
                        ipv6: form.IPV6,
                        favorite: form.favorite,
                    })
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        search();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const search = async () => {
            rpc.website.getWebsite({ id: websiteId.value }).then((res) => {
                form.primaryDomain = res.primaryDomain;
                form.remark = res.remark;
                form.webSiteGroupId = res.websiteGroupId;
                form.IPV6 = res.ipv6;
                form.alias = res.alias;
                form.favorite = res.favorite;
            });
        };
        onMounted(() => {
            search();
        });
        return () => (
            <ElRow gutter={20} v-loading={unref(loading)}>
                <ElCol xs={24} sm={24} md={18} lg={14} xl={8}>
                    <ElForm
                        ref={websiteForm}
                        label-position="right"
                        label-width="80px"
                        model={form}
                        rules={unref(rules)}
                    >
                        <ElFormItem label={$t('commons.table.name')} prop="primaryDomain">
                            <ElInput v-model={form.primaryDomain} />
                        </ElFormItem>
                        <ElFormItem label={$t('website.alias')} prop="alias">
                            <ElInput v-model={form.alias} disabled />
                        </ElFormItem>
                        <GroupSelect v-model={form.webSiteGroupId} prop={'webSiteGroupId'} groupType={'website'} />
                        <ElFormItem label={$t('website.remark')} prop="remark">
                            <ElInput v-model={form.remark} />
                        </ElFormItem>
                        <ElFormItem prop="IPV6">
                            <ElCheckbox v-model={form.IPV6} label={$t('website.ipv6')} size="large" />
                        </ElFormItem>
                        <ElFormItem>
                            {
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit(unref(websiteForm));
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
