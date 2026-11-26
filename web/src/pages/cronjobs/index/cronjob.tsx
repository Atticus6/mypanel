import PageView from '@/pages/views/cronjob/cronjob/index';
definePage({
    name: 'CronjobItem',
    meta: { activeMenu: '/cronjobs', title: 'menu.cronjob', permission: 'cronjob_view', hidden: true },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'cronjob',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
