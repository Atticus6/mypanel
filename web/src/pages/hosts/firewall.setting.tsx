import PageView from '@/pages/views/host/firewall/setting/index';
definePage({
    name: 'FirewallSetting',
    meta: {
        activeMenu: '/hosts/firewall/rules',
        parent: 'menu.firewall',
        title: 'commons.button.set',
        permission: 'host_firewall_view',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'firewall.setting',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
