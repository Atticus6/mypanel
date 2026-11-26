import PageView from '@/pages/views/share/index';
definePage({
    name: 'file-share',
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: '[code]',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
