import PageView from '@/views/container/setting/index';
definePage({
    name: 'ContainerSetting',
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'container.setting',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'setting',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
