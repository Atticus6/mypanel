import PageView from '@/pages/views/setting/safe/index';
definePage({
    name: 'Safe',
    meta: { parent: 'menu.settings', activeMenu: '/settings', title: 'setting.safe', adminOnly: true, hidden: true },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'safe',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
