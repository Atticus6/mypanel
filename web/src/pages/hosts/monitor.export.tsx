import PageView from '@/pages/views/host/monitor/export/index';
definePage({
    name: 'HostMonitorExport',
    meta: {
        activeMenu: '/hosts/monitor/monitor',
        title: 'menu.monitor',
        detail: 'commons.button.export',
        permission: 'host_monitor_view',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'monitor.export',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
