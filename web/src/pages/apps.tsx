import Layout from '@/layout/index';
definePage({
    name: 'App-Menu',
    redirect: '/apps/all',
    meta: { icon: 'p-appstore', title: 'menu.apps', permission: 'app_view', sort: 2 },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'apps',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <Layout />;
    },
    options,
);
