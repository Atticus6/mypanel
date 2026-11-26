import PageView from '@/views/host/firewall/docker/index';
definePage({
    name: 'FirewallDockerGuard',
    meta: {
        activeMenu: '/hosts/firewall/rules',
        parent: 'menu.firewall',
        title: 'firewall.dockerGuard',
        permission: 'host_firewall_view',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'firewall.docker',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
