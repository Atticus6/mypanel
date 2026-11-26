import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import bus from '@/global/bus';
import './index.styles.css';
import DrawerPro from '@/components/drawer-pro/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {
    close: (...args: unknown[]) => true,
};

const options = {
    name: 'ignore',
    props: {},
    emits: emits,
    __scopeId: 'data-v-f7b94c24',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const open = ref(false);
        const loading = ref(false);
        const apps = ref();
        const handleClose = () => {
            open.value = false;
            ctx.emit('close', open.value);
        };
        const acceptParams = () => {
            open.value = true;
            getApps();
        };
        const getApps = async () => {
            try {
                const res = await rpc.app.listIgnoredApps({});
                apps.value = res.items.map((i) => ({
                    id: i.id,
                    name: i.name,
                    detailID: i.appDetailId,
                    version: i.version,
                    scope: i.scope,
                }));
            } catch (error) {}
        };
        const cancelIgnore = async (id: number) => {
            loading.value = true;
            await rpc.app
                .cancelIgnoreAppUpgrade({ id })
                .then(() => {
                    bus.emit('upgrade', true);
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .finally(() => {
                    getApps();
                    loading.value = false;
                });
        };
        ctx.expose({
            acceptParams,
        });
        return () => (
            <DrawerPro
                v-model={open.value}
                header={$t('app.ignoreList')}
                onClose={($event?: any) => {
                    (handleClose as any)($event);
                }}
                size="small"
                v-slots={{
                    content: () => (
                        <>
                            <ElTable data={unref(apps)}>
                                <ElTableColumn prop="name" label={$t('app.app')} />
                                <ElTableColumn
                                    prop="scope"
                                    label={$t('license.trialInfo')}
                                    v-slots={{
                                        default: ({ row }) => (
                                            <>
                                                {row.version != '' ? (
                                                    <ElTag>{row.version}</ElTag>
                                                ) : (
                                                    <ElTag>{$t('commons.table.all') + $t('app.version')}</ElTag>
                                                )}
                                            </>
                                        ),
                                    }}
                                />
                                <ElTableColumn
                                    prop="scope"
                                    label={$t('commons.table.operate')}
                                    v-slots={{
                                        default: ({ row }) => (
                                            <>
                                                {
                                                    <ElButton
                                                        type="primary"
                                                        link
                                                        onClick={($event?: any) => {
                                                            cancelIgnore(row.id);
                                                        }}
                                                        v-permission={true}
                                                    >
                                                        {$t('app.cancelIgnore')}
                                                    </ElButton>
                                                }
                                            </>
                                        ),
                                    }}
                                />
                            </ElTable>
                        </>
                    ),
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
                            </span>
                        </>
                    ),
                }}
            />
        );
    },
    options,
);
