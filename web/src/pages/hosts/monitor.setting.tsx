import PageView from '@/views/host/monitor/setting/index';
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
        return () => <PageView />;
    },
    options,
);
