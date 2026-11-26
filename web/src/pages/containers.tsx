import Layout from '@/layout/index';
definePage({
    name: 'Container-Menu',
    redirect: '/containers/container',
    meta: { icon: 'p-docker1', title: 'menu.container', permission: 'container_view', sort: 6 },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'containers',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <Layout />;
    },
    options,
);
