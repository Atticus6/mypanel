import Layout from '@/layout/index';
definePage({
    name: false,
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'error',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <Layout />;
    },
    options,
);
