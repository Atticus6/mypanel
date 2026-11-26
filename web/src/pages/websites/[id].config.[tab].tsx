import { useRoute } from 'vue-router';
import PageView from '@/views/website/website/config/index';
definePage({
    name: 'WebsiteConfig',
    props: true,
    meta: { activeMenu: '/websites', ignoreTab: true, permission: 'website_view', hidden: true },
});
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';


interface CodemodProps {
    [key: string]: any;

}

const emits = {};



const options = {
        name: "[id].config.[tab]",
        props: {},
        emits: emits,
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const __vueRoute = useRoute();
        
        return () => (
            <PageView {...__vueRoute.params} />
        );
    },
    options,
);
