import PageView from '@/pages/_components/login/index';

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

definePage({
    name: 'login',
    props: true,
    meta: { key: 'login' },
});
