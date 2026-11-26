import Layout from '@/layout/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'hosts',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <Layout />;
    },
    options,
);

definePage({
    name: 'System-Menu',
    redirect: '/hosts/files',
    meta: { icon: 'p-host', title: 'menu.system', sort: 7 },
});
