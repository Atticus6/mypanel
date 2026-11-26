import PageView from '@/pages/views/website/website/index';
definePage({
    name: 'Website',
    meta: { icon: 'p-website', title: 'menu.website', permission: 'website_view' },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'websites',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
