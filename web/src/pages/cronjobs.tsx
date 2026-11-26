import Layout from '@/layout/index';
definePage({
    name: 'Cronjob-Menu',
    redirect: '/cronjobs/cronjob',
    meta: { icon: 'p-plan', title: 'menu.cronjob', permission: 'cronjob_view', sort: 9 },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'cronjobs',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <Layout />;
    },
    options,
);
