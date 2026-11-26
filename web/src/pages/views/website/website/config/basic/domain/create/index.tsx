import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import DomainCreate from '@/pages/views/website/website/domain-create/index';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';
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
        const domainForm = ref<FormInstance>();
        const initDomain = () => ({
            domain: '',
            port: 80,
            ssl: false,
        });
        const open = ref(false);
        const loading = ref(false);
        const create = ref({
            websiteID: 0,
            domains: [initDomain()],
            domainStr: '',
        });
        const handleClose = () => {
            domainForm.value?.resetFields();
            open.value = false;
            ctx.emit('close', false);
        };
        const acceptParams = async (websiteId: number) => {
            create.value.websiteID = Number(websiteId);
            create.value.domains = [initDomain()];
            create.value.domainStr = '';
            open.value = true;
        };
        const submit = async (formEl: FormInstance | undefined) => {
            if (!formEl) return;
            await formEl.validate((valid) => {
                if (!valid) {
                    return;
                }
                loading.value = true;
                rpc.website
                    .createDomains(create.value as any)
                    .then(() => {
                        MsgSuccess(i18n.global.t('commons.msg.createSuccess'));
                        handleClose();
                    })
                    .finally(() => {
                        loading.value = false;
                    });
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
                header={$t('website.addDomain')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                v-slots={{
                    footer: () => (
                        <>
                            <span class={'dialog-footer'}>
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
                                            submit(unref(domainForm));
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[permissionDirective, true]],
                                )}
                            </span>
                        </>
                    ),
                }}
            >
                <ElForm ref={domainForm} label-position="top" model={unref(create)}>
                    <DomainCreate
                        form={unref(create)}
                        onUpdate:form={($v) => {
                            create.value = $v as any;
                        }}
                        onGengerate={($event?: any) => {
                            unref(domainForm).clearValidate();
                        }}
                    />
                </ElForm>
            </DrawerPro>
        );
    },
    options,
);
