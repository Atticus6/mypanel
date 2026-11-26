import PageView from '@/views/container/network/index';
definePage({
    name: 'Network',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.network',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'network',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
