import PageView from '@/pages/views/cronjob/index';
definePage({
    name: 'Cronjob',
    redirect: '/cronjobs/cronjob',
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'cronjobs',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
