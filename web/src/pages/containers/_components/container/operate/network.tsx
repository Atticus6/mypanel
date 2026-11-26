import { $t } from '@/utils/i18n-t';
interface ContainerNetwork {
    network: string;
    ipv4: string;
    ipv6: string;
    macAddr: string;
    links?: Array<string>;
    aliases?: Array<string>;
    driverOpts?: Record<string, string>;
    gwPriority?: number;
    linkLocalIPs?: Array<string>;
}
import { rpc } from '@/lib/rpc';
import ComplexTable from '@/components/table/complex/ComplexTable';

interface CodemodProps {
    [key: string]: any;
    networks?: ContainerNetwork[];
}

const emits = {};

const options = {
    name: 'network',
    props: {
        networks: { type: Array<ContainerNetwork>, default: [] },
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const tmpNetworks = ref<Array<ContainerNetwork>>([]);
        const networkOptions = ref();
        watch(
            () => __panelSetupProps.networks,
            (newVal) => {
                tmpNetworks.value = newVal || [];
                for (const item of tmpNetworks.value) {
                    if (item.network === 'none' || item.network === 'host') {
                        item.ipv4 = '';
                        item.ipv6 = '';
                    }
                }
            },
        );
        const loadNetworkOptions = async () => {
            const res = await rpc.container.listNetworks({});
            networkOptions.value = res.items;
        };
        const handleNetworksAdd = () => {
            const item: ContainerNetwork = {
                network: 'bridge',
                ipv4: '',
                ipv6: '',
                macAddr: '',
                links: [],
                aliases: [],
                driverOpts: {},
                gwPriority: 0,
                linkLocalIPs: [],
            };
            tmpNetworks.value.push(item);
        };
        const handleNetworksDelete = (index: number) => {
            tmpNetworks.value.splice(index, 1);
        };
        const changeNetwork = (row: ContainerNetwork) => {
            row.ipv4 = '';
            row.ipv6 = '';
            row.macAddr = '';
            row.links = [];
            row.aliases = [];
            row.driverOpts = {};
            row.gwPriority = 0;
            row.linkLocalIPs = [];
        };
        const isIpDisabled = (row: ContainerNetwork) => {
            return row.network === 'none' || row.network === 'host' || row.network === 'bridge';
        };
        const loadNetworks = () => {
            return tmpNetworks.value;
        };
        onMounted(() => {
            tmpNetworks.value = __panelSetupProps.networks || [];
            loadNetworkOptions();
        });
        ctx.expose({
            loadNetworks,
        });
        return () => (
            <div>
                {unref(tmpNetworks) ? (
                    <ComplexTable data={unref(tmpNetworks)} style={'width: 100%'}>
                        <ElTableColumn
                            label={$t('container.network')}
                            min-width="200"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        <ElSelect
                                            v-model={row.network}
                                            onChange={($event?: any) => {
                                                changeNetwork(row);
                                            }}
                                        >
                                            {(unref(networkOptions) || []).map((item, indexV) => (
                                                <ElOption value={item.option} label={item.option} key={indexV} />
                                            ))}
                                        </ElSelect>
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label={$t('container.macAddr')}
                            min-width="200"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        <ElInput v-model={row.macAddr} />
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label="IPv4"
                            min-width="200"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        <ElInput
                                            v-model={row.ipv4}
                                            disabled={isIpDisabled(row)}
                                            placeholder={$t('container.inputIpv4')}
                                        />
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            label="IPv6"
                            min-width="200"
                            v-slots={{
                                default: ({ row }) => (
                                    <>
                                        <ElInput
                                            v-model={row.ipv6}
                                            disabled={isIpDisabled(row)}
                                            placeholder={$t('container.inputIpv6')}
                                        />
                                    </>
                                ),
                            }}
                        />
                        <ElTableColumn
                            min-width="80"
                            fixed={'right'}
                            v-slots={{
                                default: (scope) => (
                                    <>
                                        <ElButton
                                            link
                                            type="primary"
                                            onClick={($event?: any) => {
                                                handleNetworksDelete(scope.$index);
                                            }}
                                        >
                                            {$t('commons.button.delete')}
                                        </ElButton>
                                    </>
                                ),
                            }}
                        />
                    </ComplexTable>
                ) : null}
                <ElButton
                    onClick={($event?: any) => {
                        handleNetworksAdd();
                    }}
                    class={'mt-2'}
                >
                    {$t('commons.button.add')}
                </ElButton>
            </div>
        );
    },
    options,
);
