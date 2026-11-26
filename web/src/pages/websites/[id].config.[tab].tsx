import PageView from '@/pages/views/website/website/config/index';
definePage({
    name: 'WebsiteConfig',
    props: true,
    meta: { activeMenu: '/websites', ignoreTab: true, permission: 'website_view', hidden: true },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: '[id].config.[tab]',
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
