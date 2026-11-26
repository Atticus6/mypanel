import PageView from '@/views/container/index';
definePage({
    name: 'Container',
    redirect: '/containers/dashboard',
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'containers',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
