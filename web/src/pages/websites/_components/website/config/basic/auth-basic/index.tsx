import { $t } from '@/utils/i18n-t';
import { Website } from '@/types/website';
import i18n from '@/lang';
import Create from './create/index';
import { MsgSuccess } from '@/utils/message';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';
import ComplexTable from '@/components/table/complex/ComplexTable';
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
        const data = ref([]);
        const createRef = ref();
        const enable = ref(false);
        const opRef = ref();
        const pathData = ref([]);
        const showPath = ref(false);
        const buttons = [
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                click: function (row: Website.NginxAuthConfig) {
                    row.scope = 'root';
                    openEdit(row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Website.NginxAuthConfig) {
                    deleteAuth(row);
                },
            },
        ];
        const pathButtons = [
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                click: function (row: Website.NginxAuthConfig) {
                    row.scope = 'path';
                    openEdit(row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Website.NginxPathAuthConfig) {
                    deletePathAuth(row);
                },
            },
        ];
        const initData = (id: number): Website.NginxAuthConfig => ({
            websiteID: id,
            operate: 'create',
            username: '',
            password: '',
            remark: '',
            scope: 'root',
        });
        const openCreate = (scope: string) => {
            let req = initData(id.value);
            req.scope = scope;
            createRef.value.acceptParams(req);
        };
        const openEdit = (authConfig: Website.NginxAuthConfig) => {
            let authParam = JSON.parse(JSON.stringify(authConfig));
            authParam.operate = 'edit';
            authParam.websiteID = id.value;
            createRef.value.acceptParams(authParam);
        };
        const deleteAuth = async (authConfig: Website.NginxAuthConfig) => {
            authConfig.operate = 'delete';
            authConfig.websiteID = id.value;
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: [authConfig.username],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('website.basicAuth'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: any) => rpc.website.updateAuth(params),
                params: authConfig,
            });
        };
        const deletePathAuth = async (authConfig: Website.NginxPathAuthConfig) => {
            authConfig.operate = 'delete';
            authConfig.websiteID = id.value;
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: [authConfig.name],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('website.basicAuth'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: any) => rpc.website.updatePathAuth(params),
                params: authConfig,
            });
        };
        const changeEnable = () => {
            const req = initData(id.value);
            req.operate = enable.value ? 'enable' : 'disable';
            loading.value = true;
            rpc.website
                .updateAuth(req as any)
                .then(() => {
                    MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
                    search();
                })
                .finally(() => {
                    loading.value = false;
                });
        };
        const search = async () => {
            try {
                loading.value = true;
                const res = await rpc.website.getAuth({ websiteId: id.value });
                data.value = res.items as any;
                enable.value = res.enable;
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const searchPath = async () => {
            try {
                loading.value = true;
                const res = await rpc.website.getPathAuth({ websiteId: id.value });
                pathData.value = res.items as any;
            } catch (error) {
            } finally {
                loading.value = false;
            }
        };
        const searchAll = () => {
            search();
            searchPath();
        };
        const getSiteDetail = async () => {
            (rpc.website.getWebsite({ id: id.value }) as Promise<any>).then(async (res) => {
                showPath.value = res.data.type !== 'proxy' && res.data.type !== 'deployment';
            });
        };
        onMounted(() => {
            getSiteDetail();
            searchAll();
        });
        return () => (
            <>
                <ElTabs
                    type="border-card"
                    onTabChange={($event?: any) => {
                        searchAll();
                    }}
                >
                    <ElTabPane label={$t('website.global')}>
                        {withDirectives(
                            <ComplexTable
                                data={unref(data)}
                                onSearch={($event?: any) => {
                                    (search as any)($event);
                                }}
                                heightDiff={420}
                                v-slots={{
                                    toolbar: () => (
                                        <>
                                            {withDirectives(
                                                <ElButton
                                                    type="primary"
                                                    plain
                                                    onClick={($event?: any) => {
                                                        openCreate('root');
                                                    }}
                                                >
                                                    {$t('commons.button.create')}
                                                </ElButton>,
                                                [[permissionDirective, true]],
                                            )}
                                            {withDirectives(
                                                <ElSwitch
                                                    modelValue={unref(enable)}
                                                    onUpdate:modelValue={($v) => {
                                                        enable.value = $v as any;
                                                    }}
                                                    onChange={($event?: any) => {
                                                        (changeEnable as any)($event);
                                                    }}
                                                    disabled={unref(data).length === 0}
                                                    class={'ml-5'}
                                                />,
                                                [[permissionDirective, true]],
                                            )}
                                        </>
                                    ),
                                }}
                            >
                                <ElTableColumn label={$t('commons.login.username')} prop="username" />
                                <ElTableColumn label={$t('website.remark')} prop="remark" />
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
                    </ElTabPane>
                    {unref(showPath) ? (
                        <ElTabPane label={$t('website.path')}>
                            {withDirectives(
                                <ComplexTable
                                    data={unref(pathData)}
                                    onSearch={($event?: any) => {
                                        (searchPath as any)($event);
                                    }}
                                    heightDiff={420}
                                    v-slots={{
                                        toolbar: () => (
                                            <>
                                                {withDirectives(
                                                    <ElButton
                                                        type="primary"
                                                        plain
                                                        onClick={($event?: any) => {
                                                            openCreate('path');
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
                                    <ElTableColumn label={$t('commons.table.name')} prop="name" />
                                    <ElTableColumn label={$t('website.path')} prop="path" />
                                    <ElTableColumn label={$t('commons.login.username')} prop="username" />
                                    <ElTableColumn label={$t('website.remark')} prop="remark" />
                                    <FuTableOperations
                                        ellipsis={10}
                                        width="260px"
                                        buttons={pathButtons}
                                        label={$t('commons.table.operate')}
                                        fixed={unref(isMobile) ? false : 'right'}
                                        fix
                                    />
                                </ComplexTable>,
                                [[vLoading, unref(loading)]],
                            )}
                        </ElTabPane>
                    ) : null}
                </ElTabs>
                <Create
                    ref={createRef}
                    onClose={($event?: any) => {
                        searchAll();
                    }}
                />
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        (searchAll as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
