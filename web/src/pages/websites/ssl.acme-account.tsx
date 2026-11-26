import PageView from '@/pages/views/website/ssl/acme-account/index';
definePage({
    name: 'SSL-ACME',
    meta: {
        activeMenu: '/websites/ssl',
        title: 'menu.ssl',
        detail: 'website.acmeAccountManage',
        permission: 'website_cert_view',
        hidden: true,
    },
});

interface CodemodProps {
    [key: string]: any;
}

const emits = {};

const options = {
    name: 'ssl.acme-account',
    props: {},
    emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        return () => <PageView />;
    },
    options,
);
