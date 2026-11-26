import PageView from '@/pages/apps/_components/installed/index';

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'upgrade',
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

definePage({
    name: 'AppUpgrade',
    props: true,
    meta: { activeMenu: '/apps', parent: 'menu.app', title: 'app.canUpgrade', permission: 'app_view', hidden: true },
});
