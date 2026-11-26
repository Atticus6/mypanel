import Layout from '@/layout/index';
definePage({
    name: 'Log-Menu',
    redirect: '/logs/operation',
    meta: { title: 'menu.logs', icon: 'p-log', permission: 'log_view', sort: 11 },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'logs',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <Layout />;
    },
    options,
);
