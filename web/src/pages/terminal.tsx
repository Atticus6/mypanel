import Layout from '@/layout/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'terminal',
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
    name: 'Terminal-Menu',
    redirect: '/terminal',
    meta: { title: 'menu.terminal', icon: 'p-terminal2', protectedRoleOnly: true, sort: 8 },
});
