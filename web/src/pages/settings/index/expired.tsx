import PageView from '@/pages/views/setting/expired';
definePage({
    name: 'Expired',
    meta: { parent: 'menu.settings', activeMenu: '/settings', ignoreTab: true, hidden: true },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'expired',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
