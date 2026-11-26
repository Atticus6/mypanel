import PageView from '@/views/website/ssl/acme-account/index';
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
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';


interface CodemodProps {
    [key: string]: any;

}

const emits = {};



const options = {
        name: "ssl.acme-account",
        props: {},
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        
        return () => (
            <PageView />
        );
    },
    options,
);
