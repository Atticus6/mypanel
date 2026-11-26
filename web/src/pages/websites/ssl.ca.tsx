import PageView from '@/views/website/ssl/ca/index';
definePage({
    name: 'SSL-CA',
    meta: {
        activeMenu: '/websites/ssl',
        title: 'menu.ssl',
        detail: 'ssl.selfSigned',
        permission: 'website_cert_view',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ssl.ca',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
