import PageView from '@/views/app-store/apps/index';

definePage({
    name: 'AppAll',
    props: true,
    meta: { activeMenu: '/apps', parent: 'menu.app', title: 'app.all', permission: 'app_view', hidden: true },
});

export default defineComponent(
    () => {
        const route = useRoute();

        return () => <PageView {...route.params} />;
    },
    {
        name: 'AppAll',
    },
);
