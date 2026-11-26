import PageView from '@/views/container/dashboard/index';
definePage({
    name: 'ContainerDashboard',
    props: true,
    meta: {
        activeMenu: '/containers',
        permission: 'container_view',
        parent: 'menu.container',
        title: 'menu.home',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'dashboard',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const __vueRoute = useRoute();

        return () => <PageView {...__vueRoute.params} />;
    },
    options,
);
