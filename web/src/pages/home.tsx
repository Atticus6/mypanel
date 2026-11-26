import Layout from '@/layout/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'home',
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
    name: 'Home-Menu',
    path: '/',
    redirect: '/',
    meta: { icon: 'p-home', title: 'menu.home', sort: 1 },
});
