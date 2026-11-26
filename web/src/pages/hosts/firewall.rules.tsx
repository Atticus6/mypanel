import PageView from '@/views/host/firewall/rule/index';
definePage({
    name: 'FirewallPort',
    meta: {
        icon: 'p-firewalld-menu',
        activeMenu: '/hosts/firewall/rules',
        title: 'menu.firewall',
        permission: 'host_firewall_view',
    },
});
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'firewall.rules',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
