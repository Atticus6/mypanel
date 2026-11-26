import PageView from '@/views/login/index';
definePage({
    name: 'entrance',
    props: true,
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: '[[code]]',
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
