import PageView from '@/views/host/process/network/index';
definePage({
    name: 'ProcessNetwork',
    meta: {
        parent: 'menu.processManage',
        title: 'menu.network',
        activeMenu: '/hosts/process/process',
        permission: 'host_process_view',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'process.network',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
