import PageView from '@/views/cronjob/library/index';
definePage({
    name: 'Library',
    meta: { activeMenu: '/cronjobs', title: 'cronjob.library.library', permission: 'cronjob_view', hidden: true },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'library',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
