import { $t } from '@/utils/i18n-t';
import { Website } from '@/types/website';
import { rpc } from '@/lib/rpc';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import Create from './create/index';
import File from './file/index';
import Cache from './cache/index';
import { useGlobalStore } from '@/composables/useGlobalStore';
import permissionDirective from '@/directives/modules/permission';
import ComplexTable from '@/components/table/complex/ComplexTable';
import Status from '@/components/status/index';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'Proxy',
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
        const { isMobile } = useGlobalStore();
        const id = computed(() => {
            return __panelSetupProps.id;
        });
        const loading = ref(false);
        const data = ref();
        const createRef = ref();
        const fileRef = ref();
        const opRef = ref();
        const cacheRef = ref();
        const hasCache = ref(false);
        const buttons = [
            {
                label: i18n.global.t('website.sourceFile'),
                permission: true,
                click: function (row: Website.ProxyConfig) {
                    openEditFile(row);
                },
                disabled: (row: Website.ProxyConfig) => {
                    return !row.enable;
                },
            },
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                disabled: (row: Website.ProxyConfig) => {
                    return !row.enable;
                },
                click: function (row: Website.ProxyConfig) {
                    openEdit(row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Website.ProxyConfig) {
                    deleteProxy(row);
                },
            },
        ];
        const initData = (id: number): Website.ProxyConfig => ({
            id: id,
            operate: 'create',
            enable: true,
            cache: false,
            cacheTime: 0,
            cacheUnit: '',
            name: '',
            modifier: '',
            match: '/',
            proxyPass: 'http://',
            proxyHost: '$host',
            replaces: {},
            proxySSLName: '',
            serverCacheTime: 10,
            serverCacheUnit: 'm',
            cors: false,
            allowOrigins: '',
            allowMethods: '',
            allowHeaders: '',
            allowCredentials: false,
            preflight: false,
        });
        const openCreate = () => {
            createRef.value.acceptParams(initData(id.value));
        };
        const openCache = () => {
            cacheRef.value.acceptParams(id.value, hasCache.value);
        };
        const openEdit = (proxyConfig: Website.ProxyConfig) => {
            let proxy = JSON.parse(JSON.stringify(proxyConfig));
            proxy.operate = 'edit';
            if (proxy.replaces == null) {
                proxy.replaces = {};
            }
            createRef.value.acceptParams(proxy);
        };
        const openEditFile = (proxyConfig: Website.ProxyConfig) => {
            fileRef.value.acceptParams({
                name: proxyConfig.name,
                content: proxyConfig.content,
                websiteID: proxyConfig.id,
            });
        };
        const deleteProxy = async (proxyConfig: Website.ProxyConfig) => {
            proxyConfig.operate = 'delete';
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: [proxyConfig.name],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('website.proxy'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { id: number; name: string }) => rpc.website.deleteProxy(params),
            });
        };
        const submit = async (proxyConfig: Website.ProxyStatusUpdate) => {
            loading.value = true;
            rpc.website
                .updateProxyStatus(proxyConfig as any)
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    search();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const opProxy = (proxyConfig: Website.ProxyConfig) => {
            const enable = !proxyConfig.enable;
            let status = '';
            let message = '';
            if (enable) {
                status = 'enable';
                message = i18n.global.t('website.startProxy');
            } else {
                status = 'disable';
                message = i18n.global.t('website.stopProxy');
            }
            ElMessageBox.confirm(message, i18n.global.t('cronjob.changeStatus'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            })
                .then(async () => {
                    await submit({
                        id: proxyConfig.id,
                        name: proxyConfig.name,
                        status,
                    });
                    search();
                })
                .catch(() => {});
        };
        const search = async () => {
            try {
                loading.value = true;
                const res = await rpc.website.getProxies({ id: id.value });
                data.value = res.items || [];
                hasCache.value = data.value.some((item: any) => item.cache);
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const clear = () => {
            ElMessageBox.confirm(i18n.global.t('nginx.clearProxyCacheWarn'), i18n.global.t('nginx.clearProxyCache'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            }).then(async () => {
                await rpc.website.clearProxyCache({ websiteId: id.value });
                MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
            });
        };
        onMounted(() => {
            search();
        });
        return () => (
            <>
                {withDirectives(
                    <ComplexTable
                        data={unref(data)}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        v-slots={{
                            toolbar: () => (
                                <>
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            plain
                                            onClick={($event?: any) => {
                                                (openCreate as any)($event);
                                            }}
                                        >
                                            {$t('commons.button.create')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                    {withDirectives(
                                        <ElButton
                                            onClick={($event?: any) => {
                                                (openCache as any)($event);
                                            }}
                                        >
                                            {$t('website.proxyCache')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                    {withDirectives(
                                        <ElButton
                                            type="primary"
                                            onClick={($event?: any) => {
                                                (clear as any)($event);
                                            }}
                                            link
                                        >
                                            {$t('nginx.clearProxyCache')}
                                        </ElButton>,
                                        [[permissionDirective, true]],
                                    )}
                                </>
                            ),
                        }}
                    >
                        <ElTableColumn label={$t('commons.table.name')} prop="name" />
                        <ElTableColumn label={$t('website.proxyPath')} prop="match" />
                        <ElTableColumn label={$t('website.proxyPass')} prop="proxyPass" />
                        <ElTableColumn
                            label={$t('website.cache')}
                            prop="cache"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {row.cacheTime != 0 ? (
                                            <ElTag type={row.cacheTime > 0 ? 'success' : 'info'} class={'mr-2'}>
                                                {$t('website.browserCache') + ':'}
                                                {row.cacheTime > 0
                                                    ? row.cacheTime + row.cacheUnit
                                                    : $t('setting.sslDisable')}
                                            </ElTag>
                                        ) : null}
                                        <ElTag type={row.serverCacheTime > 0 ? 'success' : 'info'}>
                                            {$t('website.serverCache') + ':'}
                                            {row.serverCacheTime > 0
                                                ? row.serverCacheTime + row.serverCacheUnit
                                                : $t('setting.sslDisable')}
                                        </ElTag>
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label={$t('commons.table.status')}
                            prop="enable"
                            width="100"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {withDirectives(
                                            <Status
                                                status={row.enable ? 'enable' : 'disable'}
                                                onClick={($event?: any) => {
                                                    opProxy(row);
                                                }}
                                                operate={true}
                                            />,
                                            [[permissionDirective, true]],
                                        )}
                                    </>
                                ),
                            }}
                        />
                        <FuTableOperations
                            ellipsis={10}
                            width="260px"
                            buttons={buttons}
                            label={$t('commons.table.operate')}
                            fixed={unref(isMobile) ? false : 'right'}
                            fix
                        />
                    </ComplexTable>,
                    [[vLoading, unref(loading)]],
                )}
                <Create
                    ref={createRef}
                    onClose={($event?: any) => {
                        search();
                    }}
                />
                <File
                    ref={fileRef}
                    onClose={($event?: any) => {
                        search();
                    }}
                />
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        search();
                    }}
                />
                <Cache
                    ref={cacheRef}
                    onClose={($event?: any) => {
                        search();
                    }}
                />
            </>
        );
    },
    options,
);
