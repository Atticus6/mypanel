import { $t } from '@/utils/i18n-t';
import { Website } from '@/types/website';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { rpc } from '@/lib/rpc';
interface RenewProps {
    ssl: Website.SSL;
}
import permissionDirective from '@/directives/modules/permission';
import DialogPro from '@/components/dialog-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
    submit: (...args: unknown[]) => true,
};

const options = {
    name: 'obtain',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const loading = ref(false);
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
        };
        const ssl = ref();
        const acceptParams = async (__panelSetupProps: RenewProps) => {
            ssl.value = __panelSetupProps.ssl;
            open.value = true;
        };
        const submit = async () => {
            loading.value = true;
            try {
                if (ssl.value.provider == 'selfSigned') {
                    await rpc.ssl.renewCA({ sslId: ssl.value.id });
                } else {
                    await rpc.ssl.apply({ id: ssl.value.id });
                }
                handleClose();
                MsgSuccess(i18n.global.t('ssl.applyStart'));
                loading.value = false;
                ctx.emit('submit', ssl.value.id);
            } catch (error) {}
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DialogPro
                modelValue={unref(open)}
                onUpdate:modelValue={($v) => {
                    open.value = $v as any;
                }}
                title={$t('ssl.apply')}
                size="small"
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
                                            submit();
                                        }}
                                        disabled={unref(loading)}
                                    >
                                        {$t('commons.button.confirm')}
                                    </ElButton>,
                                    [[permissionDirective, 'website_cert_manage']],
                                )}
                            </span>
                        </>
                    ),
                }}
            >
                {withDirectives(
                    <div class={'text-center'}>
                        {unref(ssl).websites && unref(ssl).websites.length > 0 ? (
                            <div>
                                <span>{$t('ssl.renewWebsite')}</span>
                                <div>
                                    <br />
                                    <span>
                                        {(unref(ssl).websites || []).map((website, index) => (
                                            <span key={index}>
                                                <ElTag type="info">{website.primaryDomain}</ElTag>
                                            </span>
                                        ))}
                                    </span>
                                </div>
                                <br />
                            </div>
                        ) : null}
                        <span>{$t('ssl.renewConfirm', [unref(ssl).primaryDomain])}</span>
                    </div>,
                    [[vLoading, unref(loading)]],
                )}
            </DialogPro>
        );
    },
    options,
);
