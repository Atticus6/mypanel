import { $t } from '@/utils/i18n-t';
import Domain from './create/index';
import { Website } from '@/types/website';
import i18n from '@/lang';
import { Promotion } from '@element-plus/icons-vue';
import { MsgSuccess } from '@/utils/message';
import { GetPunyCodeDomain, isPunycoded } from '@/utils/misc';
import { useGlobalStore } from '@/composables/useGlobalStore';
import { rpc } from '@/lib/rpc';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'domain',
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
        let loading = ref(false);
        const data = ref<Website.Domain[]>([]);
        const domainRef = ref();
        const website = ref<Website.WebsiteDTO>();
        const opRef = ref();
        const httpPort = ref(80);
        const httpsPort = ref(443);
        const buttons = [
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: function (row: Website.Domain) {
                    deleteWebsiteDomain(row);
                },
                disabled: () => {
                    return data.value.length == 1;
                },
            },
        ];
        const openCreate = () => {
            domainRef.value.acceptParams(id.value);
        };
        const openUrl = (domain: Website.Domain) => {
            const protocol = website.value.protocol.toLowerCase();
            let url = protocol + '://' + domain.domain;
            if (protocol == 'http' && domain.port != 80) {
                url = url + ':' + domain.port;
            }
            if (protocol == 'https') {
                if (httpsPort.value != 443) {
                    url = url + ':' + httpsPort.value;
                }
                if (domain.port != 80) {
                    url = 'http://' + domain.domain + ':' + domain.port;
                }
            }
            window.open(url);
        };
        const deleteWebsiteDomain = async (row: Website.Domain) => {
            opRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: [row.domain],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('website.domain'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { id: number }) => rpc.website.deleteDomain({ id: params.id }),
                params: { id: row.id },
            });
        };
        const search = (id: number) => {
            loading.value = true;
            rpc.website
                .listDomains({ websiteId: id })
                .then((res) => {
                    data.value = res.items;
                })
                .finally(() => {
                    loading.value = false;
                });
            onCheck();
        };
        const get = (id: number) => {
            (rpc.website.getWebsite({ id: id }) as Promise<any>).then((res) => {
                website.value = res.data;
            });
        };
        const onCheck = async () => {
            await rpc.app
                .checkInstalled({ key: 'openresty', name: '' })
                .then((res) => {
                    httpPort.value = res.httpPort;
                    httpsPort.value = res.httpsPort;
                })
                .catch(() => {});
        };
        const update = async (row: Website.Domain) => {
            try {
                await rpc.website.updateDomain({ id: row.id, ssl: row.ssl });
                MsgSuccess(i18n.global.t('commons.msg.updateSuccess'));
            } catch {}
        };
        onMounted(() => {
            search(id.value);
            get(id.value);
        });
        return () => (
            <>
                {
                    <ComplexTable
                        data={unref(data)}
                        onSearch={($event?: any) => {
                            (search as any)($event);
                        }}
                        heightDiff={400}
                        v-slots={{
                            toolbar: () => (
                                <>
                                    {
                                        <ElButton
                                            type="primary"
                                            plain
                                            onClick={($event?: any) => {
                                                (openCreate as any)($event);
                                            }}
                                            v-permission={true}
                                        >
                                            {$t('website.addDomain')}
                                        </ElButton>
                                    }
                                </>
                            ),
                        }}
                        v-loading={unref(loading)}
                    >
                        <ElTableColumn
                            width="30px"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        <ElButton
                                            link
                                            icon={Promotion}
                                            onClick={($event?: any) => {
                                                openUrl(row);
                                            }}
                                        />
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label={$t('website.domain')}
                            prop="domain"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {row.domain}
                                        {isPunycoded(row.domain) ? (
                                            <span class={'text-gray-400'}>
                                                {'('}
                                                {GetPunyCodeDomain(row.domain)}
                                                {')'}
                                            </span>
                                        ) : null}
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn label={$t('commons.table.port')} prop="port" />
                        <ElTableColumn
                            label={'SSL'}
                            prop="ssl"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        {
                                            <ElSwitch
                                                v-model={row.ssl}
                                                onChange={($event?: any) => {
                                                    update(row);
                                                }}
                                                disabled={row.port == 80}
                                                v-permission={true}
                                            />
                                        }
                                    </>
                                ),
                            }}
                        />
                        <FuTableOperations
                            ellipsis={1}
                            buttons={buttons}
                            label={$t('commons.table.operate')}
                            fixed={unref(isMobile) ? false : 'right'}
                            fix
                        />
                    </ComplexTable>
                }
                <Domain
                    ref={domainRef}
                    onClose={($event?: any) => {
                        search(unref(id));
                    }}
                />
                <OpDialog
                    ref={opRef}
                    onSearch={($event?: any) => {
                        search(unref(id));
                    }}
                />
            </>
        );
    },
    options,
);
