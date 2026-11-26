import PageView from '@/views/setting/snapshot/index';
definePage({
    name: 'Snapshot',
    meta: {
        parent: 'menu.settings',
        activeMenu: '/settings',
        title: 'setting.snapshot',
        adminOnly: true,
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'snapshot',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
