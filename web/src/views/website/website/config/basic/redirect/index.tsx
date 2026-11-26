import { $t } from '@/utils/i18n-t';
import { Website } from '@/types/website';
import { rpc } from '@/lib/rpc';
import { computed, onMounted, ref } from 'vue';
import Create from './create/index';
import File from './file/index';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { ElMessageBox } from 'element-plus';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { vLoading } from 'element-plus';
import permissionDirective from '@/directives/modules/permission';
import { ElButton } from 'element-plus';
import { ElTableColumn } from 'element-plus';
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
        const buttons = [
            {
                label: i18n.global.t('website.sourceFile'),
                permission: true,
                click: function (row: Website.RedirectConfig) {
                    openEditFile(row);
                },
                disabled: (row: Website.RedirectConfig) => {
                    return !row.enable;
                },
            },
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                disabled: (row: Website.ProxyConfig) => {
                    return !row.enable;
                },
                click: function (row: Website.RedirectConfig) {
                    openEdit(row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Website.RedirectConfig) {
                    deleteProxy(row);
                },
            },
        ];
        const initData = (id: number): Website.RedirectConfig => ({
            websiteID: id,
            operate: 'create',
            enable: true,
            name: '',
            domains: [],
            keepPath: true,
            type: '',
            redirect: '',
            target: '',
        });
        const openCreate = () => {
            createRef.value.acceptParams(initData(id.value));
        };
        const openEdit = (proxyConfig: Website.RedirectConfig) => {
            let proxy = JSON.parse(JSON.stringify(proxyConfig));
            proxy.operate = 'edit';
            createRef.value.acceptParams(proxy);
        };
        const openEditFile = (proxyConfig: Website.RedirectConfig) => {
            fileRef.value.acceptParams({
                name: proxyConfig.name,
                content: proxyConfig.content,
                websiteID: proxyConfig.websiteID,
            });
        };
        const toRedirectRequest = (item: Website.RedirectConfig) => ({
            websiteId: item.websiteID,
            name: item.name,
            domains: item.domains || [],
            keepPath: item.keepPath ?? false,
            enable: item.enable ?? false,
            type: item.type || 'domain',
            redirect: item.redirect || '301',
            path: item.path || '',
            target: item.target || '',
            operate: item.operate || 'update',
            redirectRoot: item.redirectRoot ?? false,
        });
        const deleteProxy = async (redirectConfig: Website.RedirectConfig) => {
            redirectConfig.operate = 'delete';
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: [redirectConfig.name],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('website.redirect'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: Website.RedirectConfig) => rpc.website.updateRedirect(toRedirectRequest(params)),
                params: redirectConfig,
            });
        };
        const submit = async (redirectConfig: Website.RedirectConfig) => {
            loading.value = true;
            await rpc.website
                .updateRedirect(toRedirectRequest(redirectConfig))
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    search();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const opProxy = (redirectConfig: Website.RedirectConfig) => {
            let proxy = JSON.parse(JSON.stringify(redirectConfig));
            proxy.enable = !redirectConfig.enable;
            let message = '';
            if (proxy.enable) {
                proxy.operate = 'enable';
                message = i18n.global.t('commons.button.start') + i18n.global.t('website.redirect');
            } else {
                proxy.operate = 'disable';
                message = i18n.global.t('commons.button.stop') + i18n.global.t('website.redirect');
            }
            ElMessageBox.confirm(message, i18n.global.t('cronjob.changeStatus'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
            })
                .then(async () => {
                    await submit(proxy);
                })
                .catch(() => {});
        };
        const search = async () => {
            try {
                loading.value = true;
                const res = await rpc.website.getRedirect({ id: id.value });
                data.value = res.items || [];
            } catch (error) {
            } finally {
                loading.value = false;
            }
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
                                </>
                            ),
                        }}
                    >
                        <ElTableColumn
                            label={$t('commons.table.name')}
                            prop="name"
                            min-width="60px"
                            show-overflow-tooltip
                        />
                        <ElTableColumn
                            label={$t('website.sourceDomain')}
                            prop="domain"
                            min-width="80px"
                            show-overflow-tooltip
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {row.type === 'domain' ? (
                                            <span>{row.domains.join(',')}</span>
                                        ) : (
                                            <span>{row.path}</span>
                                        )}
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label={$t('commons.table.type')}
                            prop="type"
                            min-width="60px"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {row.type && row.type != 404 ? (
                                            <span>{$t('website.' + row.type)}</span>
                                        ) : (
                                            <span>{404}</span>
                                        )}
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn label={$t('website.redirectWay')} prop="redirect" min-width="50px" />
                        <ElTableColumn
                            label={$t('website.targetURL')}
                            prop="target"
                            min-width="100px"
                            show-overflow-tooltip
                        />
                        <ElTableColumn
                            label={$t('website.keepPath')}
                            prop="keepPath"
                            min-width="80px"
                            show-overflow-tooltip
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {row.type != '404' ? (
                                            <span>{row.keepPath ? $t('website.keep') : $t('website.notKeep')}</span>
                                        ) : (
                                            <span />
                                        )}
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label={$t('commons.table.status')}
                            prop="enable"
                            min-width="50px"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {withDirectives(
                                            <Status
                                                status={row.enable ? 'enable' : 'disable'}
                                                onClick={($event?: any) => {
                                                    opProxy(row);
                                                }}
                                            />,
                                            [[permissionDirective, true]],
                                        )}
                                    </>
                                ),
                            }}
                        />
                        <FuTableOperations
                            ellipsis={10}
                            width="180px"
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
            </>
        );
    },
    options,
);
