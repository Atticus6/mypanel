import PageView from '@/views/website/ssl/index';
definePage({
    name: 'SSL',
    meta: { icon: 'p-ssl-menu', title: 'menu.ssl', permission: 'website_cert_view' },
});
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';


interface CodemodProps {
    [key: string]: any;

}

const emits = {};



const options = {
        name: "ssl",
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
