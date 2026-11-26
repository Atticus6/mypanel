import { $t } from '@/utils/i18n-t';
import { reactive, ref } from 'vue';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
import { ElMessageBox, FormInstance } from 'element-plus';
interface DialogProps {
    bindDomain: string;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import { ElForm } from 'element-plus';
import { ElFormItem } from 'element-plus';
import { ElInput } from 'element-plus';
import { ElButton } from 'element-plus';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    search: () => true,
};

const options = {
    name: 'domain',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const drawerVisible = ref();
        const loading = ref();
        const form = reactive({
            bindDomain: '',
        });
        const rules = reactive({
            bindDomain: [{ validator: checkSecurityEntrance, trigger: 'blur' }],
        });
        function checkSecurityEntrance(rule: any, value: any, callback: any) {
            if (form.bindDomain !== '') {
                const reg =
                    /^([\w\u4e00-\u9fa5\-\*]{1,100}\.){1,10}([\w\u4e00-\u9fa5\-]{1,24}|[\w\u4e00-\u9fa5\-]{1,24}\.[\w\u4e00-\u9fa5\-]{1,24})$/;
                if (!reg.test(form.bindDomain)) {
                    return callback(new Error(i18n.global.t('commons.rule.domain')));
                }
            }
            callback();
        }
        const formRef = ref<FormInstance>();
        const acceptParams = (params: DialogProps): void => {
            form.bindDomain = params.bindDomain;
            drawerVisible.value = true;
        };
        const onSavePort = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            formEl.validate(async (valid) => {
                if (!valid) return;
                let title = form.bindDomain
                    ? i18n.global.t('setting.bindDomain')
                    : i18n.global.t('setting.unBindDomain');
                let helper = form.bindDomain
                    ? i18n.global.t('setting.bindDomainWarning')
                    : i18n.global.t('setting.unBindDomainHelper');
                ElMessageBox.confirm(helper, title, {
                    confirmButtonText: i18n.global.t('commons.button.confirm'),
                    cancelButtonText: i18n.global.t('commons.button.cancel'),
                    type: 'info',
                }).then(async () => {
                    loading.value = true;
                    await rpc.core.setting
                        .updateSetting({ key: 'BindDomain', value: form.bindDomain })
                        .then(() => {
                            loading.value = false;
                            MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                            if (form.bindDomain) {
                                let href = window.location.href;
                                let ipLocal = href.split('//')[1].split(':')[0];
                                href = href.replaceAll(ipLocal, form.bindDomain);
                                window.open(href, '_self');
                            } else {
                                handleClose();
                                ctx.emit('search');
                            }
                        })
                        .catch(() => {
                            loading.value = false;
                        });
                });
            });
        };
        const handleClose = () => {
            drawerVisible.value = false;
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                modelValue={unref(drawerVisible)}
                onUpdate:modelValue={($v) => {
                    drawerVisible.value = $v as any;
                }}
                header={$t('setting.bindDomain')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    footer: () => (
                        <>
                            <ElButton
                                onClick={($event?: any) => {
                                    drawerVisible.value = false;
                                }}
                            >
                                {$t('commons.button.cancel')}
                            </ElButton>
                            <ElButton
                                disabled={unref(loading)}
                                type="primary"
                                onClick={($event?: any) => {
                                    onSavePort(unref(formRef));
                                }}
                            >
                                {$t('commons.button.confirm')}
                            </ElButton>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <ElForm
                        ref={formRef}
                        label-position="top"
                        rules={rules}
                        model={form}
                        onSubmit={($event?: any) => {
                            $event.preventDefault();
                        }}
                    >
                        <ElFormItem label={$t('setting.bindDomain')} prop="bindDomain">
                            <ElInput
                                clearable
                                modelValue={form.bindDomain}
                                onUpdate:modelValue={($v) => {
                                    form.bindDomain = $v as any;
                                }}
                            />
                            <span class={'input-help'}>{$t('setting.bindDomainHelper1')}</span>
                        </ElFormItem>
                    </ElForm>,
                    [[vLoading, unref(loading)]],
                )}
            </DrawerPro>
        );
    },
    options,
);
