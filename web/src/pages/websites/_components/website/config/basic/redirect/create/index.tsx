import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { Website } from '@/types/website';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'create',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const redirectForm = ref<FormInstance>();
        const rules = ref({
            name: [Rules.requiredInput, Rules.appName],
            type: [Rules.requiredSelect],
            redirect: [Rules.requiredSelect],
            domains: [Rules.requiredSelect],
            target: [Rules.requiredInput],
            path: [Rules.requiredInput],
        });
        const open = ref(false);
        const loading = ref(false);
        const initData = (): Website.RedirectConfig => ({
            websiteID: 0,
            operate: 'create',
            enable: true,
            name: '',
            domains: [],
            keepPath: true,
            type: 'domain',
            redirect: '301',
            target: 'http://',
            redirectRoot: false,
        });
        let redirect = ref(initData());
        const handleClose = () => {
            redirectForm.value?.resetFields();
            open.value = false;
            ctx.emit('close', false);
        };
        const domains = ref([]);
        const acceptParams = (redirectParam: Website.RedirectConfig) => {
            if (redirectParam.operate == 'edit') {
                redirect.value = redirectParam;
            } else {
                redirect.value = initData();
                redirect.value.websiteID = redirectParam.websiteID;
            }
            domains.value = [];
            getDomains();
            open.value = true;
        };
        const changeType = (type: string) => {
            redirectForm.value?.clearValidate('name');
            if (type != '404') {
                redirect.value.name = '';
                redirect.value.redirectRoot = false;
            } else {
                redirect.value.name = '404';
            }
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;
                rpc.website
                    .updateRedirect({
                        websiteId: redirect.value.websiteID,
                        name: redirect.value.name,
                        domains: redirect.value.domains || [],
                        keepPath: redirect.value.keepPath ?? false,
                        enable: redirect.value.enable ?? false,
                        type: redirect.value.type || 'domain',
                        redirect: redirect.value.redirect || '301',
                        path: redirect.value.path || '',
                        target: redirect.value.target || '',
                        operate: redirect.value.operate || 'create',
                        redirectRoot: redirect.value.redirectRoot ?? false,
                    })
                    .then(() => {
                        if (redirect.value.operate == 'create') {
                            MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                        } else {
                            MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                        }
                        handleClose();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
            });
        };
        const getDomains = async () => {
            try {
                loading.value = true;
                const res = await rpc.website.getRedirect({ id: redirect.value.websiteID });
                let oldDomains = [];
                if (res.items) {
                    for (const old of res.items) {
                        if (old.type == 'domain') {
                            oldDomains = oldDomains.concat(old.domains);
                        }
                    }
                }
                rpc.website
                    .listDomains({ websiteId: redirect.value.websiteID })
                    .then((domainRes) => {
                        if (domainRes.items) {
                            if (oldDomains.length > 0) {
                                for (const data of domainRes.items) {
                                    if (oldDomains.indexOf(data.domain) > -1) {
                                        continue;
                                    }
                                    domains.value.push(data);
                                }
                            } else {
                                domains.value = domainRes.items || [];
                            }
                        }
                    })
                    .finally(() => {});
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={$t('commons.button.' + unref(redirect).operate)}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                onClick={($event?: any) => {
                                    (handleClose as any)($event);
                                }}
                                disabled={unref(loading)}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            {
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit(unref(redirectForm));
                                    }}
                                    disabled={unref(loading)}
                                    v-permission={true}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>
                            }
                        </>
                    ),
                }}
            >
                {
                    <ElForm
                        ref={redirectForm}
                        label-position="top"
                        model={unref(redirect)}
                        rules={unref(rules)}
                        v-loading={unref(loading)}
                    >
                        <ElFormItem label={$t('commons.table.name')} prop="name">
                            <ElInput
                                modelValue={unref(redirect).name}
                                onUpdate:modelValue={($v) => {
                                    unref(redirect).name = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                                disabled={unref(redirect).operate === 'edit' || unref(redirect).type == '404'}
                            />
                        </ElFormItem>
                        <ElFormItem label={$t('commons.table.type')} prop="type">
                            <ElSelect
                                v-model={unref(redirect).type}
                                onChange={($event?: any) => {
                                    changeType(unref(redirect).type);
                                }}
                                disabled={unref(redirect).operate === 'edit'}
                            >
                                <ElOption label={$t('website.domain')} value={'domain'} />
                                <ElOption label={$t('website.path')} value={'path'} />
                                <ElOption label={'404'} value={'404'} />
                            </ElSelect>
                        </ElFormItem>
                        <ElFormItem label={$t('website.redirectWay')} prop="redirect">
                            <ElSelect v-model={unref(redirect).redirect}>
                                <ElOption label={'301'} value={'301'} />
                                <ElOption label={'302'} value={'302'} />
                            </ElSelect>
                            <span class={'input-help'}>{$t('website.redirectHelper')}</span>
                        </ElFormItem>
                        {unref(redirect).type == 'path' ? (
                            <ElFormItem label={$t('website.path')} prop="path">
                                <ElInput
                                    modelValue={unref(redirect).path}
                                    onUpdate:modelValue={($v) => {
                                        unref(redirect).path = typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                />
                            </ElFormItem>
                        ) : null}
                        {unref(redirect).type == 'domain' ? (
                            <ElFormItem label={$t('website.domain')} prop="domains">
                                <ElSelect v-model={unref(redirect).domains} multiple>
                                    {(unref(domains) || []).map((item, index) => (
                                        <ElOption value={item.domain} label={item.domain} key={index} />
                                    ))}
                                </ElSelect>
                            </ElFormItem>
                        ) : null}
                        {unref(redirect).type == '404' ? (
                            <ElFormItem label={$t('website.redirectRoot')} prop="redirectRoot">
                                <ElSwitch v-model={unref(redirect).redirectRoot} />
                            </ElFormItem>
                        ) : null}
                        {!unref(redirect).redirectRoot ? (
                            <ElFormItem label={$t('website.targetURL')} prop="target">
                                <ElInput
                                    modelValue={unref(redirect).target}
                                    onUpdate:modelValue={($v) => {
                                        unref(redirect).target = typeof $v === 'string' ? $v.trim() : $v;
                                    }}
                                />
                            </ElFormItem>
                        ) : null}
                        {unref(redirect).type !== '404' ? (
                            <ElFormItem label={$t('website.keepPath')} prop="keepPath">
                                <ElSwitch v-model={unref(redirect).keepPath} />
                            </ElFormItem>
                        ) : null}
                    </ElForm>
                }
            </DrawerPro>
        );
    },
    options,
);
