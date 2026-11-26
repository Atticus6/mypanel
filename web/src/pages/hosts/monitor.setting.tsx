import { $t } from '@/utils/i18n-t';
import MonitorRouter from '@/pages/views/host/monitor/index';
import Interval from '@/pages/views/host/monitor/setting/interval/index';
import StoreDays from '@/pages/views/host/monitor/setting/days/index';
import Network from '@/pages/views/host/monitor/setting/default-network/index';
import IO from '@/pages/views/host/monitor/setting/default-io/index';
import i18n from '@/lang';
import { MsgSuccess } from '@/utils/message';
import { splitTimeFromSecond, transTimeUnit } from '@/utils/validate';
import { rpc } from '@/lib/rpc';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
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
                {withDirectives(
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
                                                    {withDirectives(
                                                        <ElSwitch
                                                            onChange={($event?: any) => {
                                                                onSaveStatus('MonitorStatus', form.monitorStatus);
                                                            }}
                                                            modelValue={form.monitorStatus}
                                                            onUpdate:modelValue={($v) => {
                                                                form.monitorStatus = $v as any;
                                                            }}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                        />,
                                                        [
                                                            [permissionDirective, true],
                                                            [nodeAdminDirective, true],
                                                        ],
                                                    )}
                                                </ElFormItem>
                                                <ElFormItem label={$t('monitor.storeDays')} prop="monitorStoreDays">
                                                    <ElInput
                                                        disabled
                                                        modelValue={form.monitorStoreDays}
                                                        onUpdate:modelValue={($v) => {
                                                            form.monitorStoreDays = $v as any;
                                                        }}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                onChangeStoreDays(
                                                                                    'MonitorStoreDays',
                                                                                    form.monitorStoreDays,
                                                                                );
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </ElFormItem>
                                                <ElFormItem label={$t('monitor.interval')} prop="monitorIntervalItem">
                                                    <ElInput
                                                        disabled
                                                        modelValue={form.monitorIntervalItem}
                                                        onUpdate:modelValue={($v) => {
                                                            form.monitorIntervalItem = $v as any;
                                                        }}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                onChangeInterval(
                                                                                    'MonitorInterval',
                                                                                    form.monitorInterval,
                                                                                );
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </ElFormItem>
                                                <ElFormItem label={$t('monitor.defaultNetwork')}>
                                                    <ElInput
                                                        disabled
                                                        modelValue={form.defaultNetwork}
                                                        onUpdate:modelValue={($v) => {
                                                            form.defaultNetwork = $v as any;
                                                        }}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeNetwork as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
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
                                                        modelValue={form.defaultIO}
                                                        onUpdate:modelValue={($v) => {
                                                            form.defaultIO = $v as any;
                                                        }}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                (onChangeIO as any)($event);
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                    <span class={'input-help'}>{$t('monitor.defaultIOHelper')}</span>
                                                </ElFormItem>
                                                <ElFormItem>
                                                    {withDirectives(
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                onClean('host');
                                                            }}
                                                            icon="Delete"
                                                        >
                                                            {$t('monitor.cleanMonitor')}
                                                        </ElButton>,
                                                        [
                                                            [permissionDirective, true],
                                                            [nodeAdminDirective, true],
                                                        ],
                                                    )}
                                                </ElFormItem>
                                                <ElDivider />
                                                <h3 class={'mb-4'}>{$t('monitor.gpuMonitor')}</h3>
                                                <ElFormItem label={$t('monitor.enableMonitor')} prop="gpuMonitorStatus">
                                                    {withDirectives(
                                                        <ElSwitch
                                                            onChange={($event?: any) => {
                                                                onSaveStatus('GPUMonitorStatus', form.gpuMonitorStatus);
                                                            }}
                                                            modelValue={form.gpuMonitorStatus}
                                                            onUpdate:modelValue={($v) => {
                                                                form.gpuMonitorStatus = $v as any;
                                                            }}
                                                            active-value="Enable"
                                                            inactive-value="Disable"
                                                        />,
                                                        [
                                                            [permissionDirective, true],
                                                            [nodeAdminDirective, true],
                                                        ],
                                                    )}
                                                </ElFormItem>
                                                <ElFormItem label={$t('monitor.storeDays')} prop="gpuMonitorStoreDays">
                                                    <ElInput
                                                        disabled
                                                        modelValue={form.gpuMonitorStoreDays}
                                                        onUpdate:modelValue={($v) => {
                                                            form.gpuMonitorStoreDays = $v as any;
                                                        }}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                onChangeStoreDays(
                                                                                    'GPUMonitorStoreDays',
                                                                                    form.gpuMonitorStoreDays,
                                                                                );
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
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
                                                        modelValue={form.gpuMonitorIntervalItem}
                                                        onUpdate:modelValue={($v) => {
                                                            form.gpuMonitorIntervalItem = $v as any;
                                                        }}
                                                        v-slots={{
                                                            append: () => (
                                                                <>
                                                                    {withDirectives(
                                                                        <ElButton
                                                                            onClick={($event?: any) => {
                                                                                onChangeInterval(
                                                                                    'GPUMonitorInterval',
                                                                                    form.gpuMonitorInterval,
                                                                                );
                                                                            }}
                                                                            icon="Setting"
                                                                        >
                                                                            {$t('commons.button.set')}
                                                                        </ElButton>,
                                                                        [
                                                                            [permissionDirective, true],
                                                                            [nodeAdminDirective, true],
                                                                        ],
                                                                    )}
                                                                </>
                                                            ),
                                                        }}
                                                    />
                                                </ElFormItem>
                                                <ElFormItem>
                                                    {withDirectives(
                                                        <ElButton
                                                            onClick={($event?: any) => {
                                                                onClean('gpu');
                                                            }}
                                                            icon="Delete"
                                                        >
                                                            {$t('monitor.cleanMonitor')}
                                                        </ElButton>,
                                                        [
                                                            [permissionDirective, true],
                                                            [nodeAdminDirective, true],
                                                        ],
                                                    )}
                                                </ElFormItem>
                                            </ElCol>
                                        </ElRow>
                                    </ElForm>
                                </>
                            ),
                        }}
                    />,
                    [[vLoading, unref(loading)]],
                )}
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
