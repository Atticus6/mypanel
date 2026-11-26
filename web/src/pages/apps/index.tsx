import PageView from '@/pages/views/app-store/index';
definePage({
    name: 'App',
    redirect: '/apps/all',
    meta: { permission: 'app_view' },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'apps',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
