import Layout from '@/layout/index';
definePage({
    name: 'Setting-Menu',
    meta: { title: 'menu.settings', icon: 'p-config', sort: 12 },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'settings',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <Layout />;
    },
    options,
);
