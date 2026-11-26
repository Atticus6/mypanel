import PageView from '@/views/container/container/operate/index';
definePage({
    name: 'ContainerCreate',
    props: true,
    meta: { activeMenu: '/containers', permission: 'container_view', ignoreTab: true, hidden: true },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'container.operate',
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
