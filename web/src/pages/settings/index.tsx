import PageView from '@/views/setting/index';
definePage({
    name: 'Setting',
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'settings',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
