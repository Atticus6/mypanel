import PageView from '@/pages/views/host/firewall/forward/index';
definePage({
    name: 'FirewallForward',
    meta: {
        activeMenu: '/hosts/firewall/rules',
        parent: 'menu.firewall',
        title: 'firewall.forwardRule',
        permission: 'host_firewall_view',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'firewall.forward',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
