import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import CodemirrorPro from '@/components/codemirror-pro/index';
import { rpc } from '@/lib/rpc';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'file',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const proxyForm = ref<FormInstance>();
        const open = ref(false);
        const loading = ref(false);
        const handleClose = () => {
            proxyForm.value?.resetFields();
            open.value = false;
            ctx.emit('close', false);
        };
        const req = reactive({
            name: '',
            websiteID: 0,
            content: '',
        });
        const acceptParams = async (proxyreq: any) => {
            req.name = proxyreq.name;
            req.websiteID = proxyreq.websiteID;
            req.content = proxyreq.content;
            open.value = true;
        };
        const submit = async () => {
            loading.value = true;
            rpc.website
                .updateRedirectFile(req as any)
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    handleClose();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={$t('website.sourceFile')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="normal"
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
                                {
                                    <ElButton
                                        type="primary"
                                        onClick={($event?: any) => {
                                            submit();
                                        }}
                                        disabled={unref(loading)}
                                        v-permission={true}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>
                                }
                            </span>
                        </>
                    ),
                }}
            >
                <CodemirrorPro v-model={req.content} mode="nginx" />
            </DrawerPro>
        );
    },
    options,
);
