import PageView from '@/views/setting/panel/index';
definePage({
    name: 'Panel',
    meta: { parent: 'menu.settings', activeMenu: '/settings', title: 'setting.panel', adminOnly: true, hidden: true },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'panel',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
