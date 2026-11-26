import { $t } from '@/utils/i18n-t';
import { Website } from '@/types/website';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { ref } from 'vue';
import { rpc } from '@/lib/rpc';
interface RenewProps {
    ssl: Website.SSL;
}
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { ElAlert } from 'element-plus';
import { ElTable } from 'element-plus';
import { ElTableColumn } from 'element-plus';
import { ElButton } from 'element-plus';
import DialogPro from '@/components/dialog-pro/index';
import CopyButton from '@/components/copy-button/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
    submit: (...args: unknown[]) => true,
};

const options = {
    name: 'apply',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const loading = ref(false);
        const dnsResolve = ref<Website.DNSResolve[]>([]);
        const sslID = ref(0);
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', false);
        };
        const acceptParams = async (__panelSetupProps: RenewProps) => {
            open.value = true;
            dnsResolve.value = [];
            sslID.value = __panelSetupProps.ssl.id;
            getDnsResolveRes(__panelSetupProps.ssl);
        };
        const getDnsResolveRes = async (row: Website.SSL) => {
            loading.value = true;
            try {
                const res = await rpc.ssl.getDNSResolve({ acmeAccountId: row.acmeAccountId, websiteSslId: row.id });
                dnsResolve.value = res.items as any;
            } finally {
                loading.value = false;
            }
        };
        const submit = () => {
            rpc.ssl
                .apply({ id: sslID.value })
                .then(() => {
                    MsgSuccess(i18n.global.t('ssl.applyStart'));
                    handleClose();
                    ctx.emit('submit', sslID.value);
                })
                .finally(() => {});
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
                size="large"
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
                {unref(loading) ? (
                    <div>
                        <ElAlert type="info" closable={false} center>
                            {$t('ssl.getDnsResolve')}
                        </ElAlert>
                    </div>
                ) : null}
                {unref(dnsResolve).length > 0 ? (
                    <div>
                        <span>{$t('ssl.dnsResolveHelper')}</span>
                        <ElTable data={unref(dnsResolve)} border table-layout={'auto'}>
                            <ElTableColumn prop="domain" label={$t('website.domain')} />
                            <ElTableColumn
                                prop="resolve"
                                label={$t('ssl.resolveDomain')}
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            <span>{row.resolve}</span>
                                            <CopyButton content={row.resolve} />
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn
                                prop="value"
                                label={$t('ssl.value')}
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            <span>{row.value}</span>
                                            <CopyButton content={row.value} />
                                        </>
                                    ),
                                }}
                            />
                            <ElTableColumn label={$t('commons.table.type')}>{'TXT'}</ElTableColumn>
                        </ElTable>
                    </div>
                ) : null}
            </DialogPro>
        );
    },
    options,
);
