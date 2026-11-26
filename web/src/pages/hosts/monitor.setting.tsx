import { $t } from '@/utils/i18n-t';
import MonitorRouter from '@/pages/hosts/_components/monitor/index';
import Interval from '@/pages/hosts/_components/monitor/setting/interval/index';
import StoreDays from '@/pages/hosts/_components/monitor/setting/days/index';
import Network from '@/pages/hosts/_components/monitor/setting/default-network/index';
import IO from '@/pages/hosts/_components/monitor/setting/default-io/index';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { splitTimeFromSecond, transTimeUnit } from '@/utils/validate';
import { rpc } from '@/lib/rpc';
import LayoutContent from '@/components/layout-content/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'monitor.setting',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const loading = ref();
        const form = reactive({
            gpuMonitorStatus: 'Disable',
            gpuMonitorStoreDays: 30,
            gpuMonitorInterval: 300,
            gpuMonitorIntervalItem: '',
            monitorStatus: 'Disable',
            monitorStoreDays: 30,
            monitorInterval: 300,
            monitorIntervalItem: '',
            defaultNetwork: '',
            defaultIO: '',
        });
        const intervalRef = ref();
        const daysRef = ref();
        const networkRef = ref();
        const ioRef = ref();
        const search = async () => {
            const res = await rpc.monitor.getSetting({});
            form.gpuMonitorStatus = res.gpuMonitorStatus;
            form.gpuMonitorStoreDays = Number(res.gpuMonitorStoreDays);
            form.gpuMonitorInterval = Number(res.gpuMonitorInterval);
            const gpuInterval = splitTimeFromSecond(form.gpuMonitorInterval);
            form.gpuMonitorIntervalItem = transTimeUnit(gpuInterval.timeItem + gpuInterval.timeUnit);
            form.monitorStatus = res.monitorStatus;
            form.monitorInterval = Number(res.monitorInterval);
            const item = splitTimeFromSecond(form.monitorInterval);
            form.monitorIntervalItem = transTimeUnit(item.timeItem + item.timeUnit);

            form.monitorStoreDays = Number(res.monitorStoreDays);
            form.defaultNetwork =
                res.defaultNetwork === 'all' ? i18n.global.t('commons.table.all') : res.defaultNetwork;
            form.defaultIO = res.defaultIo === 'all' ? i18n.global.t('commons.table.all') : res.defaultIo;
        };
        const onSaveStatus = async (key: 'MonitorStatus' | 'GPUMonitorStatus', value: string) => {
            loading.value = true;
            await rpc.monitor
                .updateSetting({ key, value })
                .then(() => {
                    loading.value = false;
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                })
                .catch(async () => {
                    loading.value = false;
                    await search();
                });
        };
        const onChangeStoreDays = (key: 'MonitorStoreDays' | 'GPUMonitorStoreDays', value: number) => {
            daysRef.value.acceptParams({ key, monitorStoreDays: value });
        };
        const onChangeInterval = (key: 'MonitorInterval' | 'GPUMonitorInterval', value: number) => {
            const interval = splitTimeFromSecond(value);
            intervalRef.value.acceptParams({ key, timeItem: interval.timeItem, timeUnit: interval.timeUnit });
        };
        const onChangeNetwork = () => {
            networkRef.value.acceptParams({ defaultNetwork: form.defaultNetwork });
        };
        const onChangeIO = () => {
            ioRef.value.acceptParams({ defaultIO: form.defaultIO });
        };
        const onClean = async (type: 'host' | 'gpu') => {
            const name = i18n.global.t(type === 'host' ? 'monitor.hostMonitor' : 'monitor.gpuMonitor');
            ElMessageBox.confirm(i18n.global.t('monitor.cleanHelper', [name]), i18n.global.t('monitor.cleanMonitor'), {
                confirmButtonText: i18n.global.t('commons.button.confirm'),
                cancelButtonText: i18n.global.t('commons.button.cancel'),
                type: 'info',
            }).then(async () => {
                loading.value = true;
                await rpc.monitor
                    .clean({ type })
                    .then(() => {
                        loading.value = false;
                        MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    })
                    .catch(() => {
                        loading.value = false;
                    });
            });
        };
        onMounted(() => {
            search();
        });
        return () => (
            <div>
                <MonitorRouter />
                {
                    <LayoutContent
                        title={$t('menu.settings', 2)}
                        v-slots={{
                            main: () => (
                                <>
                                    <ElForm
                                        model={form}
                                        onSubmit={($event?: any) => {
                                            $event.preventDefault();
                                        }}
                                        label-position="left"
                                        label-width="160px"
                                    >
                                        <ElRow>
                                            <ElCol span={1}>
                                                <br />
                                            </ElCol>
                                            <ElCol span={12}>
                                                <h3 class={'mb-4'}>{$t('monitor.hostMonitor')}</h3>
                                                <ElFormItem label={$t('monitor.enableMonitor')} prop="monitorStatus">
                                                    {
                                                        <ElSwitch
                                                            onChange={($event?: any) => {
                                                                onSaveStatus('MonitorStatus', form.monitorStatus);
                                                            }}
                                                            v-model={form.monitorStatus}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            v-permission={true}
                                                            v-node-admin={true}
                                                        />
                                                    }
                                                </ElFormItem>
                                                <ElFormItem label={$t('monitor.storeDays')} prop="monitorStoreDays">
                                                    <ElInput
                                                        disabled
                                                        v-model={form.monitorStoreDays}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                onChangeStoreDays(
                                                                                    'MonitorStoreDays',
                                                                                    form.monitorStoreDays,
                                                                                );
                                                                            }}
                                                                            icon="Setting"
                                                                            v-permission={true}
                                                                            v-node-admin={true}
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    }
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </ElFormItem>
                                                <ElFormItem label={$t('monitor.interval')} prop="monitorIntervalItem">
                                                    <ElInput
                                                        disabled
                                                        v-model={form.monitorIntervalItem}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                onChangeInterval(
                                                                                    'MonitorInterval',
                                                                                    form.monitorInterval,
                                                                                );
                                                                            }}
                                                                            icon="Setting"
                                                                            v-permission={true}
                                                                            v-node-admin={true}
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    }
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </ElFormItem>
                                                <ElFormItem label={$t('monitor.defaultNetwork')}>
                                                    <ElInput
                                                        disabled
                                                        v-model={form.defaultNetwork}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeNetwork as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                            v-permission={true}
                                                                            v-node-admin={true}
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    }
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <span class={'input-help'}>
                                                        {$t('monitor.defaultNetworkHelper')}
                                                    </span>
                                                </ElFormItem>
                                                <ElFormItem label={$t('monitor.defaultIO')}>
                                                    <ElInput
                                                        disabled
                                                        v-model={form.defaultIO}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeIO as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                            v-permission={true}
                                                                            v-node-admin={true}
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    }
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <span class={'input-help'}>{$t('monitor.defaultIOHelper')}</span>
                                                </ElFormItem>
                                                <ElFormItem>
                                                    {
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                onClean('host');
                                                            }}
                                                            icon="Delete"
                                                            v-permission={true}
                                                            v-node-admin={true}
                                                        >
                                                            {$t('monitor.cleanMonitor')}
                                                        </ElButton>
                                                    }
                                                </ElFormItem>
                                                <ElDivider />
                                                <h3 class={'mb-4'}>{$t('monitor.gpuMonitor')}</h3>
                                                <ElFormItem label={$t('monitor.enableMonitor')} prop="gpuMonitorStatus">
                                                    {
                                                        <ElSwitch
                                                            onChange={($event?: any) => {
                                                                onSaveStatus('GPUMonitorStatus', form.gpuMonitorStatus);
                                                            }}
                                                            v-model={form.gpuMonitorStatus}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                            v-permission={true}
                                                            v-node-admin={true}
                                                        />
                                                    }
                                                </ElFormItem>
                                                <ElFormItem label={$t('monitor.storeDays')} prop="gpuMonitorStoreDays">
                                                    <ElInput
                                                        disabled
                                                        v-model={form.gpuMonitorStoreDays}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                onChangeStoreDays(
                                                                                    'GPUMonitorStoreDays',
                                                                                    form.gpuMonitorStoreDays,
                                                                                );
                                                                            }}
                                                                            icon="Setting"
                                                                            v-permission={true}
                                                                            v-node-admin={true}
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    }
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </ElFormItem>
                                                <ElFormItem
                                                    label={$t('monitor.interval')}
                                                    prop="gpuMonitorIntervalItem"
                                                >
                                                    <ElInput
                                                        disabled
                                                        v-model={form.gpuMonitorIntervalItem}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                onChangeInterval(
                                                                                    'GPUMonitorInterval',
                                                                                    form.gpuMonitorInterval,
                                                                                );
                                                                            }}
                                                                            icon="Setting"
                                                                            v-permission={true}
                                                                            v-node-admin={true}
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>
                                                                    }
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </ElFormItem>
                                                <ElFormItem>
                                                    {
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                onClean('gpu');
                                                            }}
                                                            icon="Delete"
                                                            v-permission={true}
                                                            v-node-admin={true}
                                                        >
                                                            {$t('monitor.cleanMonitor')}
                                                        </ElButton>
                                                    }
                                                </ElFormItem>
                                            </ElCol>
                                        </ElRow>
                                    </ElForm>
                                </>
                            ),
                        }}
                        v-loading={unref(loading)}
                    />
                }
                <Interval
                    ref={intervalRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <StoreDays
                    ref={daysRef}
                    onSearch={($event?: any) => {
                        (search as any)($event);
                    }}
                />
                <Network
                    ref={networkRef}
                    onSearch={($event?: any) => {
                        search();
                    }}
                />
                <IO
                    ref={ioRef}
                    onSearch={($event?: any) => {
                        search();
                    }}
                />
            </div>
        );
    },
    options,
);

definePage({
    name: 'HostMonitorSetting',
    meta: {
        activeMenu: '/hosts/monitor/monitor',
        title: 'menu.monitor',
        detail: 'commons.button.set',
        permission: 'host_monitor_view',
        hidden: true,
    },
});
