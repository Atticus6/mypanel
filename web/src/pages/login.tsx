import PageView from '@/views/login/index';
definePage({
    name: 'login',
    props: true,
    meta: { key: 'login' },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'login',
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
