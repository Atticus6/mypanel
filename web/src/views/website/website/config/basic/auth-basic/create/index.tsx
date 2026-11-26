import { $t } from '@/utils/i18n-t';
import { Rules } from '@/global/form-rules';
import i18n from '@/lang';
import { FormInstance } from 'element-plus';
import { ref } from 'vue';
import { MsgSuccess } from '@/utils/message';
import { Website } from '@/types/website';
import { getRandomStr } from '@/utils/id';
import { rpc } from '@/lib/rpc';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElFormItem } from 'element-plus';
import { ElAlert } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
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
        const proxyForm = ref<FormInstance>();
        const rules = ref({
            username: [Rules.requiredInput, Rules.name],
            password: [Rules.requiredInput, Rules.authBasicPassword],
            name: [Rules.requiredInput],
            path: [Rules.requiredInput],
        });
        const open = ref(false);
        const loading = ref(false);
        const initData = (): Website.NginxAuthConfig => ({
            websiteID: 0,
            operate: 'create',
            username: '',
            password: '',
            remark: '',
            scope: 'root',
            path: '',
        });
        let authBasic = ref(initData());
        const handleClose = () => {
            proxyForm.value?.resetFields();
            open.value = false;
            ctx.emit('close', false);
        };
        const random = async () => {
            authBasic.value.password = getRandomStr(16);
        };
        const acceptParams = (proxyParam: Website.NginxAuthConfig) => {
            authBasic.value = proxyParam;
            open.value = true;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate(async (valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;
                try {
                    if (authBasic.value.scope == 'root') {
                        await rpc.website.updateAuth(authBasic.value as any);
                    } else {
                        const req = {
                            websiteID: authBasic.value.websiteID,
                            path: authBasic.value.path,
                            name: authBasic.value.name,
                            username: authBasic.value.username,
                            password: authBasic.value.password,
                            operate: authBasic.value.operate,
                            remark: authBasic.value.remark,
                        };
                        await rpc.website.updatePathAuth(req as any);
                    }
                    if (authBasic.value.operate == 'create') {
                        MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                    } else {
                        MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    }
                    handleClose();
                } catch (error) {
                } finally {
                    loading.value = false;
                }
            });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                header={$t('commons.button.' + unref(authBasic).operate)}
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
                            {withDirectives(
                                <ElButton
                                    type="primary"
                                    onClick={($event?: any) => {
                                        submit(unref(proxyForm));
                                    }}
                                    disabled={unref(loading)}
                                >
                                    {$t('commons.button.confirm')}
                                </ElButton>,
                                [[permissionDirective, true]],
                            )}
                        </>
                    ),
                }}
            >
                <ElFormItem>
                    {unref(authBasic).operate === 'edit' ? (
                        <ElAlert title={$t('website.editBasicAuthHelper')} type="info" closable={false} />
                    ) : null}
                </ElFormItem>
                <ElForm ref={proxyForm} label-position="top" model={unref(authBasic)} rules={unref(rules)}>
                    {unref(authBasic).scope != 'root' ? (
                        <ElFormItem label={$t('commons.table.name')} prop="name">
                            <ElInput
                                modelValue={unref(authBasic).name}
                                onUpdate:modelValue={($v) => {
                                    unref(authBasic).name = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                                disabled={unref(authBasic).operate === 'edit'}
                            />
                        </ElFormItem>
                    ) : null}
                    {unref(authBasic).scope != 'root' ? (
                        <ElFormItem label={$t('website.path')} prop="path">
                            <ElInput
                                modelValue={unref(authBasic).path}
                                onUpdate:modelValue={($v) => {
                                    unref(authBasic).path = typeof $v === 'string' ? $v.trim() : $v;
                                }}
                                disabled={unref(authBasic).operate === 'edit'}
                            />
                        </ElFormItem>
                    ) : null}
                    <ElFormItem label={$t('commons.login.username')} prop="username">
                        <ElInput
                            modelValue={unref(authBasic).username}
                            onUpdate:modelValue={($v) => {
                                unref(authBasic).username = typeof $v === 'string' ? $v.trim() : $v;
                            }}
                            disabled={unref(authBasic).scope == 'root' && unref(authBasic).operate === 'edit'}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('commons.login.password')} prop="password">
                        <ElInput
                            type="password"
                            clearable
                            show-password
                            modelValue={unref(authBasic).password}
                            onUpdate:modelValue={($v) => {
                                unref(authBasic).password = typeof $v === 'string' ? $v.trim() : $v;
                            }}
                            v-slots={{
                                append: () => (
                                    <>
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (random as any)($event);
                                            }}
                                        >
                                            {$t('commons.button.random')}
                                        </ElButton>
                                    </>
                                ),
                            }}
                        />
                    </ElFormItem>
                    <ElFormItem label={$t('website.remark')} prop="remark">
                        <ElInput
                            modelValue={unref(authBasic).remark}
                            onUpdate:modelValue={($v) => {
                                unref(authBasic).remark = typeof $v === 'string' ? $v.trim() : $v;
                            }}
                        />
                    </ElFormItem>
                </ElForm>
            </DrawerPro>
        );
    },
    options,
);
