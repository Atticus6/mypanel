import PageView from '@/views/home/index';
definePage({
    name: 'home',
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'home',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
