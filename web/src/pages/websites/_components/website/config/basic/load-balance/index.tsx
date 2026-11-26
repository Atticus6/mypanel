import { $t } from '@/utils/i18n-t';
import { rpc } from '@/lib/rpc';
import Operate from './operate/index';
import i18n from '@/lang';
import { Website } from '@/types/website';
import { getAlgorithms } from '@/global/mimetype';
import File from './file/index';
import ComplexTable from '@/components/table/complex/ComplexTable';
import FuTableOperations from '@/components/table/TableOperations';
import OpDialog from '@/components/del-dialog/index';

interface CodemodProps {
    [key: string]: any;
    id?: number;
}

const emits = {};

const options = {
    name: 'load-balance',
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
        const data = ref([]);
        const loading = ref(false);
        const operateRef = ref();
        const delRef = ref();
        const fileRef = ref();
        const Algorithms = getAlgorithms('');
        const buttons = [
            {
                label: i18n.global.t('website.sourceFile'),
                permission: true,
                click: function (row: any) {
                    openEditFile(row);
                },
            },
            {
                label: i18n.global.t('commons.button.edit'),
                permission: true,
                click: (row: any) => {
                    update(row);
                },
            },
            {
                label: i18n.global.t('commons.button.delete'),
                permission: true,
                click: (row: any) => {
                    deleteLb(row);
                },
            },
        ];
        const search = () => {
            rpc.website.getLoadBalances({ id: __panelSetupProps.id }).then((res) => {
                data.value = res.items;
            });
        };
        const getAlgorithm = (key: string) => {
            let label = '';
            Algorithms.forEach((algorithm) => {
                if (algorithm.value === key) {
                    label = algorithm.label;
                }
            });
            if (label === '') {
                return i18n.global.t('commons.table.default');
            }
            return label;
        };
        const deleteLb = async (row: Website.NginxUpstream) => {
            delRef.value.acceptParams({
                title: i18n.global.t('commons.button.delete'),
                names: [row.name],
                msg: i18n.global.t('commons.msg.operatorHelper', [
                    i18n.global.t('website.loadBalance'),
                    i18n.global.t('commons.button.delete'),
                ]),
                api: (params: { websiteId?: number; id?: number; name: string }) =>
                    rpc.website.deleteLoadBalance({
                        websiteId: params.websiteId ?? params.id ?? 0,
                        name: params.name,
                    }),
                params: { id: __panelSetupProps.id, name: row.name },
            });
        };
        const create = () => {
            operateRef.value.acceptParams({
                websiteID: __panelSetupProps.id,
                operate: 'create',
            });
        };
        const update = (row: Website.NginxUpstream) => {
            operateRef.value.acceptParams({
                websiteID: __panelSetupProps.id,
                operate: 'edit',
                upstream: row,
            });
        };
        const openEditFile = (row: Website.NginxUpstream) => {
            fileRef.value.acceptParams({
                websiteID: __panelSetupProps.id,
                name: row.name,
                content: row.content,
            });
        };
        onMounted(() => {
            search();
        });
        return () => (
            <>
                <div>
                    {
                        <ComplexTable
                            data={unref(data)}
                            onSearch={($event?: any) => {
                                (search as any)($event);
                            }}
                            heightDiff={420}
                            v-slots={{
                                toolbar: () => (
                                    <>
                                        {
                                            <ElButton
                                                type="primary"
                                                plain
                                                onClick={($event?: any) => {
                                                    create();
                                                }}
                                                v-permission={true}
                                            >
                                                {$t('commons.button.create')}
                                            </ElButton>
                                        }
                                        <ElAlert
                                            closable={false}
                                            class={'!mt-2'}
                                            v-slots={{
                                                default: () => (
                                                    <>
                                                        <span class={'whitespace-pre-line'}>
                                                            {$t('website.loadBalanceHelper')}
                                                        </span>
                                                    </>
                                                ),
                                            }}
                                        />
                                    </>
                                ),
                            }}
                            v-loading={unref(loading)}
                        >
                            <ElTableColumn label={$t('commons.table.name')} prop="name" />
                            <ElTableColumn
                                label={$t('website.algorithm')}
                                prop="algorithm"
                                v-slots={{ default: ({ row }) => <>{getAlgorithm(row.algorithm)}</> }}
                            />
                            <ElTableColumn
                                label={$t('website.server')}
                                prop="servers"
                                minWidth="400px"
                                v-slots={{
                                    default: ({ row }) => (
                                        <>
                                            <table>
                                                {(row.servers || []).map((item, index) => (
                                                    <tr key={index}>
                                                        <td>
                                                            <ElTag>{item.server}</ElTag>
                                                        </td>
                                                        {item.weight > 0 ? (
                                                            <td>
                                                                <ElTag type="success">
                                                                    {$t('website.weight')}
                                                                    {': '}
                                                                    {item.weight}
                                                                </ElTag>
                                                            </td>
                                                        ) : null}
                                                        {item.failTimeout != '' ? (
                                                            <td>
                                                                <ElTag type="warning">
                                                                    {$t('website.failTimeout')}
                                                                    {': '}
                                                                    {item.failTimeout}
                                                                    {item.failTimeoutUnit}
                                                                </ElTag>
                                                            </td>
                                                        ) : null}
                                                        {item.maxFails > 0 ? (
                                                            <td>
                                                                <ElTag type="danger">
                                                                    {$t('website.maxFails')}
                                                                    {': '}
                                                                    {item.maxFails}
                                                                </ElTag>
                                                            </td>
                                                        ) : null}
                                                        {item.maxConns > 0 ? (
                                                            <td>
                                                                <ElTag>
                                                                    {$t('website.maxConns')}
                                                                    {': '}
                                                                    {item.maxConns}
                                                                </ElTag>
                                                            </td>
                                                        ) : null}
                                                        {item.flag != '' ? (
                                                            <td>
                                                                <ElTag type="info">
                                                                    {$t('website.strategy')}
                                                                    {': '}
                                                                    {item.flag === 'backup' ? (
                                                                        <span>{$t('website.strategyBackup')}</span>
                                                                    ) : null}
                                                                    {item.flag === 'down' ? (
                                                                        <span>{$t('website.strategyDown')}</span>
                                                                    ) : null}
                                                                </ElTag>
                                                            </td>
                                                        ) : null}
                                                    </tr>
                                                ))}
                                            </table>
                                        </>
                                    ),
                                }}
                            />
                            <FuTableOperations
                                ellipsis={10}
                                width="260px"
                                buttons={buttons}
                                label={$t('commons.table.operate')}
                                fix
                            />
                        </ComplexTable>
                    }
                </div>
                <Operate
                    ref={operateRef}
                    onClose={($event?: any) => {
                        search();
                    }}
                />
                <OpDialog
                    ref={delRef}
                    onSearch={($event?: any) => {
                        search();
                    }}
                />
                <File
                    ref={fileRef}
                    onSearch={($event?: any) => {
                        search();
                    }}
                />
            </>
        );
    },
    options,
);
