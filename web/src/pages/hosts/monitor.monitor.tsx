import PageView from '@/views/host/monitor/monitor/index';
definePage({
    name: 'Monitorx',
    meta: {
        icon: 'p-system-monitor-menu',
        activeMenu: '/hosts/monitor/monitor',
        title: 'menu.monitor',
        permission: 'host_monitor_view',
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'monitor.monitor',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
